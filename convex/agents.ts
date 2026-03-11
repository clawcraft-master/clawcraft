import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Generate a secure random token (hex string)
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// Generate a verification code
function generateCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Spawn spacing (blocks between each spawn point)
const SPAWN_SPACING = 64;

/**
 * Calculate spawn position for agent based on index.
 * Uses a spiral pattern to spread agents out as more join.
 * 
 * Pattern (index -> grid position):
 *   8 1 2
 *   7 0 3
 *   6 5 4
 * 
 * Each grid cell is SPAWN_SPACING blocks apart.
 */
function calculateSpawnPosition(agentIndex: number): { x: number; z: number } {
  if (agentIndex === 0) return { x: 0, z: 0 };
  
  // Spiral outward
  let x = 0, z = 0;
  let dx = 0, dz = -1;
  let segmentLength = 1;
  let segmentPassed = 0;
  let turnsMade = 0;
  
  for (let i = 0; i < agentIndex; i++) {
    // Move in current direction
    x += dx;
    z += dz;
    segmentPassed++;
    
    // Time to turn?
    if (segmentPassed === segmentLength) {
      segmentPassed = 0;
      // Rotate 90 degrees clockwise
      const temp = dx;
      dx = -dz;
      dz = temp;
      turnsMade++;
      
      // Increase segment length every 2 turns
      if (turnsMade % 2 === 0) {
        segmentLength++;
      }
    }
  }
  
  return { x: x * SPAWN_SPACING, z: z * SPAWN_SPACING };
}

// ============================================================================
// QUERIES
// ============================================================================

/** Get all verified agents (public info only) */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    return agents.map(a => ({
      _id: a._id,
      username: a.username,
      about: a.about,
      provider: a.provider,
      socialHandle: a.socialHandle,
      verifiedAt: a.verifiedAt,
      lastSeen: a.lastSeen,
      position: a.position,
      stats: a.stats,
    }));
  },
});

/** Get agent by username (case-insensitive search) */
export const getByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    // Try exact match first
    let agent = await ctx.db
      .query("agents")
      .withIndex("by_username", q => q.eq("username", args.username))
      .first();
    
    // If not found, try lowercase
    if (!agent) {
      agent = await ctx.db
        .query("agents")
        .withIndex("by_username", q => q.eq("username", args.username.toLowerCase()))
        .first();
    }
    
    // If still not found, scan all agents for case-insensitive match
    if (!agent) {
      const allAgents = await ctx.db.query("agents").collect();
      agent = allAgents.find(a => a.username.toLowerCase() === args.username.toLowerCase()) || null;
    }
    
    return agent;
  },
});

/** Get agent by token (for auth) */
export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_token", q => q.eq("secretToken", args.token))
      .unique();
  },
});

/** Get agent by ID */
export const get = query({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/** Check if username is taken */
export const isUsernameTaken = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_username", q => q.eq("username", args.username.toLowerCase()))
      .first();
    return !!existing;
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/** Start signup process - returns verification code */
export const startSignup = mutation({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    // Check username not taken
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_username", q => q.eq("username", args.username.toLowerCase()))
      .first();
    if (existing) {
      throw new Error("Username already taken");
    }

    // Create pending signup
    const code = generateCode();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    const id = await ctx.db.insert("pendingSignups", {
      username: args.username,
      code,
      expiresAt,
    });

    return { id, code, expiresAt };
  },
});

/** Complete verification and create agent */
export const verifyAndCreate = mutation({
  args: {
    signupId: v.id("pendingSignups"),
    provider: v.union(v.literal("twitter"), v.literal("moltbook")),
    socialId: v.string(),
    socialHandle: v.string(),
    postUrl: v.string(),
  },
  handler: async (ctx, args) => {
    // Get pending signup
    const pending = await ctx.db.get(args.signupId);
    if (!pending) {
      throw new Error("Signup not found");
    }
    if (Date.now() > pending.expiresAt) {
      await ctx.db.delete(args.signupId);
      throw new Error("Signup expired");
    }

    // Check if already verified with this social
    const existingSocial = await ctx.db
      .query("agents")
      .withIndex("by_social", q => q.eq("provider", args.provider).eq("socialId", args.socialId))
      .first();
    if (existingSocial) {
      throw new Error("This social account is already verified");
    }

    // Create agent
    const secretToken = generateToken();
    const agentId = await ctx.db.insert("agents", {
      username: pending.username,
      provider: args.provider,
      socialId: args.socialId,
      socialHandle: args.socialHandle,
      postUrl: args.postUrl,
      secretToken,
      verifiedAt: Date.now(),
      position: { x: 0, y: 64, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
    });

    // Delete pending signup
    await ctx.db.delete(args.signupId);

    return { agentId, secretToken };
  },
});

/** Update agent position */
export const updatePosition = mutation({
  args: {
    id: v.id("agents"),
    position: v.object({ x: v.number(), y: v.number(), z: v.number() }),
    rotation: v.object({ x: v.number(), y: v.number(), z: v.number() }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      position: args.position,
      rotation: args.rotation,
      lastSeen: Date.now(),
    });
  },
});

/** Update last seen */
export const updateLastSeen = mutation({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { lastSeen: Date.now() });
  },
});

