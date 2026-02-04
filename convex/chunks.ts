import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { generateChunk } from "./lib/terrain";

// ============================================================================
// QUERIES
// ============================================================================

/** Get a single chunk by key (returns null if not exists) */
export const get = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chunks")
      .withIndex("by_key", q => q.eq("key", args.key))
      .unique();
  },
});

/** Get multiple chunks by keys */
export const getMany = query({
  args: { keys: v.array(v.string()) },
  handler: async (ctx, args) => {
    const chunks = await Promise.all(
      args.keys.map(key =>
        ctx.db
          .query("chunks")
          .withIndex("by_key", q => q.eq("key", key))
          .unique()
      )
    );
    const result: Record<string, typeof chunks[0]> = {};
    for (let i = 0; i < args.keys.length; i++) {
      if (chunks[i]) {
        result[args.keys[i]] = chunks[i];
      }
    }
    return result;
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/** Get or generate a chunk - returns existing or creates new terrain */
export const getOrGenerate = mutation({
  args: {
    key: v.string(),
    cx: v.number(),
    cy: v.number(),
    cz: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if chunk exists
    const existing = await ctx.db
      .query("chunks")
      .withIndex("by_key", q => q.eq("key", args.key))
      .unique();

    if (existing) {
      return existing;
    }

    // Generate new chunk
    const blocksBase64 = generateChunk(args.cx, args.cy, args.cz);

    // Save to database
    const id = await ctx.db.insert("chunks", {
      key: args.key,
      cx: args.cx,
      cy: args.cy,
      cz: args.cz,
      blocksBase64,
      modifiedAt: Date.now(),
    });

    return {
      _id: id,
      key: args.key,
      cx: args.cx,
      cy: args.cy,
      cz: args.cz,
      blocksBase64,
      modifiedAt: Date.now(),
    };
  },
});

/** Get or generate multiple chunks at once */
export const getOrGenerateMany = mutation({
  args: {
    coords: v.array(v.object({
      key: v.string(),
      cx: v.number(),
      cy: v.number(),
      cz: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const results: Record<string, {
      _id: any;
      key: string;
      cx: number;
      cy: number;
      cz: number;
      blocksBase64: string;
      modifiedAt: number;
    }> = {};

    for (const coord of args.coords) {
      // Check if exists
      const existing = await ctx.db
        .query("chunks")
        .withIndex("by_key", q => q.eq("key", coord.key))
        .unique();

      if (existing) {
        results[coord.key] = existing;
      } else {
        // Generate and save
        const blocksBase64 = generateChunk(coord.cx, coord.cy, coord.cz);
        const id = await ctx.db.insert("chunks", {
          key: coord.key,
          cx: coord.cx,
          cy: coord.cy,
          cz: coord.cz,
          blocksBase64,
          modifiedAt: Date.now(),
        });

        results[coord.key] = {
          _id: id,
          key: coord.key,
          cx: coord.cx,
          cy: coord.cy,
          cz: coord.cz,
          blocksBase64,
          modifiedAt: Date.now(),
        };
      }
    }

    return results;
  },
});

/** Save or update a chunk */
export const save = mutation({
  args: {
    key: v.string(),
    cx: v.number(),
    cy: v.number(),
    cz: v.number(),
    blocksBase64: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("chunks")
      .withIndex("by_key", q => q.eq("key", args.key))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        blocksBase64: args.blocksBase64,
        modifiedAt: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("chunks", {
        key: args.key,
        cx: args.cx,
        cy: args.cy,
        cz: args.cz,
        blocksBase64: args.blocksBase64,
        modifiedAt: Date.now(),
      });
    }
  },
});
