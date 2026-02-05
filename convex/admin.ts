import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { generateChunk, CHUNK_SIZE } from "./lib/terrain";

/**
 * Admin functions for world management
 */

// ============================================================================
// QUERIES
// ============================================================================

/** Get world statistics */
export const getWorldStats = query({
  args: {},
  handler: async (ctx) => {
    const chunks = await ctx.db.query("chunks").collect();
    const agents = await ctx.db.query("agents").collect();
    
    // Calculate bounds
    let minCx = Infinity, maxCx = -Infinity;
    let minCy = Infinity, maxCy = -Infinity;
    let minCz = Infinity, maxCz = -Infinity;
    
    for (const chunk of chunks) {
      minCx = Math.min(minCx, chunk.cx);
      maxCx = Math.max(maxCx, chunk.cx);
      minCy = Math.min(minCy, chunk.cy);
      maxCy = Math.max(maxCy, chunk.cy);
      minCz = Math.min(minCz, chunk.cz);
      maxCz = Math.max(maxCz, chunk.cz);
    }
    
    return {
      totalChunks: chunks.length,
      totalAgents: agents.length,
      bounds: chunks.length > 0 ? {
        chunks: { minCx, maxCx, minCy, maxCy, minCz, maxCz },
        blocks: {
          minX: minCx * CHUNK_SIZE,
          maxX: (maxCx + 1) * CHUNK_SIZE - 1,
          minY: minCy * CHUNK_SIZE,
          maxY: (maxCy + 1) * CHUNK_SIZE - 1,
          minZ: minCz * CHUNK_SIZE,
          maxZ: (maxCz + 1) * CHUNK_SIZE - 1,
        }
      } : null,
    };
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/** Clear all chunks (deletes everything, terrain will regenerate) */
export const clearAllChunks = mutation({
  args: {},
  handler: async (ctx) => {
    const chunks = await ctx.db.query("chunks").collect();
    
    let deleted = 0;
    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
      deleted++;
    }
    
    return { deleted, message: `Deleted ${deleted} chunks. Terrain will regenerate on next access.` };
  },
});

/** Pre-generate terrain in a region around spawn
 * radius: number of chunks in each direction (e.g., 5 = 11x11 chunks = 176x176 blocks)
 */
export const pregenerateTerrain = mutation({
  args: {
    radius: v.number(), // chunks in each direction
    centerX: v.optional(v.number()),
    centerZ: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const radius = Math.min(args.radius, 10); // Max 10 chunks radius to avoid timeout
    const centerX = args.centerX ?? 0;
    const centerZ = args.centerZ ?? 0;
    
    // Calculate center chunk
    const centerCx = Math.floor(centerX / CHUNK_SIZE);
    const centerCz = Math.floor(centerZ / CHUNK_SIZE);
    
    let generated = 0;
    let skipped = 0;
    
    // Generate chunks in the region
    // Y range: -1 to 6 (covers y=-16 to y=112, enough for terrain)
    const minCy = -1;
    const maxCy = 6;
    
    for (let cx = centerCx - radius; cx <= centerCx + radius; cx++) {
      for (let cz = centerCz - radius; cz <= centerCz + radius; cz++) {
        for (let cy = minCy; cy <= maxCy; cy++) {
          const key = `${cx},${cy},${cz}`;
          
          // Check if chunk exists
          const existing = await ctx.db
            .query("chunks")
            .withIndex("by_key", q => q.eq("key", key))
            .unique();
          
          if (existing) {
            skipped++;
            continue;
          }
          
          // Generate new chunk with solid terrain
          const blocksBase64 = generateChunk(cx, cy, cz);
          
          await ctx.db.insert("chunks", {
            key,
            cx,
            cy,
            cz,
            blocksBase64,
            modifiedAt: Date.now(),
          });
          
          generated++;
        }
      }
    }
    
    const totalChunks = (radius * 2 + 1) * (radius * 2 + 1) * (maxCy - minCy + 1);
    const blockRadius = (radius * 2 + 1) * CHUNK_SIZE / 2;
    
    return {
      generated,
      skipped,
      total: totalChunks,
      coverage: {
        chunks: `${radius * 2 + 1}x${radius * 2 + 1} chunks (${maxCy - minCy + 1} vertical layers)`,
        blocks: `${(radius * 2 + 1) * CHUNK_SIZE}x${(radius * 2 + 1) * CHUNK_SIZE} blocks`,
        center: { x: centerX, z: centerZ },
        radius: blockRadius,
      },
    };
  },
});

/** Regenerate all existing chunks with fresh terrain
 * Warning: This will OVERWRITE all player builds!
 */
export const regenerateAllChunks = mutation({
  args: {
    confirm: v.literal("I_UNDERSTAND_THIS_DELETES_BUILDS"),
  },
  handler: async (ctx, args) => {
    const chunks = await ctx.db.query("chunks").collect();
    
    let regenerated = 0;
    for (const chunk of chunks) {
      // Generate fresh terrain
      const blocksBase64 = generateChunk(chunk.cx, chunk.cy, chunk.cz);
      
      // Update chunk
      await ctx.db.patch(chunk._id, {
        blocksBase64,
        modifiedAt: Date.now(),
      });
      
      regenerated++;
    }
    
    return { regenerated, message: `Regenerated ${regenerated} chunks with fresh terrain.` };
  },
});

/** Reset world: clear chunks and pre-generate fresh terrain */
export const resetWorld = mutation({
  args: {
    confirm: v.literal("RESET_WORLD"),
    radius: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const radius = Math.min(args.radius ?? 8, 10);
    
    // Step 1: Delete all existing chunks
    const chunks = await ctx.db.query("chunks").collect();
    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
    }
    const deleted = chunks.length;
    
    // Step 2: Pre-generate fresh terrain
    const centerCx = 0;
    const centerCz = 0;
    const minCy = -1;
    const maxCy = 6;
    
    let generated = 0;
    
    for (let cx = centerCx - radius; cx <= centerCx + radius; cx++) {
      for (let cz = centerCz - radius; cz <= centerCz + radius; cz++) {
        for (let cy = minCy; cy <= maxCy; cy++) {
          const key = `${cx},${cy},${cz}`;
          const blocksBase64 = generateChunk(cx, cy, cz);
          
          await ctx.db.insert("chunks", {
            key,
            cx,
            cy,
            cz,
            blocksBase64,
            modifiedAt: Date.now(),
          });
          
          generated++;
        }
      }
    }
    
    return {
      deleted,
      generated,
      coverage: {
        chunks: `${radius * 2 + 1}x${radius * 2 + 1} (${minCy} to ${maxCy} Y)`,
        blocks: `${(radius * 2 + 1) * CHUNK_SIZE}x${(radius * 2 + 1) * CHUNK_SIZE}`,
        center: { x: 0, z: 0 },
      },
      message: `World reset! Deleted ${deleted} old chunks, generated ${generated} new chunks with solid terrain.`,
    };
  },
});
