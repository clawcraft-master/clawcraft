import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ============================================================================
// QUERIES
// ============================================================================

/** Get a single chunk by key */
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
    // Return as a map for easy lookup
    const result: Record<string, typeof chunks[0]> = {};
    for (let i = 0; i < args.keys.length; i++) {
      if (chunks[i]) {
        result[args.keys[i]] = chunks[i];
      }
    }
    return result;
  },
});

/** Get chunks in a region (for initial load) */
export const getInRegion = query({
  args: {
    minCx: v.number(),
    maxCx: v.number(),
    minCy: v.number(),
    maxCy: v.number(),
    minCz: v.number(),
    maxCz: v.number(),
  },
  handler: async (ctx, args) => {
    // Note: This is a simple approach. For large worlds,
    // we'd want a spatial index or chunked loading strategy
    const allChunks = await ctx.db.query("chunks").collect();
    return allChunks.filter(c =>
      c.cx >= args.minCx && c.cx <= args.maxCx &&
      c.cy >= args.minCy && c.cy <= args.maxCy &&
      c.cz >= args.minCz && c.cz <= args.maxCz
    );
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

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

/** Update a single block in a chunk (for real-time block updates) */
export const updateBlock = mutation({
  args: {
    key: v.string(),
    cx: v.number(),
    cy: v.number(),
    cz: v.number(),
    localX: v.number(),
    localY: v.number(),
    localZ: v.number(),
    blockType: v.number(),
    blocksBase64: v.string(), // Full chunk data after modification
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
    } else {
      await ctx.db.insert("chunks", {
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
