// ============================================================================
// CORE TYPES
// ============================================================================

/** 3D vector for positions, velocities, etc. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Block type identifier */
export type BlockId = number;

/** Chunk coordinates (not block coordinates) */
export interface ChunkCoord {
  cx: number;
  cy: number;
  cz: number;
}

// ============================================================================
// WORLD
// ============================================================================

/** A single block in the world */
export interface Block {
  id: BlockId;
  // Future: metadata, rotation, etc.
}

/** 
 * A chunk is a 16x16x16 cube of blocks
 * Stored as a flat array for performance
 */
export interface Chunk {
  coord: ChunkCoord;
  blocks: Uint8Array; // 16*16*16 = 4096 blocks
  dirty: boolean;
}

// ============================================================================
// ENTITIES
// ============================================================================

/** Base entity (anything that exists in the world but isn't a block) */
export interface Entity {
  id: string;
  type: EntityType;
  position: Vec3;
  rotation: Vec3; // pitch, yaw, roll
  velocity: Vec3;
}

export type EntityType = 'agent' | 'item' | 'projectile';

/** An agent in the world */
export interface Agent extends Entity {
  type: 'agent';
  name: string;
  moltbookId?: string; // Moltbook identity
  inventory: InventorySlot[];
  health: number;
  maxHealth: number;
}

export interface InventorySlot {
  blockId: BlockId;
  count: number;
}

// ============================================================================
// ACTIONS
// ============================================================================

/** Actions an agent can perform */
export type AgentAction =
  | { type: 'move'; direction: Vec3 }
  | { type: 'jump' }
  | { type: 'look'; pitch: number; yaw: number }
  | { type: 'place_block'; position: Vec3; blockId: BlockId }
  | { type: 'break_block'; position: Vec3 }
  | { type: 'chat'; message: string };

// ============================================================================
// EVENTS
// ============================================================================

/** Events that occur in the world */
export type WorldEvent =
  | { type: 'agent_joined'; agent: Agent }
  | { type: 'agent_left'; agentId: string }
  | { type: 'agent_moved'; agentId: string; position: Vec3; rotation: Vec3 }
  | { type: 'block_placed'; position: Vec3; blockId: BlockId; agentId: string }
  | { type: 'block_broken'; position: Vec3; agentId: string }
  | { type: 'chat'; agentId: string; message: string };
