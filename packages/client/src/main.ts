import * as THREE from 'three';
import { BlockTypes, BlockDefinitions, CHUNK_SIZE } from '@clawcraft/shared';
import type { ServerMessage, ClientMessage, Agent, Chunk, AgentSnapshot, Vec3 } from '@clawcraft/shared';

// ============================================================================
// STATE
// ============================================================================

let ws: WebSocket | null = null;
let myAgent: Agent | null = null;
let agents: Map<string, Agent> = new Map();
let chunks: Map<string, Chunk> = new Map();
let spectatorMode = false;

// Three.js
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let chunkMeshes: Map<string, THREE.Mesh> = new Map();
let waterMeshes: Map<string, THREE.Mesh> = new Map();
let agentMeshes: Map<string, THREE.Mesh> = new Map();

// Controls
const keys: Set<string> = new Set();
let mouseLocked = false;
let yaw = 0;
let pitch = 0;

// Stats
let lastTime = performance.now();
let frames = 0;
let fps = 0;

// ============================================================================
// INITIALIZATION
// ============================================================================

function init(): void {
  // Three.js setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // Sky blue
  scene.fog = new THREE.Fog(0x87ceeb, 50, 200); // Fog for atmosphere

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 70, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('canvas-container')!.appendChild(renderer.domElement);

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(100, 200, 100);
  scene.add(sun);

  // Event listeners
  window.addEventListener('resize', onResize);
  document.addEventListener('keydown', (e) => keys.add(e.code));
  document.addEventListener('keyup', (e) => keys.delete(e.code));
  document.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('click', () => {
    renderer.domElement.requestPointerLock();
  });
  document.addEventListener('pointerlockchange', () => {
    mouseLocked = document.pointerLockElement === renderer.domElement;
  });

  // UI
  document.getElementById('connect-btn')!.addEventListener('click', () => connect(false));
  document.getElementById('spectate-btn')!.addEventListener('click', () => connect(true));

  // Chat input
  const chatInput = document.getElementById('chat-input') as HTMLInputElement;
  chatInput.addEventListener('keydown', (e) => {
    e.stopPropagation(); // Don't trigger movement keys while typing
    if (e.key === 'Enter' && chatInput.value.trim()) {
      if (!spectatorMode && myAgent) {
        send({ type: 'chat', message: chatInput.value.trim() });
      } else if (spectatorMode) {
        addChatMessage('System', 'Spectators cannot chat. Connect as an agent to chat.');
      }
      chatInput.value = '';
      chatInput.blur();
    } else if (e.key === 'Escape') {
      chatInput.blur();
    }
  });

  // Press T or Enter to focus chat (when not already focused)
  document.addEventListener('keydown', (e) => {
    if (document.activeElement !== chatInput && (e.key === 't' || e.key === 'T' || e.key === 'Enter')) {
      if (document.getElementById('connect-modal')!.style.display !== 'none') return;
      e.preventDefault();
      chatInput.focus();
    }
  });

  // Start render loop
  animate();
}

function connect(spectate: boolean): void {
  const nameInput = document.getElementById('agent-name') as HTMLInputElement;
  const name = nameInput.value || `Spectator-${Math.random().toString(36).slice(2, 8)}`;
  spectatorMode = spectate;

  const serverUrl = import.meta.env.VITE_SERVER_URL || 'ws://localhost:3001';
  ws = new WebSocket(serverUrl);

  ws.onopen = () => {
    console.log('Connected to server');
    send({ type: 'auth', token: name });
    document.getElementById('connect-modal')!.style.display = 'none';
  };

  ws.onmessage = (event) => {
    const msg: ServerMessage = JSON.parse(event.data);
    handleMessage(msg);
  };

  ws.onclose = () => {
    console.log('Disconnected');
    document.getElementById('connect-modal')!.style.display = 'block';
  };
}

// ============================================================================
// NETWORKING
// ============================================================================

