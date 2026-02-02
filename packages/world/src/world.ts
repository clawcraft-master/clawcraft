import * as fs from 'fs';
import * as path from 'path';
import type { Chunk, ChunkCoord, Vec3, BlockId, Agent } from '@clawcraft/shared';
import { BlockTypes, BlockDefinitions, CHUNK_SIZE } from '@clawcraft/shared';
import { chunkKey, parseChunkKey, worldToChunk, worldToLocal, getBlock, setBlock, createChunk } from './chunk';
import { TerrainGenerator, GeneratorConfig } from './generator';

export interface WorldConfig {
  generator?: Partial<GeneratorConfig>;
  loadDistance?: number; // Chunks to keep loaded around agents
  savePath?: string; // Path to save world data
}

/**
 * The World manages all chunks and entities
 */
export class World {
  private chunks: Map<string, Chunk> = new Map();
  private modifiedChunks: Set<string> = new Set(); // Track which chunks have player modifications
  private generator: TerrainGenerator;
  private loadDistance: number;
  private savePath: string;

  constructor(config: WorldConfig = {}) {
    this.generator = new TerrainGenerator(config.generator);
    this.loadDistance = config.loadDistance ?? 4;
    this.savePath = config.savePath ?? './world-data';
    
    // Load saved world data
    this.loadWorld();
  }

  /**
   * Get or generate a chunk
   */
  getChunk(coord: ChunkCoord): Chunk {
    const key = chunkKey(coord);
    let chunk = this.chunks.get(key);
    
    if (!chunk) {
      chunk = this.generator.generateChunk(coord);
      this.chunks.set(key, chunk);
    }
    
    return chunk;
  }

  /**
   * Get block at world coordinates
   */
  getBlockAt(x: number, y: number, z: number): BlockId {
    const chunkCoord = worldToChunk(x, y, z);
    const chunk = this.getChunk(chunkCoord);
    const local = worldToLocal(x, y, z);
    return getBlock(chunk, local.x, local.y, local.z);
  }

  /**
   * Set block at world coordinates
   */
  setBlockAt(x: number, y: number, z: number, blockId: BlockId): boolean {
    // Can't break bedrock
    if (blockId === BlockTypes.AIR && this.getBlockAt(x, y, z) === BlockTypes.BEDROCK) {
      return false;
    }

    const chunkCoord = worldToChunk(x, y, z);
    const chunk = this.getChunk(chunkCoord);
    const local = worldToLocal(x, y, z);
    setBlock(chunk, local.x, local.y, local.z, blockId);
    
    // Track this chunk as modified
    const key = chunkKey(chunkCoord);
    this.modifiedChunks.add(key);
    
    return true;
  }

  /**
   * Check if a position is solid (for collision)
   */
  isSolid(x: number, y: number, z: number): boolean {
    const blockId = this.getBlockAt(Math.floor(x), Math.floor(y), Math.floor(z));
    const def = BlockDefinitions[blockId];
    return def?.solid ?? false;
  }

  /**
   * Get chunks around a position
   */
  getChunksAround(position: Vec3, distance?: number): Chunk[] {
    const d = distance ?? this.loadDistance;
    const center = worldToChunk(position.x, position.y, position.z);
    const chunks: Chunk[] = [];

    for (let cx = center.cx - d; cx <= center.cx + d; cx++) {
      for (let cy = Math.max(0, center.cy - d); cy <= center.cy + d; cy++) {
        for (let cz = center.cz - d; cz <= center.cz + d; cz++) {
          chunks.push(this.getChunk({ cx, cy, cz }));
        }
      }
    }

    return chunks;
  }

  /**
   * Get all loaded chunks
   */
  getLoadedChunks(): Chunk[] {
    return Array.from(this.chunks.values());
  }

  /**
   * Get dirty chunks (modified since last sync)
   */
  getDirtyChunks(): Chunk[] {
    return this.getLoadedChunks().filter(c => c.dirty);
  }

  /**
   * Mark all chunks as clean
   */
  markAllClean(): void {
    for (const chunk of this.chunks.values()) {
      chunk.dirty = false;
    }
  }

