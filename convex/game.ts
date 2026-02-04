import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Game state functions for real-time multiplayer
 * 
 * Convex subscriptions automatically push updates to clients,
 * so we don't need WebSockets for data sync anymore.
 */

// ============================================================================
// QUERIES (Real-time subscriptions)
// ============================================================================

/** Get all online agents with their positions */
export const getOnlineAgents = query({
  args: { sinceMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // Consider agents online if seen in last 30 seconds
    const threshold = Date.now() - (args.sinceMs ?? 30000);
    
    const agents = await ctx.db.query("agents").collect();
    
    return agents
      .filter(a => a.lastSeen && a.lastSeen > threshold)
      .map(a => ({
        _id: a._id,
        username: a.username,
        position: a.position,
        rotation: a.rotation,
        lastSeen: a.lastSeen,
      }));
  },
});

/** Get world stats */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    const chunks = await ctx.db.query("chunks").collect();
    const onlineThreshold = Date.now() - 30000;
    
    return {
      totalAgents: agents.length,
      onlineAgents: agents.filter(a => a.lastSeen && a.lastSeen > onlineThreshold).length,
      totalChunks: chunks.length,
    };
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/** Batch update agent position (called frequently) */
export const tick = mutation({
  args: {
    agentId: v.id("agents"),
    position: v.object({ x: v.number(), y: v.number(), z: v.number() }),
    rotation: v.object({ x: v.number(), y: v.number(), z: v.number() }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.agentId, {
      position: args.position,
      rotation: args.rotation,
      lastSeen: Date.now(),
    });
  },
});

/** Place a block */
export const placeBlock = mutation({
  args: {
    agentId: v.id("agents"),
    worldX: v.number(),
    worldY: v.number(),
    worldZ: v.number(),
    blockType: v.number(),
    chunkKey: v.string(),
    cx: v.number(),
    cy: v.number(),
    cz: v.number(),
    updatedBlocksBase64: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify agent exists
    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      throw new Error("Agent not found");
    }

    // Update chunk
    const existing = await ctx.db
      .query("chunks")
      .withIndex("by_key", q => q.eq("key", args.chunkKey))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        blocksBase64: args.updatedBlocksBase64,
        modifiedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("chunks", {
        key: args.chunkKey,
        cx: args.cx,
        cy: args.cy,
        cz: args.cz,
        blocksBase64: args.updatedBlocksBase64,
        modifiedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/** Break a block */
export const breakBlock = mutation({
  args: {
    agentId: v.id("agents"),
    worldX: v.number(),
    worldY: v.number(),
    worldZ: v.number(),
    chunkKey: v.string(),
    updatedBlocksBase64: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify agent exists
    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      throw new Error("Agent not found");
    }

    // Update chunk
    const existing = await ctx.db
      .query("chunks")
      .withIndex("by_key", q => q.eq("key", args.chunkKey))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        blocksBase64: args.updatedBlocksBase64,
        modifiedAt: Date.now(),
      });
    }

    return { success: true };
  },
});