function send(msg: ClientMessage): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function handleMessage(msg: ServerMessage): void {
  switch (msg.type) {
    case 'auth_success':
      myAgent = msg.agent;
      camera.position.set(msg.agent.position.x, msg.agent.position.y + 1.6, msg.agent.position.z);
      break;

    case 'world_state':
      for (const agent of msg.agents) {
        agents.set(agent.id, agent);
        createAgentMesh(agent);
      }
      updateAgentList();
      // Load chat history
      if (msg.chatHistory) {
        for (const chatMsg of msg.chatHistory) {
          addChatMessage(chatMsg.senderName, chatMsg.text);
        }
      }
      break;

    case 'chat':
      addChatMessage(msg.message.senderName, msg.message.text);
      break;

    case 'chunk_data':
      chunks.set(chunkKey(msg.chunk.coord), msg.chunk);
      createChunkMesh(msg.chunk);
      break;

    case 'tick':
      updateTick(msg.tick, msg.agents);
      break;

    case 'event':
      handleEvent(msg.event);
      break;
  }
}

function handleEvent(event: any): void {
  switch (event.type) {
    case 'agent_joined':
      agents.set(event.agent.id, event.agent);
      createAgentMesh(event.agent);
      updateAgentList();
      addChatMessage('System', `${event.agent.name} joined the world`);
      break;

    case 'agent_left':
      const leftAgent = agents.get(event.agentId);
      if (leftAgent) {
        addChatMessage('System', `${leftAgent.name} left the world`);
      }
      agents.delete(event.agentId);
      removeAgentMesh(event.agentId);
      updateAgentList();
      break;

    case 'block_placed':
    case 'block_broken':
      // Refresh affected chunk
      const coord = {
        cx: Math.floor(event.position.x / CHUNK_SIZE),
        cy: Math.floor(event.position.y / CHUNK_SIZE),
        cz: Math.floor(event.position.z / CHUNK_SIZE),
      };
      send({ type: 'request_chunks', coords: [coord] });
      break;

    case 'chat':
      const chatAgent = agents.get(event.agentId);
      addChatMessage(chatAgent?.name || 'Unknown', event.message);
      break;
  }
}

function updateTick(tick: number, snapshots: AgentSnapshot[]): void {
  document.getElementById('tick')!.textContent = tick.toString();

  for (const snap of snapshots) {
    const agent = agents.get(snap.id);
    if (agent) {
      agent.position = snap.position;
      agent.rotation = snap.rotation;
      agent.velocity = snap.velocity;

      // Update mesh position
      const mesh = agentMeshes.get(snap.id);
      if (mesh) {
        mesh.position.set(snap.position.x, snap.position.y + 0.9, snap.position.z);
      }

      // Update camera if this is our agent
      if (myAgent && snap.id === myAgent.id && !spectatorMode) {
        camera.position.set(snap.position.x, snap.position.y + 1.6, snap.position.z);
      }
    }
  }

  document.getElementById('agent-count')!.textContent = agents.size.toString();
}

// ============================================================================
// RENDERING
// ============================================================================

const blockColors: Record<number, number> = {
  [BlockTypes.STONE]: 0x808080,
  [BlockTypes.DIRT]: 0x8b4513,
  [BlockTypes.GRASS]: 0x228b22,
  [BlockTypes.WOOD]: 0x8b6914,
  [BlockTypes.LEAVES]: 0x006400,
  [BlockTypes.WATER]: 0x4169e1,
  [BlockTypes.SAND]: 0xf4a460,
  [BlockTypes.BEDROCK]: 0x1a1a1a,
};

