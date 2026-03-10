/**
 * Terrain generator for Convex
 * Generates chunks on-demand with deterministic noise
 * Now with BIOMES!
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
  GLASS: 12,
  BRICK: 13,
  COBBLESTONE: 14,
  PLANKS: 15,
  SNOW: 23,
  ICE: 24,
  CACTUS: 41,
  DEAD_BUSH: 42,
  GRAVEL: 43,
} as const;

// Biome types
export const Biomes = {
  PLAINS: 0,
  DESERT: 1,
  FOREST: 2,
  MOUNTAINS: 3,
  OCEAN: 4,
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
  const biomeNoise = new SimplexNoise(cfg.seed + 3000);
  const biomeNoise2 = new SimplexNoise(cfg.seed + 4000);

  const blocks = new Uint8Array(BLOCKS_PER_CHUNK);
  const worldBaseX = cx * CHUNK_SIZE;
  const worldBaseY = cy * CHUNK_SIZE;
  const worldBaseZ = cz * CHUNK_SIZE;

  // Generate terrain with biomes
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const worldX = worldBaseX + lx;
      const worldZ = worldBaseZ + lz;
      
      // Determine biome
      const biome = getBiomeAt(biomeNoise, biomeNoise2, worldX, worldZ);
      
      // Get terrain height based on biome
      const terrainHeight = getHeightAtWithBiome(noise, worldX, worldZ, biome, cfg);

      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        const worldY = worldBaseY + ly;
        const blockType = getBlockAtWithBiome(worldY, terrainHeight, biome, cfg);
        if (blockType !== BlockTypes.AIR) {
          const index = lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE;
          blocks[index] = blockType;
        }
      }
    }
  }

  // Add spawn platform near origin
  addSpawnPlatform(blocks, worldBaseX, worldBaseY, worldBaseZ, cfg);

  // Add biome-specific features
  if (cy >= 0 && cy <= Math.ceil(cfg.baseHeight / CHUNK_SIZE) + 2) {
    addBiomeFeatures(blocks, noise, treeNoise, vegetationNoise, biomeNoise, biomeNoise2, worldBaseX, worldBaseY, worldBaseZ, cfg);
  }

  // Encode to base64
  return btoa(String.fromCharCode(...blocks));
}

/**
 * Determine biome based on temperature and moisture noise
 */
function getBiomeAt(biomeNoise: SimplexNoise, biomeNoise2: SimplexNoise, worldX: number, worldZ: number): number {
  const scale = 0.005; // Large biome regions
  const temperature = biomeNoise.noise2D(worldX * scale, worldZ * scale);
  const moisture = biomeNoise2.noise2D(worldX * scale + 1000, worldZ * scale + 1000);
  
  // Biome selection based on temperature and moisture
  if (temperature < -0.3) {
    return Biomes.MOUNTAINS; // Cold = mountains
  } else if (temperature > 0.4 && moisture < -0.2) {
    return Biomes.DESERT; // Hot and dry = desert
  } else if (moisture > 0.3) {
    return Biomes.FOREST; // Wet = forest
  } else if (moisture < -0.5) {
    return Biomes.OCEAN; // Very dry at low temp = ocean
  } else {
    return Biomes.PLAINS; // Default
  }
}

function getHeightAtWithBiome(
  noise: SimplexNoise,
  worldX: number,
  worldZ: number,
  biome: number,
  cfg: GeneratorConfig
): number {
  const scale = 0.01;
  const baseNoise = noise.fbm(worldX * scale, worldZ * scale, 4);
  
  let height: number;
  
  switch (biome) {
    case Biomes.MOUNTAINS:
      // Taller, more dramatic terrain
      const mountainNoise = noise.fbm(worldX * scale * 2, worldZ * scale * 2, 6);
      height = cfg.baseHeight + (baseNoise + mountainNoise) * cfg.heightVariation * 1.5;
      break;
      
    case Biomes.OCEAN:
      // Below sea level
      height = cfg.seaLevel - 8 + baseNoise * 10;
      break;
      
    case Biomes.DESERT:
      // Flat with gentle dunes
      height = cfg.baseHeight - 2 + baseNoise * cfg.heightVariation * 0.3;
      break;
      
    case Biomes.FOREST:
      // Slightly hilly
      height = cfg.baseHeight + baseNoise * cfg.heightVariation * 0.8;
      break;
      
    case Biomes.PLAINS:
    default:
      // Normal terrain
      height = cfg.baseHeight + baseNoise * cfg.heightVariation;
      break;
  }
  
  return Math.floor(height);
}

