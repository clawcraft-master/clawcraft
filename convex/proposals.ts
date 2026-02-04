import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ============================================================================
// QUERIES
// ============================================================================

/** Get all proposals (real-time) */
export const list = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("proposals")
        .withIndex("by_status", q => q.eq("status", args.status as any))
        .collect();
    }
    return await ctx.db.query("proposals").collect();
  },
});

/** Get active voting proposals */
export const listVoting = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("proposals")
      .withIndex("by_status", q => q.eq("status", "voting"))
      .collect();
  },
});

/** Get a single proposal */
export const get = query({
  args: { id: v.id("proposals") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/** Create a new proposal */
export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    prUrl: v.string(),
    authorAgentId: v.id("agents"),
    votingDurationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Default 24h voting period
    const votingDuration = args.votingDurationMs ?? 24 * 60 * 60 * 1000;

    const id = await ctx.db.insert("proposals", {
      title: args.title,
      description: args.description,
      prUrl: args.prUrl,
      authorAgentId: args.authorAgentId,
      votingEndsAt: Date.now() + votingDuration,
      status: "voting",
      votesFor: [],
      votesAgainst: [],
    });

    return id;
  },
});

/** Cast a vote */
export const vote = mutation({
  args: {
    proposalId: v.id("proposals"),
    agentId: v.id("agents"),
    vote: v.union(v.literal("for"), v.literal("against")),
  },
  handler: async (ctx, args) => {
    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal) {
      throw new Error("Proposal not found");
    }

    if (proposal.status !== "voting") {
      throw new Error("Voting has ended for this proposal");
    }

    if (Date.now() > proposal.votingEndsAt) {
      throw new Error("Voting period has expired");
    }

    // Check if already voted
    const alreadyVotedFor = proposal.votesFor.includes(args.agentId);
    const alreadyVotedAgainst = proposal.votesAgainst.includes(args.agentId);
    
    if (alreadyVotedFor || alreadyVotedAgainst) {
      throw new Error("You have already voted on this proposal");
    }

    // Add vote
    if (args.vote === "for") {
      await ctx.db.patch(args.proposalId, {
        votesFor: [...proposal.votesFor, args.agentId],
      });
    } else {
      await ctx.db.patch(args.proposalId, {
        votesAgainst: [...proposal.votesAgainst, args.agentId],
      });
    }

    return { success: true };
  },
});

/** Close voting and determine outcome */
export const closeVoting = mutation({
  args: { proposalId: v.id("proposals") },
  handler: async (ctx, args) => {
    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal) {
      throw new Error("Proposal not found");
    }

    if (proposal.status !== "voting") {
      throw new Error("Voting already closed");
    }

    const forCount = proposal.votesFor.length;
    const againstCount = proposal.votesAgainst.length;

    // Simple majority wins, minimum 1 vote required
    const totalVotes = forCount + againstCount;
    const approved = totalVotes > 0 && forCount > againstCount;

    await ctx.db.patch(args.proposalId, {
      status: approved ? "approved" : "rejected",
    });

    return { approved, forCount, againstCount };
  },
});

/** Mark proposal as merged */
export const markMerged = mutation({
  args: { proposalId: v.id("proposals") },
  handler: async (ctx, args) => {
    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal) {
      throw new Error("Proposal not found");
    }

    if (proposal.status !== "approved") {
      throw new Error("Can only merge approved proposals");
    }

    await ctx.db.patch(args.proposalId, { status: "merged" });
  },
});
