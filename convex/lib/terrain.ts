/**
 * Terrain generator for Convex
 * Generates chunks on-demand with deterministic noise
 */

import { SimplexNoise } from "./noise";

// Constants (mirrored from shared)
export const CHUNK_SIZE = 16;
export const BLOCKS_PER_CHUNK = CHUNK_SIZE ** 3;

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
} as const;

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
 * Generate a chunk and return it as base64-encoded blocks
 */
export function generateChunk(
  cx: number,
  cy: number,
  cz: number,
  config: Partial<GeneratorConfig> = {}
): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const noise = new SimplexNoise(cfg.seed);
  const treeNoise = new SimplexNoise(cfg.seed + 1000);
  const vegetationNoise = new SimplexNoise(cfg.seed + 2000);

  const blocks = new Uint8Array(BLOCKS_PER_CHUNK);
  const worldBaseX = cx * CHUNK_SIZE;
  const worldBaseY = cy * CHUNK_SIZE;
  const worldBaseZ = cz * CHUNK_SIZE;

  // Generate terrain
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const worldX = worldBaseX + lx;
      const worldZ = worldBaseZ + lz;
      const terrainHeight = getHeightAt(noise, worldX, worldZ, cfg);

      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        const worldY = worldBaseY + ly;
        const blockType = getBlockAt(worldY, terrainHeight, cfg);
        if (blockType !== BlockTypes.AIR) {
          const index = lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE;
          blocks[index] = blockType;
        }
      }
    }
  }

  // Add spawn platform near origin
  addSpawnPlatform(blocks, worldBaseX, worldBaseY, worldBaseZ, cfg);

  // Add trees and vegetation
  if (cy >= 0 && cy <= Math.ceil(cfg.baseHeight / CHUNK_SIZE) + 2) {
    addTrees(blocks, noise, treeNoise, worldBaseX, worldBaseY, worldBaseZ, cfg);
    addVegetation(blocks, noise, vegetationNoise, worldBaseX, worldBaseY, worldBaseZ, cfg);
  }

  // Encode to base64
  return btoa(String.fromCharCode(...blocks));
}

function getHeightAt(
  noise: SimplexNoise,
  worldX: number,
  worldZ: number,
  cfg: GeneratorConfig
): number {
  const scale = 0.01;
  const height = noise.fbm(worldX * scale, worldZ * scale, 4);
  return Math.floor(cfg.baseHeight + height * cfg.heightVariation);
}

function getBlockAt(worldY: number, terrainHeight: number, cfg: GeneratorConfig): number {
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
    if (terrainHeight < cfg.seaLevel - 2) {
      return BlockTypes.SAND;
    }
    return BlockTypes.GRASS;
  }
  if (worldY <= cfg.seaLevel && terrainHeight < cfg.seaLevel) {
    return BlockTypes.WATER;
  }
  return BlockTypes.AIR;
}

function setBlock(blocks: Uint8Array, lx: number, ly: number, lz: number, blockType: number): void {
  if (lx >= 0 && lx < CHUNK_SIZE && ly >= 0 && ly < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
    const index = lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE;
    blocks[index] = blockType;
  }
}

function addSpawnPlatform(
  blocks: Uint8Array,
  worldBaseX: number,
  worldBaseY: number,
  worldBaseZ: number,
  cfg: GeneratorConfig
): void {
  const spawnY = cfg.baseHeight;
  const platformRadius = 8;

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const worldX = worldBaseX + lx;
      const worldZ = worldBaseZ + lz;
      const dist = Math.sqrt(worldX * worldX + worldZ * worldZ);

      if (dist <= platformRadius) {
        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
          const worldY = worldBaseY + ly;

          if (worldY === spawnY) {
            const checker = (Math.abs(worldX) + Math.abs(worldZ)) % 2 === 0;
            setBlock(blocks, lx, ly, lz, checker ? BlockTypes.STONE : BlockTypes.DIRT);
          } else if (worldY > spawnY && worldY < spawnY + 10) {
            setBlock(blocks, lx, ly, lz, BlockTypes.AIR);
          }
        }
      }
    }
  }

  // Corner pillars
  const pillarPositions: [number, number][] = [
    [-6, -6], [-6, 6], [6, -6], [6, 6]
  ];

  for (const [px, pz] of pillarPositions) {
    const lx = px - worldBaseX;
    const lz = pz - worldBaseZ;

    if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
      for (let h = 1; h <= 4; h++) {
        const ly = spawnY + h - worldBaseY;
        if (ly >= 0 && ly < CHUNK_SIZE) {
          setBlock(blocks, lx, ly, lz, BlockTypes.WOOD);
        }
      }
      const topY = spawnY + 5 - worldBaseY;
      if (topY >= 0 && topY < CHUNK_SIZE) {
        setBlock(blocks, lx, topY, lz, BlockTypes.LEAVES);
      }
    }
  }

  // Center beacon
  const centerX = 0 - worldBaseX;
  const centerZ = 0 - worldBaseZ;
  if (centerX >= 0 && centerX < CHUNK_SIZE && centerZ >= 0 && centerZ < CHUNK_SIZE) {
    for (let h = 1; h <= 8; h++) {
      const ly = spawnY + h - worldBaseY;
      if (ly >= 0 && ly < CHUNK_SIZE) {
        setBlock(blocks, centerX, ly, centerZ, h <= 2 ? BlockTypes.STONE : BlockTypes.LEAVES);
      }
    }
  }
}

