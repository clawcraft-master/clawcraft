import { v } from "convex/values";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Get pending signup by ID (for HTTP action verification)
 */
export const getPendingSignup = query({
  args: { id: v.string() },
  handler: async (ctx, args): Promise<{
    _id: Id<"pendingSignups">;
    username: string;
    code: string;
    expiresAt: number;
  } | null> => {
    // Query the pendingSignups table directly
    const allPending = await ctx.db.query("pendingSignups").collect();
    
    // Find by ID string match
    const found = allPending.find(p => p._id.toString() === args.id);
    
    if (found && Date.now() <= found.expiresAt) {
      return {
        _id: found._id,
        username: found.username,
        code: found.code,
        expiresAt: found.expiresAt,
      };
    }

    return null;
  },
});
