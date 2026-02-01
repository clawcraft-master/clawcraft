import { CHUNK_SIZE, BlockTypes, WORLD_HEIGHT } from '@clawcraft/shared';
import type { Chunk, ChunkCoord } from '@clawcraft/shared';
import { createChunk, setBlock } from './chunk';
import { SimplexNoise } from './noise';

export interface GeneratorConfig {
  seed: number;
  seaLevel: number;
  baseHeight: number;
  heightVariation: number;
}

const DEFAULT_CONFIG: GeneratorConfig = {
  seed: 42,
  seaLevel: 64,
  baseHeight: 64,
  heightVariation: 32,
};

/**
 * Generates terrain for a chunk
 */
export class TerrainGenerator {
  private noise: SimplexNoise;
  private config: GeneratorConfig;

  constructor(config: Partial<GeneratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.noise = new SimplexNoise(this.config.seed);
  }

  /**
   * Get terrain height at world coordinates
   */
  getHeightAt(worldX: number, worldZ: number): number {
    const scale = 0.01; // Larger = smoother terrain
    const height = this.noise.fbm(worldX * scale, worldZ * scale, 4);
    return Math.floor(this.config.baseHeight + height * this.config.heightVariation);
  }

  /**
   * Generate a chunk at the given coordinates
   */
  generateChunk(coord: ChunkCoord): Chunk {
    const chunk = createChunk(coord);
    const worldBaseX = coord.cx * CHUNK_SIZE;
    const worldBaseY = coord.cy * CHUNK_SIZE;
    const worldBaseZ = coord.cz * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const worldX = worldBaseX + lx;
        const worldZ = worldBaseZ + lz;
        const terrainHeight = this.getHeightAt(worldX, worldZ);

        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
          const worldY = worldBaseY + ly;
          const blockType = this.getBlockAt(worldY, terrainHeight);
          if (blockType !== BlockTypes.AIR) {
            setBlock(chunk, lx, ly, lz, blockType);
          }
        }
      }
    }

    // Add trees occasionally
    if (coord.cy >= 0 && coord.cy <= Math.ceil(this.config.baseHeight / CHUNK_SIZE) + 2) {
      this.addTrees(chunk, worldBaseX, worldBaseY, worldBaseZ);
    }

    chunk.dirty = false; // Fresh chunk isn't dirty
    return chunk;
  }

  private getBlockAt(worldY: number, terrainHeight: number): number {
    if (worldY === 0) {
      return BlockTypes.BEDROCK;
    }
    if (worldY < terrainHeight - 4) {
      return BlockTypes.STONE;
    }
    if (worldY < terrainHeight) {
      return BlockTypes.DIRT;
    }
    if (worldY === terrainHeight) {
      if (terrainHeight < this.config.seaLevel - 2) {
        return BlockTypes.SAND;
      }
      return BlockTypes.GRASS;
    }
    if (worldY <= this.config.seaLevel && terrainHeight < this.config.seaLevel) {
      return BlockTypes.WATER;
    }
    return BlockTypes.AIR;
  }

  private addTrees(chunk: Chunk, worldBaseX: number, worldBaseY: number, worldBaseZ: number): void {
    // Deterministic tree placement based on position
    const treeNoise = new SimplexNoise(this.config.seed + 1000);
    
    for (let lx = 2; lx < CHUNK_SIZE - 2; lx += 5) {
      for (let lz = 2; lz < CHUNK_SIZE - 2; lz += 5) {
        const worldX = worldBaseX + lx;
        const worldZ = worldBaseZ + lz;
        
        // Check if tree should spawn here
        const treeValue = treeNoise.noise2D(worldX * 0.1, worldZ * 0.1);
        if (treeValue < 0.3) continue;

        const terrainHeight = this.getHeightAt(worldX, worldZ);
        
        // Only on grass, not underwater
        if (terrainHeight <= this.config.seaLevel) continue;
        
        const treeBaseY = terrainHeight + 1 - worldBaseY;
        
        // Check if tree fits in this chunk
        if (treeBaseY < 0 || treeBaseY >= CHUNK_SIZE - 5) continue;

        this.placeTree(chunk, lx, treeBaseY, lz);
      }
    }
  }

  private placeTree(chunk: Chunk, x: number, y: number, z: number): void {
    const trunkHeight = 4 + Math.floor(Math.random() * 2);

    // Trunk
    for (let i = 0; i < trunkHeight; i++) {
      if (y + i < CHUNK_SIZE) {
        setBlock(chunk, x, y + i, z, BlockTypes.WOOD);
      }
    }

    // Leaves (simple sphere-ish)
    const leafStart = y + trunkHeight - 1;
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          if (dy === 2 && (Math.abs(dx) > 1 || Math.abs(dz) > 1)) continue;
          
          const lx = x + dx;
          const ly = leafStart + dy;
          const lz = z + dz;
          
          if (lx >= 0 && lx < CHUNK_SIZE && ly >= 0 && ly < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
            if (!(dx === 0 && dz === 0 && dy < 2)) { // Don't overwrite trunk
              setBlock(chunk, lx, ly, lz, BlockTypes.LEAVES);
            }
          }
        }
      }
    }
  }
}