function addTrees(
  blocks: Uint8Array,
  noise: SimplexNoise,
  treeNoise: SimplexNoise,
  worldBaseX: number,
  worldBaseY: number,
  worldBaseZ: number,
  cfg: GeneratorConfig
): void {
  // Use deterministic seeded random for tree heights
  const seededRandom = (x: number, z: number) => {
    const n = Math.sin(x * 12.9898 + z * 78.233 + cfg.seed) * 43758.5453;
    return n - Math.floor(n);
  };

  for (let lx = 2; lx < CHUNK_SIZE - 2; lx += 5) {
    for (let lz = 2; lz < CHUNK_SIZE - 2; lz += 5) {
      const worldX = worldBaseX + lx;
      const worldZ = worldBaseZ + lz;

      // Skip spawn area
      if (Math.abs(worldX) <= 10 && Math.abs(worldZ) <= 10) continue;

      const treeValue = treeNoise.noise2D(worldX * 0.1, worldZ * 0.1);
      if (treeValue < 0.3) continue;

      const terrainHeight = getHeightAt(noise, worldX, worldZ, cfg);
      if (terrainHeight <= cfg.seaLevel) continue;

      const treeBaseY = terrainHeight + 1 - worldBaseY;
      if (treeBaseY < 0 || treeBaseY >= CHUNK_SIZE - 5) continue;

      const trunkHeight = 4 + Math.floor(seededRandom(worldX, worldZ) * 2);

      // Trunk
      for (let i = 0; i < trunkHeight; i++) {
        if (treeBaseY + i < CHUNK_SIZE) {
          setBlock(blocks, lx, treeBaseY + i, lz, BlockTypes.WOOD);
        }
      }

      // Leaves
      const leafStart = treeBaseY + trunkHeight - 1;
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          for (let dz = -2; dz <= 2; dz++) {
            if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
            if (dy === 2 && (Math.abs(dx) > 1 || Math.abs(dz) > 1)) continue;

            const nlx = lx + dx;
            const nly = leafStart + dy;
            const nlz = lz + dz;

            if (nlx >= 0 && nlx < CHUNK_SIZE && nly >= 0 && nly < CHUNK_SIZE && nlz >= 0 && nlz < CHUNK_SIZE) {
              if (!(dx === 0 && dz === 0 && dy < 2)) {
                setBlock(blocks, nlx, nly, nlz, BlockTypes.LEAVES);
              }
            }
          }
        }
      }
    }
  }
}

function addVegetation(
  blocks: Uint8Array,
  noise: SimplexNoise,
  vegetationNoise: SimplexNoise,
  worldBaseX: number,
  worldBaseY: number,
  worldBaseZ: number,
  cfg: GeneratorConfig
): void {
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const worldX = worldBaseX + lx;
      const worldZ = worldBaseZ + lz;

      // Skip spawn area
      if (Math.abs(worldX) <= 10 && Math.abs(worldZ) <= 10) continue;

      const terrainHeight = getHeightAt(noise, worldX, worldZ, cfg);
      if (terrainHeight <= cfg.seaLevel) continue;

      const vegetationY = terrainHeight + 1 - worldBaseY;
      if (vegetationY < 0 || vegetationY >= CHUNK_SIZE) continue;

      const value = vegetationNoise.noise2D(worldX * 0.3, worldZ * 0.3);

      if (value > 0.2 && value < 0.6) {
        setBlock(blocks, lx, vegetationY, lz, BlockTypes.TALL_GRASS);
      } else if (value >= 0.6) {
        const flowerType = value > 0.75 ? BlockTypes.FLOWER_RED : BlockTypes.FLOWER_YELLOW;
        setBlock(blocks, lx, vegetationY, lz, flowerType);
      }
    }
  }
}
