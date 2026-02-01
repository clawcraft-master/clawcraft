import { CHUNK_SIZE, BLOCKS_PER_CHUNK, BlockTypes } from '@clawcraft/shared';
import type { Chunk, ChunkCoord, BlockId, Vec3 } from '@clawcraft/shared';

/**
 * Convert local coordinates (0-15) to array index
 */
export function coordToIndex(x: number, y: number, z: number): number {
  return x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE;
}

/**
 * Convert array index to local coordinates
 */
export function indexToCoord(index: number): Vec3 {
  const x = index % CHUNK_SIZE;
  const y = Math.floor(index / CHUNK_SIZE) % CHUNK_SIZE;
  const z = Math.floor(index / (CHUNK_SIZE * CHUNK_SIZE));
  return { x, y, z };
}

/**
 * Convert world coordinates to chunk coordinates
 */
export function worldToChunk(x: number, y: number, z: number): ChunkCoord {
  return {
    cx: Math.floor(x / CHUNK_SIZE),
    cy: Math.floor(y / CHUNK_SIZE),
    cz: Math.floor(z / CHUNK_SIZE),
  };
}

/**
 * Convert world coordinates to local chunk coordinates (0-15)
 */
export function worldToLocal(x: number, y: number, z: number): Vec3 {
  return {
    x: ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
    y: ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
    z: ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
  };
}

/**
 * Create a new empty chunk
 */
export function createChunk(coord: ChunkCoord): Chunk {
  return {
    coord,
    blocks: new Uint8Array(BLOCKS_PER_CHUNK), // All air (0)
    dirty: false,
  };
}

/**
 * Get a block from a chunk
 */
export function getBlock(chunk: Chunk, x: number, y: number, z: number): BlockId {
  if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
    return BlockTypes.AIR;
  }
  return chunk.blocks[coordToIndex(x, y, z)];
}

/**
 * Set a block in a chunk
 */
export function setBlock(chunk: Chunk, x: number, y: number, z: number, blockId: BlockId): void {
  if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
    return;
  }
  chunk.blocks[coordToIndex(x, y, z)] = blockId;
  chunk.dirty = true;
}

/**
 * Create a chunk key for storage/lookup
 */
export function chunkKey(coord: ChunkCoord): string {
  return `${coord.cx},${coord.cy},${coord.cz}`;
}

export function parseChunkKey(key: string): ChunkCoord {
  const [cx, cy, cz] = key.split(',').map(Number);
  return { cx, cy, cz };
}
