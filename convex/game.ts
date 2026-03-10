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

/** Get agent's inventory */
export const getInventory = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      return [];
    }
    return agent.inventory ?? [];
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

/** Place a block - requires block in inventory */
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

    // Check inventory for the block
    const inventory = agent.inventory ?? [];
    const slotIndex = inventory.findIndex(slot => slot.blockId === args.blockType);
    
    if (slotIndex === -1 || inventory[slotIndex].count <= 0) {
      throw new Error("You don't have that block in your inventory!");
    }

    // Deduct from inventory
    const newInventory = [...inventory];
    newInventory[slotIndex] = {
      ...newInventory[slotIndex],
      count: newInventory[slotIndex].count - 1,
    };
    
    // Remove slot if empty
    if (newInventory[slotIndex].count <= 0) {
      newInventory.splice(slotIndex, 1);
    }

    // Update agent inventory and stats
    const stats = agent.stats ?? { blocksPlaced: 0, blocksBroken: 0, messagesSent: 0 };
    await ctx.db.patch(args.agentId, {
      inventory: newInventory,
      stats: { ...stats, blocksPlaced: stats.blocksPlaced + 1 },
    });

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

    return { success: true, inventory: newInventory };
  },
});

/** Break a block - adds to inventory */
export const breakBlock = mutation({
  args: {
    agentId: v.id("agents"),
    worldX: v.number(),
    worldY: v.number(),
    worldZ: v.number(),
    blockType: v.number(), // The block being broken
    chunkKey: v.string(),
    updatedBlocksBase64: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify agent exists
    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      throw new Error("Agent not found");
    }

    // Don't add air, water, or bedrock to inventory
    const nonCollectible = [0, 6, 8]; // AIR, WATER, BEDROCK
    const shouldCollect = !nonCollectible.includes(args.blockType);

    // Add to inventory if collectible
    let newInventory = [...(agent.inventory ?? [])];
    
    if (shouldCollect && args.blockType > 0) {
      const slotIndex = newInventory.findIndex(slot => slot.blockId === args.blockType);
      
      if (slotIndex !== -1) {
        // Stack with existing slot
        newInventory[slotIndex] = {
          ...newInventory[slotIndex],
          count: newInventory[slotIndex].count + 1,
        };
      } else {
        // Add new slot
        newInventory.push({ blockId: args.blockType, count: 1 });
      }
    }

    // Update agent inventory and stats
    const stats = agent.stats ?? { blocksPlaced: 0, blocksBroken: 0, messagesSent: 0 };
    await ctx.db.patch(args.agentId, {
      inventory: newInventory,
      stats: { ...stats, blocksBroken: stats.blocksBroken + 1 },
    });

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

    return { success: true, inventory: newInventory };
  },
});