/** Register agent directly (no social verification) */
export const registerDirect = mutation({
  args: { 
    name: v.string(),
    about: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Sanitize name
    const username = args.name.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
    if (username.length < 2) {
      throw new Error("Name must be at least 2 characters");
    }

    // Check username not taken
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_username", q => q.eq("username", username.toLowerCase()))
      .first();
    if (existing) {
      throw new Error("Name already taken");
    }

    // Count existing agents to determine spawn position
    const allAgents = await ctx.db.query("agents").collect();
    const agentIndex = allAgents.length;
    const spawnXZ = calculateSpawnPosition(agentIndex);

    // Create agent with dynamic spawn position
    const secretToken = generateToken();
    const agentId = await ctx.db.insert("agents", {
      username,
      provider: "direct",
      socialId: "",
      socialHandle: "",
      postUrl: "",
      secretToken,
      about: args.about,
      verifiedAt: Date.now(),
      position: { x: spawnXZ.x, y: 64, z: spawnXZ.z },
      rotation: { x: 0, y: 0, z: 0 },
    });

    return { 
      agentId, 
      token: secretToken,
      spawnPosition: { x: spawnXZ.x, y: 64, z: spawnXZ.z },
    };
  },
});

/** Increment agent stat */
export const incrementStat = mutation({
  args: {
    id: v.id("agents"),
    stat: v.union(v.literal("blocksPlaced"), v.literal("blocksBroken"), v.literal("messagesSent")),
    amount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    if (!agent) return;

    const currentStats = agent.stats || { blocksPlaced: 0, blocksBroken: 0, messagesSent: 0 };
    const increment = args.amount ?? 1;

    await ctx.db.patch(args.id, {
      stats: {
        ...currentStats,
        [args.stat]: (currentStats[args.stat] || 0) + increment,
      },
    });
  },
});

/** Update agent inventory */
export const updateInventory = mutation({
  args: {
    id: v.id("agents"),
    inventory: v.array(v.object({ blockId: v.number(), count: v.number() })),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    if (!agent) return;

    await ctx.db.patch(args.id, {
      inventory: args.inventory,
    });
  },
});

/** Update agent tools */
export const updateTools = mutation({
  args: {
    id: v.id("agents"),
    tools: v.array(v.object({ toolId: v.string(), durability: v.number() })),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    if (!agent) return;

    await ctx.db.patch(args.id, {
      tools: args.tools,
    });
  },
});

/** Equip or unequip a tool */
export const equipTool = mutation({
  args: {
    id: v.id("agents"),
    toolId: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    if (!agent) return;

    await ctx.db.patch(args.id, {
      equippedTool: args.toolId ?? undefined,
    });
  },
});

/** Update distance traveled stat */
export const updateDistanceTraveled = mutation({
  args: {
    id: v.id("agents"),
    distance: v.number(),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    if (!agent) return;

    const currentStats = agent.stats || { blocksPlaced: 0, blocksBroken: 0, messagesSent: 0, distanceTraveled: 0 };

    await ctx.db.patch(args.id, {
      stats: {
        ...currentStats,
        distanceTraveled: (currentStats.distanceTraveled || 0) + args.distance,
      },
    });
  },
});
