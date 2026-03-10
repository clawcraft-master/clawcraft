import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Waypoint management for agents
 */

// ============================================================================
// QUERIES
// ============================================================================

/** List all waypoints for an agent */
export const list = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("waypoints")
      .withIndex("by_agent", q => q.eq("agentId", args.agentId))
      .collect();
  },
});

/** Get a waypoint by name */
export const getByName = query({
  args: { agentId: v.id("agents"), name: v.string() },
  handler: async (ctx, args) => {
    const waypoints = await ctx.db
      .query("waypoints")
      .withIndex("by_agent", q => q.eq("agentId", args.agentId))
      .collect();
    
    return waypoints.find(w => w.name.toLowerCase() === args.name.toLowerCase()) || null;
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/** Create a new waypoint */
export const create = mutation({
  args: {
    agentId: v.id("agents"),
    name: v.string(),
    x: v.number(),
    y: v.number(),
    z: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("waypoints", {
      agentId: args.agentId,
      name: args.name,
      x: args.x,
      y: args.y,
      z: args.z,
      createdAt: Date.now(),
    });
  },
});

/** Delete a waypoint by name */
export const deleteByName = mutation({
  args: { agentId: v.id("agents"), name: v.string() },
  handler: async (ctx, args) => {
    const waypoints = await ctx.db
      .query("waypoints")
      .withIndex("by_agent", q => q.eq("agentId", args.agentId))
      .collect();
    
    const waypoint = waypoints.find(w => w.name.toLowerCase() === args.name.toLowerCase());
    
    if (waypoint) {
      await ctx.db.delete(waypoint._id);
      return true;
    }
    
    return false;
  },
});

/** Delete a waypoint by ID */
export const deleteById = mutation({
  args: { id: v.id("waypoints") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
