/**
 * ERC-8004 Integration Module
 * 
 * Handles on-chain identity and reputation for ClawCraft agents.
 * Uses Base Sepolia testnet for the Synthesis Hackathon.
 * 
 * Architecture:
 * - Convex queues feedback in `pendingChainFeedback` table
 * - VPS relayer script polls pending items and submits to chain
 * - Relayer updates status back via mutation
 */

import { action, internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

// Chain config (for reference)
export const CHAIN_CONFIG = {
  chainId: 84532, // Base Sepolia
  rpcUrl: "https://sepolia.base.org",
  identityRegistry: "0xf324484c7D67d2141717bbc2a89721e2DE6a37eE",
  reputationRegistry: "0x457d8F7d1E224B18C5f9d69Cec5dF397B9f01803",
  relayerAddress: "0x49Ab71481621e46703A94059a3A7017b2BCeB9c2",
};

// ============================================================================
// Queue feedback for on-chain submission
// ============================================================================

/**
 * Queue task completion feedback for on-chain submission
 * Called internally after a task is completed.
 */
export const queueTaskFeedback = internalMutation({
  args: {
    onChainAgentId: v.number(),
    taskId: v.string(),
    taskTitle: v.string(),
    score: v.number(),
    timeMs: v.number(),
  },
  handler: async (ctx, args) => {
    const metadata = JSON.stringify({
      taskId: args.taskId,
      task: args.taskTitle,
      score: args.score,
      timeMs: args.timeMs,
      timestamp: Date.now(),
    });

    const id = await ctx.db.insert("pendingChainFeedback", {
      onChainAgentId: args.onChainAgentId,
      feedbackType: "task_complete",
      metadata,
      status: "pending",
      createdAt: Date.now(),
    });

    console.log(`Queued task feedback for agent ${args.onChainAgentId}: ${id}`);
    return { success: true, feedbackId: id };
  },
});

/**
 * Queue achievement feedback
 */
export const queueAchievementFeedback = internalMutation({
  args: {
    onChainAgentId: v.number(),
    achievementId: v.string(),
    achievementName: v.string(),
  },
  handler: async (ctx, args) => {
    const metadata = JSON.stringify({
      achievementId: args.achievementId,
      achievement: args.achievementName,
      timestamp: Date.now(),
    });

    const id = await ctx.db.insert("pendingChainFeedback", {
      onChainAgentId: args.onChainAgentId,
      feedbackType: "achievement",
      metadata,
      status: "pending",
      createdAt: Date.now(),
    });

    return { success: true, feedbackId: id };
  },
});

// ============================================================================
// Relayer interface (called by VPS script)
// ============================================================================

/**
 * Get pending feedback items for the relayer to process
 */
export const getPendingFeedback = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    
    const pending = await ctx.db
      .query("pendingChainFeedback")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(limit);
    
    return pending;
  },
});

/**
 * Mark feedback as submitted (called by relayer after tx sent)
 */
export const markFeedbackSubmitted = mutation({
  args: {
    feedbackId: v.id("pendingChainFeedback"),
    txHash: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.feedbackId, {
      status: "submitted",
      txHash: args.txHash,
    });
  },
});

/**
 * Mark feedback as confirmed (called by relayer after tx confirmed)
 */
export const markFeedbackConfirmed = mutation({
  args: {
    feedbackId: v.id("pendingChainFeedback"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.feedbackId, {
      status: "confirmed",
    });
  },
});

/**
 * Mark feedback as failed (called by relayer on error)
 */
export const markFeedbackFailed = mutation({
  args: {
    feedbackId: v.id("pendingChainFeedback"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.feedbackId, {
      status: "failed",
      error: args.error,
    });
  },
});

// ============================================================================
// Agent identity helpers
// ============================================================================

/**
 * Check if an agent has minted their on-chain identity
 */
export const checkOnChainIdentity = action({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.runQuery(api.agents.get, { id: args.agentId });
    if (!agent) {
      return { exists: false, error: "Agent not found" };
    }

    return {
      exists: !!agent.onChainAgentId,
      onChainAgentId: agent.onChainAgentId,
      walletAddress: agent.walletAddress,
      mintedAt: agent.mintedAt,
    };
  },
});

/**
 * Get on-chain stats for an agent
 */
export const getAgentChainStats = query({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent || !agent.onChainAgentId) {
      return null;
    }

    // Count feedback items for this agent
    const feedback = await ctx.db
      .query("pendingChainFeedback")
      .withIndex("by_agent", (q) => q.eq("onChainAgentId", agent.onChainAgentId!))
      .collect();

    const confirmed = feedback.filter((f) => f.status === "confirmed").length;
    const pending = feedback.filter((f) => f.status === "pending").length;
    const failed = feedback.filter((f) => f.status === "failed").length;

    return {
      onChainAgentId: agent.onChainAgentId,
      walletAddress: agent.walletAddress,
      mintedAt: agent.mintedAt,
      feedbackStats: {
        confirmed,
        pending,
        failed,
        total: feedback.length,
      },
    };
  },
});
