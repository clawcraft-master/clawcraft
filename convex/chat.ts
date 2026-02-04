import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ============================================================================
// QUERIES
// ============================================================================

/** Get recent chat messages (real-time subscription) */
export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const messages = await ctx.db
      .query("chat")
      .order("desc")
      .take(limit);
    // Return in chronological order (oldest first)
    return messages.reverse();
  },
});

/** Get messages after a certain timestamp */
export const listAfter = query({
  args: { afterTimestamp: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const messages = await ctx.db
      .query("chat")
      .order("asc")
      .filter(q => q.gt(q.field("_creationTime"), args.afterTimestamp))
      .take(limit);
    return messages;
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/** Send a chat message */
export const send = mutation({
  args: {
    senderId: v.string(),
    senderName: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    // Basic validation
    if (args.message.length === 0) {
      throw new Error("Message cannot be empty");
    }
    if (args.message.length > 500) {
      throw new Error("Message too long (max 500 chars)");
    }

    const id = await ctx.db.insert("chat", {
      senderId: args.senderId,
      senderName: args.senderName,
      message: args.message.trim(),
    });

    return id;
  },
});

/** Delete old messages (cleanup job) */
export const cleanup = mutation({
  args: { keepCount: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const keepCount = args.keepCount ?? 1000;
    
    // Get all messages ordered by creation time
    const allMessages = await ctx.db
      .query("chat")
      .order("desc")
      .collect();

    // Delete messages beyond keepCount
    const toDelete = allMessages.slice(keepCount);
    for (const msg of toDelete) {
      await ctx.db.delete(msg._id);
    }

    return { deleted: toDelete.length };
  },
});