function createChunkMesh(chunk: Chunk): void {
  const key = chunkKey(chunk.coord);
  
  // Remove old meshes
  const oldMesh = chunkMeshes.get(key);
  if (oldMesh) {
    scene.remove(oldMesh);
    oldMesh.geometry.dispose();
  }
  const oldWater = waterMeshes.get(key);
  if (oldWater) {
    scene.remove(oldWater);
    oldWater.geometry.dispose();
  }

  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const colors: number[] = [];
  
  const waterGeometry = new THREE.BufferGeometry();
  const waterPositions: number[] = [];

  const worldX = chunk.coord.cx * CHUNK_SIZE;
  const worldY = chunk.coord.cy * CHUNK_SIZE;
  const worldZ = chunk.coord.cz * CHUNK_SIZE;

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const index = x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE;
        const blockId = chunk.blocks[index] as number;
        
        if (blockId === BlockTypes.AIR) continue;
        
        // Handle water separately
        if (blockId === BlockTypes.WATER) {
          // Only render top face of water
          const aboveIndex = x + (y + 1) * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE;
          const aboveBlock = y + 1 < CHUNK_SIZE ? chunk.blocks[aboveIndex] : BlockTypes.AIR;
          if (aboveBlock === BlockTypes.AIR) {
            addWaterFace(waterPositions, worldX + x, worldY + y, worldZ + z);
          }
          continue;
        }

        const def = BlockDefinitions[blockId as keyof typeof BlockDefinitions];
        if (!def?.solid) continue;

        // Check neighbors to only render exposed faces
        const neighbors: [number, number, number][] = [
          [1, 0, 0], [-1, 0, 0],
          [0, 1, 0], [0, -1, 0],
          [0, 0, 1], [0, 0, -1],
        ];

        for (const neighbor of neighbors) {
          const dx = neighbor[0];
          const dy = neighbor[1];
          const dz = neighbor[2];
          const nx = x + dx;
          const ny = y + dy;
          const nz = z + dz;

          let neighborSolid = false;
          if (nx >= 0 && nx < CHUNK_SIZE && ny >= 0 && ny < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE) {
            const nIndex = nx + ny * CHUNK_SIZE + nz * CHUNK_SIZE * CHUNK_SIZE;
            const nBlock = chunk.blocks[nIndex] as number;
            const nDef = BlockDefinitions[nBlock as keyof typeof BlockDefinitions];
            neighborSolid = nDef?.solid ?? false;
          }

          if (!neighborSolid) {
            addFace(positions, colors, worldX + x, worldY + y, worldZ + z, dx, dy, dz, blockColors[blockId as keyof typeof blockColors] ?? 0xff00ff);
          }
        }
      }
    }
  }

  // Create solid mesh
  if (positions.length > 0) {
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    chunkMeshes.set(key, mesh);
  }

  // Create water mesh
  if (waterPositions.length > 0) {
    waterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(waterPositions, 3));
    waterGeometry.computeVertexNormals();

    const waterMaterial = new THREE.MeshLambertMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    scene.add(waterMesh);
    waterMeshes.set(key, waterMesh);
  }
}

function addWaterFace(positions: number[], x: number, y: number, z: number): void {
  // Slightly lower water surface for visual effect
  const waterY = y + 0.9;
  positions.push(
    x, waterY, z,
    x, waterY, z + 1,
    x + 1, waterY, z + 1,
    x, waterY, z,
    x + 1, waterY, z + 1,
    x + 1, waterY, z,
  );
}

function addFace(
  positions: number[],
  colors: number[],
  x: number, y: number, z: number,
  dx: number, dy: number, dz: number,
  color: number
): void {
  const r = ((color >> 16) & 255) / 255;
  const g = ((color >> 8) & 255) / 255;
  const b = (color & 255) / 255;

  // Face vertices based on normal direction
  let vertices: [number, number, number][];

  if (dx === 1) {
    vertices = [
      [x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1],
      [x + 1, y, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1],
    ];
  } else if (dx === -1) {
    vertices = [
      [x, y, z + 1], [x, y + 1, z + 1], [x, y + 1, z],
      [x, y, z + 1], [x, y + 1, z], [x, y, z],
    ];
  } else if (dy === 1) {
    vertices = [
      [x, y + 1, z], [x, y + 1, z + 1], [x + 1, y + 1, z + 1],
      [x, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y + 1, z],
    ];
  } else if (dy === -1) {
    vertices = [
      [x, y, z + 1], [x, y, z], [x + 1, y, z],
      [x, y, z + 1], [x + 1, y, z], [x + 1, y, z + 1],
    ];
  } else if (dz === 1) {
    vertices = [
      [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1],
      [x + 1, y, z + 1], [x, y + 1, z + 1], [x, y, z + 1],
    ];
  } else {
    vertices = [
      [x, y, z], [x, y + 1, z], [x + 1, y + 1, z],
      [x, y, z], [x + 1, y + 1, z], [x + 1, y, z],
    ];
  }

  for (const v of vertices) {
    positions.push(v[0], v[1], v[2]);
    colors.push(r, g, b);
  }
}

