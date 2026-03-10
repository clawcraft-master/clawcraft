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
  FLOWER_RED: 9,
  FLOWER_YELLOW: 10,
  TALL_GRASS: 11,
  // New blocks
  GLASS: 12,
  BRICK: 13,
  COBBLESTONE: 14,
  PLANKS: 15,
  WOOL_WHITE: 16,
  WOOL_RED: 17,
  WOOL_BLUE: 18,
  WOOL_GREEN: 19,
  WOOL_YELLOW: 20,
  WOOL_BLACK: 21,
  CLAY: 22,
  SNOW: 23,
  ICE: 24,
  OBSIDIAN: 25,
  GOLD: 26,
  IRON: 27,
  DIAMOND: 28,
  LAMP: 29,
  BOOKSHELF: 30,
  // Stairs & Slabs
  STONE_STAIRS: 31,
  WOOD_STAIRS: 32,
  STONE_SLAB: 33,
  WOOD_SLAB: 34,
  // Concrete colors
  CONCRETE_WHITE: 35,
  CONCRETE_RED: 36,
  CONCRETE_BLUE: 37,
  CONCRETE_GREEN: 38,
  CONCRETE_YELLOW: 39,
  CONCRETE_BLACK: 40,
  // Biome blocks
  CACTUS: 41,
  DEAD_BUSH: 42,
  GRAVEL: 43,
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
  [BlockTypes.FLOWER_RED]: { id: 9, name: 'Red Flower', solid: false, transparent: true },
  [BlockTypes.FLOWER_YELLOW]: { id: 10, name: 'Yellow Flower', solid: false, transparent: true },
  [BlockTypes.TALL_GRASS]: { id: 11, name: 'Tall Grass', solid: false, transparent: true },
  // New blocks
  [BlockTypes.GLASS]: { id: 12, name: 'Glass', solid: true, transparent: true },
  [BlockTypes.BRICK]: { id: 13, name: 'Brick', solid: true, transparent: false },
  [BlockTypes.COBBLESTONE]: { id: 14, name: 'Cobblestone', solid: true, transparent: false },
  [BlockTypes.PLANKS]: { id: 15, name: 'Planks', solid: true, transparent: false },
  [BlockTypes.WOOL_WHITE]: { id: 16, name: 'Wool White', solid: true, transparent: false },
  [BlockTypes.WOOL_RED]: { id: 17, name: 'Wool Red', solid: true, transparent: false },
  [BlockTypes.WOOL_BLUE]: { id: 18, name: 'Wool Blue', solid: true, transparent: false },
  [BlockTypes.WOOL_GREEN]: { id: 19, name: 'Wool Green', solid: true, transparent: false },
  [BlockTypes.WOOL_YELLOW]: { id: 20, name: 'Wool Yellow', solid: true, transparent: false },
  [BlockTypes.WOOL_BLACK]: { id: 21, name: 'Wool Black', solid: true, transparent: false },
  [BlockTypes.CLAY]: { id: 22, name: 'Clay', solid: true, transparent: false },
  [BlockTypes.SNOW]: { id: 23, name: 'Snow', solid: true, transparent: false },
  [BlockTypes.ICE]: { id: 24, name: 'Ice', solid: true, transparent: true },
  [BlockTypes.OBSIDIAN]: { id: 25, name: 'Obsidian', solid: true, transparent: false },
  [BlockTypes.GOLD]: { id: 26, name: 'Gold Block', solid: true, transparent: false },
  [BlockTypes.IRON]: { id: 27, name: 'Iron Block', solid: true, transparent: false },
  [BlockTypes.DIAMOND]: { id: 28, name: 'Diamond Block', solid: true, transparent: false },
  [BlockTypes.LAMP]: { id: 29, name: 'Lamp', solid: true, transparent: false },
  [BlockTypes.BOOKSHELF]: { id: 30, name: 'Bookshelf', solid: true, transparent: false },
  [BlockTypes.STONE_STAIRS]: { id: 31, name: 'Stone Stairs', solid: true, transparent: false },
  [BlockTypes.WOOD_STAIRS]: { id: 32, name: 'Wood Stairs', solid: true, transparent: false },
  [BlockTypes.STONE_SLAB]: { id: 33, name: 'Stone Slab', solid: true, transparent: false },
  [BlockTypes.WOOD_SLAB]: { id: 34, name: 'Wood Slab', solid: true, transparent: false },
  [BlockTypes.CONCRETE_WHITE]: { id: 35, name: 'Concrete White', solid: true, transparent: false },
  [BlockTypes.CONCRETE_RED]: { id: 36, name: 'Concrete Red', solid: true, transparent: false },
  [BlockTypes.CONCRETE_BLUE]: { id: 37, name: 'Concrete Blue', solid: true, transparent: false },
  [BlockTypes.CONCRETE_GREEN]: { id: 38, name: 'Concrete Green', solid: true, transparent: false },
  [BlockTypes.CONCRETE_YELLOW]: { id: 39, name: 'Concrete Yellow', solid: true, transparent: false },
  [BlockTypes.CONCRETE_BLACK]: { id: 40, name: 'Concrete Black', solid: true, transparent: false },
  [BlockTypes.CACTUS]: { id: 41, name: 'Cactus', solid: true, transparent: false },
  [BlockTypes.DEAD_BUSH]: { id: 42, name: 'Dead Bush', solid: false, transparent: true },
  [BlockTypes.GRAVEL]: { id: 43, name: 'Gravel', solid: true, transparent: false },
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
