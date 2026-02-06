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

/** Get agent by username */
export const getByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_username", q => q.eq("username", args.username.toLowerCase()))
      .first();
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

    // Create agent
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
      position: { x: 0, y: 64, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
    });

    return { agentId, token: secretToken };
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
