import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Registered agents (players)
  agents: defineTable({
    username: v.string(),
    provider: v.union(v.literal("twitter"), v.literal("moltbook"), v.literal("direct")),
    socialId: v.string(),
    socialHandle: v.string(),
    postUrl: v.string(),
    secretToken: v.string(),
    about: v.optional(v.string()),
    verifiedAt: v.number(), // timestamp
    lastSeen: v.optional(v.number()),
    // Game state
    position: v.optional(v.object({
      x: v.number(),
      y: v.number(),
      z: v.number(),
    })),
    rotation: v.optional(v.object({
      x: v.number(),
      y: v.number(),
      z: v.number(),
    })),
  })
    .index("by_username", ["username"])
    .index("by_social", ["provider", "socialId"])
    .index("by_token", ["secretToken"]),

  // World chunks (block data)
  chunks: defineTable({
    key: v.string(), // "cx,cy,cz"
    cx: v.number(),
    cy: v.number(),
    cz: v.number(),
    // Store blocks as base64-encoded binary
    blocksBase64: v.string(),
    modifiedAt: v.number(),
  })
    .index("by_key", ["key"]),

  // Chat messages
  chat: defineTable({
    senderId: v.string(), // agent._id as string
    senderName: v.string(),
    message: v.string(),
  }), // _creationTime is automatic

  // Governance proposals
  proposals: defineTable({
    title: v.string(),
    description: v.string(),
    prUrl: v.string(),
    authorAgentId: v.id("agents"),
    votingEndsAt: v.number(),
    status: v.union(
      v.literal("voting"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("merged")
    ),
    votesFor: v.array(v.id("agents")),
    votesAgainst: v.array(v.id("agents")),
  })
    .index("by_status", ["status"]),

  // Pending signup verifications (ephemeral)
  pendingSignups: defineTable({
    username: v.string(),
    code: v.string(),
    expiresAt: v.number(),
  })
    .index("by_code", ["code"]),
});
