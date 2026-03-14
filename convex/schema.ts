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
    // Stats
    stats: v.optional(v.object({
      blocksPlaced: v.number(),
      blocksBroken: v.number(),
      messagesSent: v.number(),
      distanceTraveled: v.optional(v.number()), // For explorer achievement
    })),
    // Inventory: array of {blockId, count} or {toolId, durability} slots
    inventory: v.optional(v.array(v.object({
      blockId: v.number(),
      count: v.number(),
    }))),
    // Tool inventory: separate array for tools with durability
    tools: v.optional(v.array(v.object({
      toolId: v.string(), // e.g., "wooden_pickaxe"
      durability: v.number(),
    }))),
    // Currently equipped tool (toolId or null for hand)
    equippedTool: v.optional(v.string()),
    // ERC-8004 on-chain identity
    onChainAgentId: v.optional(v.number()),     // Token ID on Identity Registry
    walletAddress: v.optional(v.string()),      // Wallet that owns the NFT
    agentURI: v.optional(v.string()),           // IPFS/data URI to registration file
    mintedAt: v.optional(v.number()),           // Timestamp of NFT mint
  })
    .index("by_username", ["username"])
    .index("by_social", ["provider", "socialId"])
    .index("by_token", ["secretToken"])
    .index("by_onchain_id", ["onChainAgentId"]),

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

  // Waypoints - saved locations for agents
  waypoints: defineTable({
    agentId: v.id("agents"),
    name: v.string(),
    x: v.number(),
    y: v.number(),
    z: v.number(),
    createdAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_agent_name", ["agentId", "name"]),

  // Achievements - tracks agent accomplishments
  achievements: defineTable({
    agentId: v.id("agents"),
    achievementId: v.string(), // e.g., "first_block_placed", "blocks_100"
    unlockedAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_agent_achievement", ["agentId", "achievementId"]),

  // Tasks/Challenges - benchmark tasks for agents
  tasks: defineTable({
    taskId: v.string(), // unique identifier e.g., "build_shelter_5x5"
    name: v.string(),
    description: v.string(),
    category: v.union(
      v.literal("building"),
      v.literal("mining"),
      v.literal("exploration"),
      v.literal("collaboration"),
      v.literal("speedrun")
    ),
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
    // Task requirements
    requirements: v.object({
      type: v.union(
        v.literal("build_structure"),
        v.literal("collect_blocks"),
        v.literal("reach_location"),
        v.literal("craft_items"),
        v.literal("custom")
      ),
      // For build_structure: dimensions, required blocks, etc.
      params: v.any(),
    }),
    // Scoring
    maxPoints: v.number(),
    timeBonus: v.optional(v.boolean()), // bonus points for speed
    enabled: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_taskId", ["taskId"])
    .index("by_category", ["category"])
    .index("by_enabled", ["enabled"]),

  // Task completions - tracks who completed what tasks
  taskCompletions: defineTable({
    taskId: v.string(),
    agentId: v.id("agents"),
    agentName: v.string(),
    completedAt: v.number(),
    // Scoring details
    score: v.number(),
    timeMs: v.optional(v.number()), // time to complete
    details: v.optional(v.any()), // task-specific completion data
  })
    .index("by_task", ["taskId"])
    .index("by_agent", ["agentId"])
    .index("by_task_agent", ["taskId", "agentId"])
    .index("by_score", ["score"]),

  // Task attempts - tracks active task attempts
  taskAttempts: defineTable({
    taskId: v.string(),
    agentId: v.id("agents"),
    startedAt: v.number(),
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("failed")),
    // Snapshot of starting position (for some tasks)
    startPosition: v.optional(v.object({
      x: v.number(),
      y: v.number(),
      z: v.number(),
    })),
  })
    .index("by_agent", ["agentId"])
    .index("by_task_agent", ["taskId", "agentId"])
    .index("by_status", ["status"]),

  // Block ownership - tracks who placed/owns each block
  blockPlacements: defineTable({
    // Composite key for the block position
    posKey: v.string(), // "x,y,z"
    x: v.number(),
    y: v.number(),
    z: v.number(),
    // Owner info
    agentId: v.id("agents"),
    agentName: v.string(),
    blockType: v.number(),
    placedAt: v.number(),
  })
    .index("by_pos", ["posKey"])
    .index("by_agent", ["agentId"])
    .index("by_location", ["x", "y", "z"]),

  // ERC-8004 pending on-chain feedback (processed by relayer)
  pendingChainFeedback: defineTable({
    onChainAgentId: v.number(),        // Agent's NFT token ID
    feedbackType: v.string(),          // e.g., "task_complete", "achievement"
    metadata: v.string(),              // JSON metadata
    status: v.union(
      v.literal("pending"),
      v.literal("submitted"),
      v.literal("confirmed"),
      v.literal("failed")
    ),
    createdAt: v.number(),
    txHash: v.optional(v.string()),    // Set when submitted
    error: v.optional(v.string()),     // Set on failure
  })
    .index("by_status", ["status"])
    .index("by_agent", ["onChainAgentId"]),
});
