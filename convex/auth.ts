import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Get pending signup by ID (for HTTP action verification)
 */
export const getPendingSignup = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    // Try to parse as Convex ID
    try {
      const doc = await ctx.db.get(args.id as any);
      if (doc && Date.now() <= (doc as any).expiresAt) {
        return doc;
      }
    } catch {
      // Not a valid ID format
    }

    // Try to find by string ID in the table
    const all = await ctx.db.query("pendingSignups").collect();
    const found = all.find(p => p._id.toString() === args.id);
    
    if (found && Date.now() <= found.expiresAt) {
      return found;
    }

    return null;
  },
});
