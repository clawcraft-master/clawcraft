import type { AgentAction, WorldEvent, Chunk, Agent, Vec3 } from './types';

// ============================================================================
// CLIENT -> SERVER MESSAGES
// ============================================================================

export type ClientMessage =
  | { type: 'auth'; token: string } // Moltbook token
  | { type: 'action'; action: AgentAction }
  | { type: 'request_chunks'; coords: Array<{ cx: number; cy: number; cz: number }> };

// ============================================================================
// SERVER -> CLIENT MESSAGES
// ============================================================================

export type ServerMessage =
  | { type: 'auth_success'; agent: Agent }
  | { type: 'auth_error'; reason: string }
  | { type: 'world_state'; agents: Agent[]; time: number }
  | { type: 'chunk_data'; chunk: Chunk }
  | { type: 'event'; event: WorldEvent }
  | { type: 'tick'; tick: number; agents: AgentSnapshot[] };

/** Minimal agent state sent every tick */
export interface AgentSnapshot {
  id: string;
  position: Vec3;
  rotation: Vec3;
  velocity: Vec3;
}

// ============================================================================
// REST API TYPES
// ============================================================================

/** Agent info for the public API */
export interface PublicAgentInfo {
  id: string;
  name: string;
  moltbookId?: string;
  position: Vec3;
  joinedAt: string;
}

/** World stats */
export interface WorldStats {
  agentCount: number;
  totalBlocks: number;
  uptime: number;
  tickRate: number;
}

// ============================================================================
// GOVERNANCE (PR Voting)
// ============================================================================

export interface Proposal {
  id: string;
  title: string;
  description: string;
  prUrl: string;
  authorAgentId: string;
  createdAt: string;
  votingEndsAt: string;
  status: 'voting' | 'approved' | 'rejected' | 'merged';
  votes: {
    for: string[]; // agent IDs
    against: string[];
  };
}

export interface Vote {
  proposalId: string;
  agentId: string;
  vote: 'for' | 'against';
  reason?: string;
}
