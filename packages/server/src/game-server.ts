import { WebSocket } from 'ws';
import { v4 as uuid } from 'uuid';
import {
  TICK_MS,
  GRAVITY,
  TERMINAL_VELOCITY,
  JUMP_VELOCITY,
  WALK_SPEED,
  BlockTypes,
} from '@clawcraft/shared';
import type {
  Agent,
  Vec3,
  AgentAction,
  WorldEvent,
  ClientMessage,
  ServerMessage,
  PublicAgentInfo,
  WorldStats,
  Proposal,
  AgentSnapshot,
} from '@clawcraft/shared';
import { World } from '@clawcraft/world';

interface ConnectedClient {
  ws: WebSocket;
  agent: Agent | null;
  authenticated: boolean;
}

export class GameServer {
  private world: World;
  private clients: Map<WebSocket, ConnectedClient> = new Map();
  private agents: Map<string, Agent> = new Map();
  private proposals: Map<string, Proposal> = new Map();
  private tickInterval: NodeJS.Timeout | null = null;
  private tick = 0;
  private startTime = Date.now();

  constructor() {
    this.world = new World({ generator: { seed: 42 } });
  }

  start(): void {
    console.log('Starting game loop...');
    this.tickInterval = setInterval(() => this.update(), TICK_MS);
  }

  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  handleConnection(ws: WebSocket): void {
    const client: ConnectedClient = {
      ws,
      agent: null,
      authenticated: false,
    };
    this.clients.set(ws, client);
    console.log('Client connected');

    ws.on('message', (data) => {
      try {
        const msg: ClientMessage = JSON.parse(data.toString());
        this.handleMessage(client, msg);
      } catch (e) {
        console.error('Invalid message:', e);
      }
    });

    ws.on('close', () => {
      if (client.agent) {
        this.agents.delete(client.agent.id);
        this.broadcast({ type: 'event', event: { type: 'agent_left', agentId: client.agent.id } });
      }
      this.clients.delete(ws);
      console.log('Client disconnected');
    });
  }

  private handleMessage(client: ConnectedClient, msg: ClientMessage): void {
    switch (msg.type) {
      case 'auth':
        this.handleAuth(client, msg.token);
        break;

      case 'action':
        if (client.agent) {
          this.handleAction(client.agent, msg.action);
        }
        break;

      case 'request_chunks':
        if (client.agent) {
          for (const coord of msg.coords) {
            const chunk = this.world.getChunk(coord);
            this.send(client.ws, { type: 'chunk_data', chunk });
          }
        }
        break;
    }
  }

  private handleAuth(client: ConnectedClient, token: string): void {
    // TODO: Validate Moltbook token
    // For now, accept any token as agent name
    const agentName = token || `Agent-${uuid().slice(0, 8)}`;
    
    const spawnPoint = this.world.findSpawnPoint();
    const agent: Agent = {
      id: uuid(),
      type: 'agent',
      name: agentName,
      moltbookId: token || undefined,
      position: spawnPoint,
      rotation: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      inventory: [
        { blockId: BlockTypes.STONE, count: 64 },
        { blockId: BlockTypes.DIRT, count: 64 },
        { blockId: BlockTypes.WOOD, count: 64 },
      ],
      health: 20,
      maxHealth: 20,
    };

    client.agent = agent;
    client.authenticated = true;
    this.agents.set(agent.id, agent);

    // Send auth success
    this.send(client.ws, { type: 'auth_success', agent });

    // Send current world state
    this.send(client.ws, {
      type: 'world_state',
      agents: Array.from(this.agents.values()),
      time: Date.now(),
    });

    // Send initial chunks
    const chunks = this.world.getChunksAround(agent.position, 2);
    for (const chunk of chunks) {
      this.send(client.ws, { type: 'chunk_data', chunk });
    }

    // Broadcast join event
    this.broadcast({ type: 'event', event: { type: 'agent_joined', agent } });

    console.log(`Agent joined: ${agent.name} at ${JSON.stringify(agent.position)}`);
  }

