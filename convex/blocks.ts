import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Block ownership tracking
 * Tracks who placed each block for territory/economy features
 */

// Get owner of a single block
export const getOwner = query({
  args: { posKey: v.string() },
  handler: async (ctx, args) => {
    const placement = await ctx.db
      .query("blockPlacements")
      .withIndex("by_pos", (q) => q.eq("posKey", args.posKey))
      .first();
    return placement;
  },
});

// Get owners in a region
export const getOwnersInRegion = query({
  args: {
    x1: v.number(),
    y1: v.number(),
    z1: v.number(),
    x2: v.number(),
    y2: v.number(),
    z2: v.number(),
  },
  handler: async (ctx, args) => {
    const minX = Math.min(args.x1, args.x2);
    const maxX = Math.max(args.x1, args.x2);
    const minY = Math.min(args.y1, args.y2);
    const maxY = Math.max(args.y1, args.y2);
    const minZ = Math.min(args.z1, args.z2);
    const maxZ = Math.max(args.z1, args.z2);

    // Get all placements and filter (Convex doesn't support range queries well)
    const allPlacements = await ctx.db.query("blockPlacements").collect();
    
    return allPlacements.filter(p => 
      p.x >= minX && p.x <= maxX &&
      p.y >= minY && p.y <= maxY &&
      p.z >= minZ && p.z <= maxZ
    );
  },
});

// Get all blocks placed by an agent
export const getBlocksByAgent = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const placements = await ctx.db
      .query("blockPlacements")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    return placements;
  },
});

// Record a block placement
export const recordPlacement = mutation({
  args: {
    x: v.number(),
    y: v.number(),
    z: v.number(),
    blockType: v.number(),
    agentId: v.id("agents"),
    agentName: v.string(),
  },
  handler: async (ctx, args) => {
    const posKey = `${args.x},${args.y},${args.z}`;
    
    // Check if there's already a record for this position
    const existing = await ctx.db
      .query("blockPlacements")
      .withIndex("by_pos", (q) => q.eq("posKey", posKey))
      .first();
    
    if (existing) {
      // Update ownership
      await ctx.db.patch(existing._id, {
        agentId: args.agentId,
        agentName: args.agentName,
        blockType: args.blockType,
        placedAt: Date.now(),
      });
    } else {
      // Create new record
      await ctx.db.insert("blockPlacements", {
        posKey,
        x: args.x,
        y: args.y,
        z: args.z,
        agentId: args.agentId,
        agentName: args.agentName,
        blockType: args.blockType,
        placedAt: Date.now(),
      });
    }
  },
});

// Remove a block placement record (when block is broken)
export const removePlacement = mutation({
  args: {
    x: v.number(),
    y: v.number(),
    z: v.number(),
  },
  handler: async (ctx, args) => {
    const posKey = `${args.x},${args.y},${args.z}`;
    
    const existing = await ctx.db
      .query("blockPlacements")
      .withIndex("by_pos", (q) => q.eq("posKey", posKey))
      .first();
    
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// Get territory stats for an agent
export const getAgentTerritory = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const placements = await ctx.db
      .query("blockPlacements")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    
    if (placements.length === 0) {
      return {
        totalBlocks: 0,
        boundingBox: null,
        blockTypes: {},
      };
    }

    // Calculate bounding box
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    const blockTypes: Record<number, number> = {};

    for (const p of placements) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
      blockTypes[p.blockType] = (blockTypes[p.blockType] || 0) + 1;
    }

    return {
      totalBlocks: placements.length,
      boundingBox: {
        min: { x: minX, y: minY, z: minZ },
        max: { x: maxX, y: maxY, z: maxZ },
        size: {
          width: maxX - minX + 1,
          height: maxY - minY + 1,
          depth: maxZ - minZ + 1,
        },
      },
      blockTypes,
    };
  },
});
