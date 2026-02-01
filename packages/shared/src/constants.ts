// ============================================================================
// WORLD CONSTANTS
// ============================================================================

/** Size of a chunk in blocks (16x16x16) */
export const CHUNK_SIZE = 16;

/** Total blocks per chunk */
export const BLOCKS_PER_CHUNK = CHUNK_SIZE ** 3; // 4096

/** World height in chunks */
export const WORLD_HEIGHT_CHUNKS = 16; // 256 blocks tall

/** World height in blocks */
export const WORLD_HEIGHT = WORLD_HEIGHT_CHUNKS * CHUNK_SIZE; // 256

// ============================================================================
// BLOCK TYPES
// ============================================================================

export const BlockTypes = {
  AIR: 0,
  STONE: 1,
  DIRT: 2,
  GRASS: 3,
  WOOD: 4,
  LEAVES: 5,
  WATER: 6,
  SAND: 7,
  BEDROCK: 8,
} as const;

export type BlockTypeName = keyof typeof BlockTypes;

/** Block metadata (name, textures, properties) */
export interface BlockDefinition {
  id: number;
  name: string;
  solid: boolean;
  transparent: boolean;
  // Future: textures, hardness, etc.
}

export const BlockDefinitions: Record<number, BlockDefinition> = {
  [BlockTypes.AIR]: { id: 0, name: 'Air', solid: false, transparent: true },
  [BlockTypes.STONE]: { id: 1, name: 'Stone', solid: true, transparent: false },
  [BlockTypes.DIRT]: { id: 2, name: 'Dirt', solid: true, transparent: false },
  [BlockTypes.GRASS]: { id: 3, name: 'Grass', solid: true, transparent: false },
  [BlockTypes.WOOD]: { id: 4, name: 'Wood', solid: true, transparent: false },
  [BlockTypes.LEAVES]: { id: 5, name: 'Leaves', solid: true, transparent: true },
  [BlockTypes.WATER]: { id: 6, name: 'Water', solid: false, transparent: true },
  [BlockTypes.SAND]: { id: 7, name: 'Sand', solid: true, transparent: false },
  [BlockTypes.BEDROCK]: { id: 8, name: 'Bedrock', solid: true, transparent: false },
};

// ============================================================================
// PHYSICS
// ============================================================================

export const GRAVITY = 9.8; // blocks per second²
export const TERMINAL_VELOCITY = 50; // blocks per second
export const JUMP_VELOCITY = 8; // blocks per second
export const WALK_SPEED = 4.3; // blocks per second
export const SPRINT_SPEED = 5.6; // blocks per second

// ============================================================================
// NETWORK
// ============================================================================

export const DEFAULT_SERVER_PORT = 3001;
export const TICK_RATE = 20; // ticks per second
export const TICK_MS = 1000 / TICK_RATE; // 50ms per tick