  private handleAction(agent: Agent, action: AgentAction): void {
    switch (action.type) {
      case 'move': {
        const speed = WALK_SPEED * (TICK_MS / 1000);
        agent.velocity.x = action.direction.x * speed;
        agent.velocity.z = action.direction.z * speed;
        break;
      }

      case 'jump':
        if (this.isOnGround(agent)) {
          agent.velocity.y = JUMP_VELOCITY;
        }
        break;

      case 'look':
        agent.rotation.x = action.pitch;
        agent.rotation.y = action.yaw;
        break;

      case 'place_block': {
        const pos = action.position;
        if (this.world.getBlockAt(pos.x, pos.y, pos.z) === BlockTypes.AIR) {
          this.world.setBlockAt(pos.x, pos.y, pos.z, action.blockId);
          this.broadcast({
            type: 'event',
            event: { type: 'block_placed', position: pos, blockId: action.blockId, agentId: agent.id },
          });
        }
        break;
      }

      case 'break_block': {
        const pos = action.position;
        const existing = this.world.getBlockAt(pos.x, pos.y, pos.z);
        if (existing !== BlockTypes.AIR && existing !== BlockTypes.BEDROCK) {
          this.world.setBlockAt(pos.x, pos.y, pos.z, BlockTypes.AIR);
          this.broadcast({
            type: 'event',
            event: { type: 'block_broken', position: pos, agentId: agent.id },
          });
        }
        break;
      }

      case 'chat':
        this.broadcast({
          type: 'event',
          event: { type: 'chat', agentId: agent.id, message: action.message },
        });
        break;
    }
  }

  private update(): void {
    this.tick++;
    const dt = TICK_MS / 1000;

    // Update physics for all agents
    for (const agent of this.agents.values()) {
      // Apply gravity
      if (!this.isOnGround(agent)) {
        agent.velocity.y -= GRAVITY * dt;
        agent.velocity.y = Math.max(agent.velocity.y, -TERMINAL_VELOCITY);
      }

      // Apply velocity
      const newPos = {
        x: agent.position.x + agent.velocity.x * dt,
        y: agent.position.y + agent.velocity.y * dt,
        z: agent.position.z + agent.velocity.z * dt,
      };

      // Simple collision detection
      if (!this.world.isSolid(newPos.x, agent.position.y, agent.position.z)) {
        agent.position.x = newPos.x;
      }
      if (!this.world.isSolid(agent.position.x, newPos.y, agent.position.z)) {
        agent.position.y = newPos.y;
      } else if (agent.velocity.y < 0) {
        agent.velocity.y = 0;
      }
      if (!this.world.isSolid(agent.position.x, agent.position.y, newPos.z)) {
        agent.position.z = newPos.z;
      }

      // Friction
      agent.velocity.x *= 0.8;
      agent.velocity.z *= 0.8;
    }

    // Send tick update to all clients
    const agentSnapshots: AgentSnapshot[] = Array.from(this.agents.values()).map((a) => ({
      id: a.id,
      position: a.position,
      rotation: a.rotation,
      velocity: a.velocity,
    }));

    this.broadcast({ type: 'tick', tick: this.tick, agents: agentSnapshots });
  }

  private isOnGround(agent: Agent): boolean {
    return this.world.isSolid(agent.position.x, agent.position.y - 0.1, agent.position.z);
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcast(msg: ServerMessage): void {
    for (const client of this.clients.values()) {
      this.send(client.ws, msg);
    }
  }

  // Public API methods
  getStats(): WorldStats {
    return {
      agentCount: this.agents.size,
      totalBlocks: this.world.getLoadedChunks().length * 4096,
      uptime: Date.now() - this.startTime,
      tickRate: 20,
    };
  }

  getPublicAgentList(): PublicAgentInfo[] {
    return Array.from(this.agents.values()).map((a) => ({
      id: a.id,
      name: a.name,
      moltbookId: a.moltbookId,
      position: a.position,
      joinedAt: new Date().toISOString(), // TODO: track actual join time
    }));
  }

  getProposals(): Proposal[] {
    return Array.from(this.proposals.values());
  }

  vote(proposalId: string, agentId: string, vote: 'for' | 'against', reason?: string): { success: boolean; error?: string } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      return { success: false, error: 'Proposal not found' };
    }

    if (proposal.status !== 'voting') {
      return { success: false, error: 'Voting has ended' };
    }

    // Remove existing vote
    proposal.votes.for = proposal.votes.for.filter((id) => id !== agentId);
    proposal.votes.against = proposal.votes.against.filter((id) => id !== agentId);

    // Add new vote
    if (vote === 'for') {
      proposal.votes.for.push(agentId);
    } else {
      proposal.votes.against.push(agentId);
    }

    return { success: true };
  }
}