function getBlockAtWithBiome(worldY: number, terrainHeight: number, biome: number, cfg: GeneratorConfig): number {
  if (worldY === 0) {
    return BlockTypes.BEDROCK;
  }
  
  // Deep underground is always stone
  if (worldY < terrainHeight - 4) {
    return BlockTypes.STONE;
  }
  
  // Surface blocks depend on biome
  if (worldY < terrainHeight) {
    // Subsurface
    switch (biome) {
      case Biomes.DESERT:
        return BlockTypes.SAND;
      case Biomes.OCEAN:
        return worldY < cfg.seaLevel - 3 ? BlockTypes.STONE : BlockTypes.SAND;
      case Biomes.MOUNTAINS:
        return worldY > cfg.baseHeight + 20 ? BlockTypes.STONE : BlockTypes.DIRT;
      default:
        return BlockTypes.DIRT;
    }
  }
  
  if (worldY === terrainHeight) {
    // Top surface block
    switch (biome) {
      case Biomes.DESERT:
        return BlockTypes.SAND;
      case Biomes.OCEAN:
        return BlockTypes.SAND;
      case Biomes.MOUNTAINS:
        if (terrainHeight > cfg.baseHeight + 25) {
          return BlockTypes.SNOW;
        } else if (terrainHeight > cfg.baseHeight + 15) {
          return BlockTypes.STONE;
        }
        return BlockTypes.GRASS;
      case Biomes.FOREST:
        return BlockTypes.GRASS;
      case Biomes.PLAINS:
      default:
        if (terrainHeight < cfg.seaLevel - 2) {
          return BlockTypes.SAND;
        }
        return BlockTypes.GRASS;
    }
  }
  
  // Water filling
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

function getBlock(blocks: Uint8Array, lx: number, ly: number, lz: number): number {
  if (lx >= 0 && lx < CHUNK_SIZE && ly >= 0 && ly < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
    const index = lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE;
    return blocks[index] ?? BlockTypes.AIR;
  }
  return BlockTypes.AIR;
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

function addBiomeFeatures(
  blocks: Uint8Array,
  noise: SimplexNoise,
  treeNoise: SimplexNoise,
  vegetationNoise: SimplexNoise,
  biomeNoise: SimplexNoise,
  biomeNoise2: SimplexNoise,
  worldBaseX: number,
  worldBaseY: number,
  worldBaseZ: number,
  cfg: GeneratorConfig
): void {
  // Seeded random for consistent feature placement
  const seededRandom = (x: number, z: number) => {
    const n = Math.sin(x * 12.9898 + z * 78.233 + cfg.seed) * 43758.5453;
    return n - Math.floor(n);
  };

  for (let lx = 2; lx < CHUNK_SIZE - 2; lx += 4) {
    for (let lz = 2; lz < CHUNK_SIZE - 2; lz += 4) {
      const worldX = worldBaseX + lx;
      const worldZ = worldBaseZ + lz;

      // Skip spawn area
      if (Math.abs(worldX) <= 10 && Math.abs(worldZ) <= 10) continue;

      const biome = getBiomeAt(biomeNoise, biomeNoise2, worldX, worldZ);
      const terrainHeight = getHeightAtWithBiome(noise, worldX, worldZ, biome, cfg);
      
      if (terrainHeight <= cfg.seaLevel) continue; // Don't add features underwater

      const featureBaseY = terrainHeight + 1 - worldBaseY;
      if (featureBaseY < 0 || featureBaseY >= CHUNK_SIZE - 5) continue;

      const rand = seededRandom(worldX, worldZ);
      const treeValue = treeNoise.noise2D(worldX * 0.1, worldZ * 0.1);

      switch (biome) {
        case Biomes.FOREST:
          // Dense trees
          if (treeValue > 0.0) { // More trees than default
            addTree(blocks, lx, featureBaseY, lz, rand);
          }
          break;
          
        case Biomes.PLAINS:
          // Normal tree density
          if (treeValue > 0.3) {
            addTree(blocks, lx, featureBaseY, lz, rand);
          }
          break;
          
        case Biomes.DESERT:
          // Cacti and dead bushes
          if (rand > 0.85) {
            addCactus(blocks, lx, featureBaseY, lz, rand);
          } else if (rand > 0.7) {
            setBlock(blocks, lx, featureBaseY, lz, BlockTypes.DEAD_BUSH);
          }
          break;
          
        case Biomes.MOUNTAINS:
          // Sparse trees at lower elevations
          if (terrainHeight < cfg.baseHeight + 15 && treeValue > 0.5) {
            addTree(blocks, lx, featureBaseY, lz, rand);
          }
          break;
      }
    }
  }

  // Add vegetation (flowers, tall grass)
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const worldX = worldBaseX + lx;
      const worldZ = worldBaseZ + lz;

      // Skip spawn area
      if (Math.abs(worldX) <= 10 && Math.abs(worldZ) <= 10) continue;

      const biome = getBiomeAt(biomeNoise, biomeNoise2, worldX, worldZ);
      const terrainHeight = getHeightAtWithBiome(noise, worldX, worldZ, biome, cfg);
      
      if (terrainHeight <= cfg.seaLevel) continue;
      
      // Skip non-grass biomes for flowers
      if (biome === Biomes.DESERT || biome === Biomes.OCEAN) continue;

      const vegetationY = terrainHeight + 1 - worldBaseY;
      if (vegetationY < 0 || vegetationY >= CHUNK_SIZE) continue;

      const value = vegetationNoise.noise2D(worldX * 0.3, worldZ * 0.3);
      
      // More vegetation in forests
      const threshold = biome === Biomes.FOREST ? 0.0 : 0.2;

      if (value > threshold && value < 0.6) {
        setBlock(blocks, lx, vegetationY, lz, BlockTypes.TALL_GRASS);
      } else if (value >= 0.6) {
        const flowerType = value > 0.75 ? BlockTypes.FLOWER_RED : BlockTypes.FLOWER_YELLOW;
        setBlock(blocks, lx, vegetationY, lz, flowerType);
      }
    }
  }
}

function addTree(blocks: Uint8Array, lx: number, baseY: number, lz: number, rand: number): void {
  const trunkHeight = 4 + Math.floor(rand * 2);

  // Trunk
  for (let i = 0; i < trunkHeight; i++) {
    if (baseY + i < CHUNK_SIZE) {
      setBlock(blocks, lx, baseY + i, lz, BlockTypes.WOOD);
    }
  }

  // Leaves
  const leafStart = baseY + trunkHeight - 1;
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

function addCactus(blocks: Uint8Array, lx: number, baseY: number, lz: number, rand: number): void {
  const height = 2 + Math.floor(rand * 2);
  
  for (let i = 0; i < height; i++) {
    if (baseY + i < CHUNK_SIZE) {
      setBlock(blocks, lx, baseY + i, lz, BlockTypes.CACTUS);
    }
  }
}