function createAgentMesh(agent: Agent): void {
  if (agentMeshes.has(agent.id)) return;

  const geometry = new THREE.BoxGeometry(0.6, 1.8, 0.6);
  const material = new THREE.MeshLambertMaterial({ color: 0x4ecdc4 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(agent.position.x, agent.position.y + 0.9, agent.position.z);
  
  scene.add(mesh);
  agentMeshes.set(agent.id, mesh);
}

function removeAgentMesh(agentId: string): void {
  const mesh = agentMeshes.get(agentId);
  if (mesh) {
    scene.remove(mesh);
    mesh.geometry.dispose();
    agentMeshes.delete(agentId);
  }
}

function chunkKey(coord: { cx: number; cy: number; cz: number }): string {
  return `${coord.cx},${coord.cy},${coord.cz}`;
}

// ============================================================================
// INPUT
// ============================================================================

function onResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(event: MouseEvent): void {
  if (!mouseLocked) return;

  const sensitivity = 0.002;
  yaw -= event.movementX * sensitivity;
  pitch -= event.movementY * sensitivity;
  pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));

  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  // Only send look action if not spectator
  if (!spectatorMode) {
    send({ type: 'action', action: { type: 'look', pitch, yaw } });
  }
}

function processInput(): void {
  // Spectator fly-cam controls
  if (spectatorMode) {
    const speed = 0.5;
    let dx = 0, dy = 0, dz = 0;
    
    if (keys.has('KeyW')) dz -= 1;
    if (keys.has('KeyS')) dz += 1;
    if (keys.has('KeyA')) dx -= 1;
    if (keys.has('KeyD')) dx += 1;
    if (keys.has('Space')) dy += 1;
    if (keys.has('ShiftLeft') || keys.has('ShiftRight')) dy -= 1;

    if (dx !== 0 || dy !== 0 || dz !== 0) {
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      
      camera.position.x += (dx * cos - dz * sin) * speed;
      camera.position.y += dy * speed;
      camera.position.z += (dx * sin + dz * cos) * speed;
    }
    return;
  }

  if (!myAgent) return;

  let dx = 0, dz = 0;
  
  if (keys.has('KeyW')) dz -= 1;
  if (keys.has('KeyS')) dz += 1;
  if (keys.has('KeyA')) dx -= 1;
  if (keys.has('KeyD')) dx += 1;

  if (dx !== 0 || dz !== 0) {
    // Rotate direction by camera yaw
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const direction = {
      x: dx * cos - dz * sin,
      y: 0,
      z: dx * sin + dz * cos,
    };
    
    // Normalize
    const len = Math.sqrt(direction.x ** 2 + direction.z ** 2);
    direction.x /= len;
    direction.z /= len;

    send({ type: 'action', action: { type: 'move', direction } });
  }

  if (keys.has('Space')) {
    send({ type: 'action', action: { type: 'jump' } });
    keys.delete('Space');
  }
}

// ============================================================================
// UI
// ============================================================================

function updateAgentList(): void {
  const container = document.getElementById('agents')!;
  container.innerHTML = '';
  
  for (const agent of agents.values()) {
    const div = document.createElement('div');
    div.className = 'agent-item';
    div.textContent = agent.name + (agent.id === myAgent?.id ? ' (you)' : '');
    container.appendChild(div);
  }
}

function addChatMessage(name: string, message: string): void {
  const container = document.getElementById('chat-messages')!;
  const div = document.createElement('div');
  div.className = 'chat-message';
  
  if (name === 'System') {
    div.innerHTML = `<span class="system">* ${message}</span>`;
  } else {
    // Escape HTML to prevent XSS
    const safeName = name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeMsg = message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    div.innerHTML = `<span class="name">${safeName}:</span> ${safeMsg}`;
  }
  
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;

  // Limit messages shown
  while (container.children.length > 50) {
    container.removeChild(container.firstChild!);
  }
}

// ============================================================================
// MAIN LOOP
// ============================================================================

function animate(): void {
  requestAnimationFrame(animate);

  // FPS counter
  frames++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    fps = frames;
    frames = 0;
    lastTime = now;
    document.getElementById('fps')!.textContent = fps.toString();
  }

  processInput();
  renderer.render(scene, camera);
}

// Start
init();
