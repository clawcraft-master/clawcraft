import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";

/**
 * Achievement tracking for agents
 */

// Achievement definitions (also defined in http.ts for API responses)
const ACHIEVEMENT_THRESHOLDS = {
  first_block_placed: { stat: "blocksPlaced", threshold: 1 },
  first_block_broken: { stat: "blocksBroken", threshold: 1 },
  blocks_100: { stat: "blocksPlaced", threshold: 100 },
  blocks_1000: { stat: "blocksPlaced", threshold: 1000 },
  first_chat: { stat: "messagesSent", threshold: 1 },
  builder: { stat: "blocksPlaced", threshold: 500 },
  explorer: { stat: "distanceTraveled", threshold: 500 },
};

// ============================================================================
// QUERIES
// ============================================================================

/** List all achievements for an agent */
export const list = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("achievements")
      .withIndex("by_agent", q => q.eq("agentId", args.agentId))
      .collect();
  },
});

/** Check if an agent has a specific achievement */
export const has = query({
  args: { agentId: v.id("agents"), achievementId: v.string() },
  handler: async (ctx, args) => {
    const achievement = await ctx.db
      .query("achievements")
      .withIndex("by_agent_achievement", q => 
        q.eq("agentId", args.agentId).eq("achievementId", args.achievementId)
      )
      .unique();
    
    return !!achievement;
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/** Unlock an achievement for an agent */
export const unlock = mutation({
  args: { agentId: v.id("agents"), achievementId: v.string() },
  handler: async (ctx, args) => {
    // Check if already unlocked
    const existing = await ctx.db
      .query("achievements")
      .withIndex("by_agent_achievement", q => 
        q.eq("agentId", args.agentId).eq("achievementId", args.achievementId)
      )
      .unique();
    
    if (existing) {
      return null; // Already unlocked
    }
    
    return await ctx.db.insert("achievements", {
      agentId: args.agentId,
      achievementId: args.achievementId,
      unlockedAt: Date.now(),
    });
  },
});

/** Check and award any earned achievements for an agent */
export const checkAndAward = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) return [];

    const stats = agent.stats || { blocksPlaced: 0, blocksBroken: 0, messagesSent: 0 };
    const awarded: string[] = [];

    // Get already unlocked achievements
    const unlocked = await ctx.db
      .query("achievements")
      .withIndex("by_agent", q => q.eq("agentId", args.agentId))
      .collect();
    
    const unlockedIds = new Set(unlocked.map(a => a.achievementId));

    // Check each achievement
    for (const [achievementId, config] of Object.entries(ACHIEVEMENT_THRESHOLDS)) {
      if (unlockedIds.has(achievementId)) continue;
      
      const statValue = (stats as any)[config.stat] || 0;
      
      if (statValue >= config.threshold) {
        await ctx.db.insert("achievements", {
          agentId: args.agentId,
          achievementId,
          unlockedAt: Date.now(),
        });
        awarded.push(achievementId);
      }
    }

    return awarded;
  },
});

/** Internal: Award a specific achievement (called from other mutations) */
export const awardInternal = internalMutation({
  args: { agentId: v.id("agents"), achievementId: v.string() },
  handler: async (ctx, args) => {
    // Check if already unlocked
    const existing = await ctx.db
      .query("achievements")
      .withIndex("by_agent_achievement", q => 
        q.eq("agentId", args.agentId).eq("achievementId", args.achievementId)
      )
      .unique();
    
    if (existing) return null;
    
    return await ctx.db.insert("achievements", {
      agentId: args.agentId,
      achievementId: args.achievementId,
      unlockedAt: Date.now(),
    });
  },
});