  /**
   * Find spawn point (on the spawn platform near origin)
   */
  findSpawnPoint(): Vec3 {
    // Random position within spawn platform
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 5;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    
    // Find ground level
    for (let y = 128; y > 0; y--) {
      if (this.isSolid(x, y, z) && !this.isSolid(x, y + 1, z) && !this.isSolid(x, y + 2, z)) {
        return { x: x + 0.5, y: y + 1, z: z + 0.5 };
      }
    }
    
    return { x: 0.5, y: 65, z: 0.5 };
  }

  /**
   * Raycast to find block player is looking at
   */
  raycast(origin: Vec3, direction: Vec3, maxDistance: number = 5): { hit: Vec3; normal: Vec3 } | null {
    const step = 0.1;
    const pos = { ...origin };
    const dir = {
      x: direction.x * step,
      y: direction.y * step,
      z: direction.z * step,
    };

    for (let d = 0; d < maxDistance; d += step) {
      pos.x += dir.x;
      pos.y += dir.y;
      pos.z += dir.z;

      if (this.isSolid(pos.x, pos.y, pos.z)) {
        // Simple normal calculation
        const blockPos = {
          x: Math.floor(pos.x),
          y: Math.floor(pos.y),
          z: Math.floor(pos.z),
        };
        
        // Determine which face was hit
        const prevPos = {
          x: pos.x - dir.x,
          y: pos.y - dir.y,
          z: pos.z - dir.z,
        };
        
        const normal = { x: 0, y: 0, z: 0 };
        if (Math.floor(prevPos.x) !== blockPos.x) normal.x = prevPos.x < blockPos.x ? -1 : 1;
        else if (Math.floor(prevPos.y) !== blockPos.y) normal.y = prevPos.y < blockPos.y ? -1 : 1;
        else if (Math.floor(prevPos.z) !== blockPos.z) normal.z = prevPos.z < blockPos.z ? -1 : 1;

        return { hit: blockPos, normal };
      }
    }

    return null;
  }

  /**
   * Save modified chunks to disk
   */
  saveWorld(): void {
    if (this.modifiedChunks.size === 0) {
      return;
    }

    try {
      // Ensure save directory exists
      if (!fs.existsSync(this.savePath)) {
        fs.mkdirSync(this.savePath, { recursive: true });
      }

      // Save each modified chunk
      for (const key of this.modifiedChunks) {
        const chunk = this.chunks.get(key);
        if (chunk) {
          const filePath = path.join(this.savePath, `chunk_${key.replace(/,/g, '_')}.json`);
          const data = {
            coord: chunk.coord,
            blocks: Array.from(chunk.blocks), // Convert Uint8Array to regular array
          };
          fs.writeFileSync(filePath, JSON.stringify(data));
        }
      }

      console.log(`Saved ${this.modifiedChunks.size} modified chunks`);
      this.modifiedChunks.clear();
    } catch (err) {
      console.error('Failed to save world:', err);
    }
  }

  /**
   * Load saved chunks from disk
   */
  loadWorld(): void {
    try {
      if (!fs.existsSync(this.savePath)) {
        console.log('No saved world data found, starting fresh');
        return;
      }

      const files = fs.readdirSync(this.savePath).filter(f => f.startsWith('chunk_') && f.endsWith('.json'));
      let loaded = 0;

      for (const file of files) {
        try {
          const filePath = path.join(this.savePath, file);
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          
          // Create chunk from saved data
          const chunk = createChunk(data.coord);
          chunk.blocks = new Uint8Array(data.blocks);
          chunk.dirty = false;
          
          const key = chunkKey(data.coord);
          this.chunks.set(key, chunk);
          loaded++;
        } catch (err) {
          console.error(`Failed to load chunk ${file}:`, err);
        }
      }

      if (loaded > 0) {
        console.log(`Loaded ${loaded} saved chunks`);
      }
    } catch (err) {
      console.error('Failed to load world:', err);
    }
  }

  /**
   * Get count of modified chunks waiting to be saved
   */
  getModifiedCount(): number {
    return this.modifiedChunks.size;
  }
}
