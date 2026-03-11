import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============ TASK DEFINITIONS ============
// These are the benchmark tasks agents can attempt

export const TASK_DEFINITIONS = [
  {
    taskId: "build_shelter_3x3",
    name: "Basic Shelter",
    description: "Build a 3x3x3 enclosed structure with walls, floor, and roof. Must have at least one opening (door).",
    category: "building" as const,
    difficulty: "easy" as const,
    requirements: {
      type: "build_structure" as const,
      params: {
        minBlocks: 20,
        minWidth: 3,
        minHeight: 3,
        minDepth: 3,
        needsEnclosure: true,
        needsOpening: true,
      },
    },
    maxPoints: 100,
    timeBonus: true,
  },
  {
    taskId: "build_tower_10",
    name: "Tower Builder",
    description: "Build a tower at least 10 blocks tall. Must be freestanding (not leaning on terrain).",
    category: "building" as const,
    difficulty: "easy" as const,
    requirements: {
      type: "build_structure" as const,
      params: {
        minHeight: 10,
        freestanding: true,
      },
    },
    maxPoints: 100,
    timeBonus: true,
  },
  {
    taskId: "collect_wood_20",
    name: "Lumberjack",
    description: "Collect 20 wood blocks by mining trees.",
    category: "mining" as const,
    difficulty: "easy" as const,
    requirements: {
      type: "collect_blocks" as const,
      params: {
        blockId: 4, // WOOD
        count: 20,
      },
    },
    maxPoints: 50,
    timeBonus: true,
  },
  {
    taskId: "collect_stone_50",
    name: "Stone Miner",
    description: "Collect 50 stone blocks.",
    category: "mining" as const,
    difficulty: "medium" as const,
    requirements: {
      type: "collect_blocks" as const,
      params: {
        blockId: 1, // STONE
        count: 50,
      },
    },
    maxPoints: 100,
    timeBonus: true,
  },
  {
    taskId: "collect_diamond_5",
    name: "Diamond Hunter",
    description: "Find and collect 5 diamond blocks.",
    category: "mining" as const,
    difficulty: "hard" as const,
    requirements: {
      type: "collect_blocks" as const,
      params: {
        blockId: 28, // DIAMOND
        count: 5,
      },
    },
    maxPoints: 300,
    timeBonus: true,
  },
  {
    taskId: "explore_500",
    name: "Explorer",
    description: "Travel at least 500 blocks from your starting position.",
    category: "exploration" as const,
    difficulty: "medium" as const,
    requirements: {
      type: "reach_location" as const,
      params: {
        minDistance: 500,
      },
    },
    maxPoints: 150,
    timeBonus: false,
  },
  {
    taskId: "explore_biomes_3",
    name: "Biome Hopper",
    description: "Visit at least 3 different biomes.",
    category: "exploration" as const,
    difficulty: "medium" as const,
    requirements: {
      type: "custom" as const,
      params: {
        customType: "visit_biomes",
        count: 3,
      },
    },
    maxPoints: 200,
    timeBonus: false,
  },
  {
    taskId: "craft_all_tools",
    name: "Tool Master",
    description: "Craft one of each tool type: wooden pickaxe, stone pickaxe, wooden axe, stone axe, wooden shovel, stone shovel.",
    category: "mining" as const,
    difficulty: "hard" as const,
    requirements: {
      type: "craft_items" as const,
      params: {
        tools: ["wooden_pickaxe", "stone_pickaxe", "wooden_axe", "stone_axe", "wooden_shovel", "stone_shovel"],
      },
    },
    maxPoints: 250,
    timeBonus: true,
  },
  {
    taskId: "build_house_furnished",
    name: "Home Sweet Home",
    description: "Build a house (5x5x4 minimum) with at least 2 different block types and interior furnishing (bookshelf, lamp, or decorative blocks).",
    category: "building" as const,
    difficulty: "hard" as const,
    requirements: {
      type: "build_structure" as const,
      params: {
        minWidth: 5,
        minHeight: 4,
        minDepth: 5,
        minBlockTypes: 2,
        needsEnclosure: true,
        needsFurnishing: true,
        furnishingBlocks: [29, 30], // LAMP, BOOKSHELF
      },
    },
    maxPoints: 300,
    timeBonus: true,
  },
  {
    taskId: "speedrun_shelter",
    name: "Speedrun: Shelter",
    description: "Build any enclosed shelter as fast as possible. Points awarded based on completion time.",
    category: "speedrun" as const,
    difficulty: "medium" as const,
    requirements: {
      type: "build_structure" as const,
      params: {
        minBlocks: 15,
        needsEnclosure: true,
      },
    },
    maxPoints: 500,
    timeBonus: true,
  },
  // ===== NEW TASKS =====
  {
    taskId: "build_bridge_20",
    name: "Bridge Builder",
    description: "Build a bridge at least 20 blocks long spanning a gap (must be suspended, not touching ground in middle).",
    category: "building" as const,
    difficulty: "medium" as const,
    requirements: {
      type: "build_structure" as const,
      params: {
        minLength: 20,
        suspended: true,
      },
    },
    maxPoints: 150,
    timeBonus: true,
  },
  {
    taskId: "build_pyramid",
    name: "Pyramid Architect",
    description: "Build a pyramid at least 5 layers tall using sand or stone blocks.",
    category: "building" as const,
    difficulty: "medium" as const,
    requirements: {
      type: "build_structure" as const,
      params: {
        shape: "pyramid",
        minLayers: 5,
        allowedBlocks: [1, 7], // Stone, Sand
      },
    },
    maxPoints: 200,
    timeBonus: true,
  },
  {
    taskId: "build_pixel_art",
    name: "Pixel Artist",
    description: "Create a 2D pixel art image using at least 3 different colored wool or concrete blocks. Minimum 8x8.",
    category: "building" as const,
    difficulty: "hard" as const,
    requirements: {
      type: "build_structure" as const,
      params: {
        minWidth: 8,
        minHeight: 8,
        flat: true,
        minBlockTypes: 3,
        allowedBlocks: [16, 17, 18, 19, 20, 21, 35, 36, 37, 38, 39, 40], // Wool + Concrete
      },
    },
    maxPoints: 350,
    timeBonus: false,
  },
  {
    taskId: "collect_iron_10",
    name: "Iron Miner",
    description: "Collect 10 iron blocks.",
    category: "mining" as const,
    difficulty: "medium" as const,
    requirements: {
      type: "collect_blocks" as const,
      params: {
        blockId: 27, // IRON
        count: 10,
      },
    },
    maxPoints: 120,
    timeBonus: true,
  },
  {
    taskId: "collect_gold_5",
    name: "Gold Rush",
    description: "Collect 5 gold blocks.",
    category: "mining" as const,
    difficulty: "medium" as const,
    requirements: {
      type: "collect_blocks" as const,
      params: {
        blockId: 26, // GOLD
        count: 5,
      },
    },
    maxPoints: 150,
    timeBonus: true,
  },
  {
    taskId: "explore_1000",
    name: "Long Journey",
    description: "Travel at least 1000 blocks from your starting position.",
    category: "exploration" as const,
    difficulty: "hard" as const,
    requirements: {
      type: "reach_location" as const,
      params: {
        minDistance: 1000,
      },
    },
    maxPoints: 300,
    timeBonus: false,
  },
  {
    taskId: "explore_mountain_peak",
    name: "Summit Seeker",
    description: "Reach a mountain peak (Y > 100) in the Mountains biome.",
    category: "exploration" as const,
    difficulty: "medium" as const,
    requirements: {
      type: "reach_location" as const,
      params: {
        minY: 100,
        biome: "mountains",
      },
    },
    maxPoints: 175,
    timeBonus: true,
  },
  {
    taskId: "explore_ocean_floor",
    name: "Deep Diver",
    description: "Reach the ocean floor (Y < 50) in an Ocean biome.",
    category: "exploration" as const,
    difficulty: "easy" as const,
    requirements: {
      type: "reach_location" as const,
      params: {
        maxY: 50,
        biome: "ocean",
      },
    },
    maxPoints: 75,
    timeBonus: true,
  },
  {
    taskId: "build_staircase_30",
    name: "Stairway Builder",
    description: "Build a staircase at least 30 blocks tall using stair blocks.",
    category: "building" as const,
    difficulty: "medium" as const,
    requirements: {
      type: "build_structure" as const,
      params: {
        minHeight: 30,
        useStairs: true,
        allowedBlocks: [31, 32], // Stone/Wood stairs
      },
    },
    maxPoints: 175,
    timeBonus: true,
  },
  {
    taskId: "build_maze",
    name: "Maze Maker",
    description: "Build a maze at least 10x10 with walls 2 blocks high. Must have one entrance and one exit.",
    category: "building" as const,
    difficulty: "hard" as const,
    requirements: {
      type: "build_structure" as const,
      params: {
        minWidth: 10,
        minDepth: 10,
        wallHeight: 2,
        needsEntrance: true,
        needsExit: true,
      },
    },
    maxPoints: 400,
    timeBonus: true,
  },
  {
    taskId: "speedrun_tower",
    name: "Speedrun: Tower",
    description: "Build a 15-block tall tower as fast as possible.",
    category: "speedrun" as const,
    difficulty: "easy" as const,
    requirements: {
      type: "build_structure" as const,
      params: {
        minHeight: 15,
      },
    },
    maxPoints: 300,
    timeBonus: true,
  },
  {
    taskId: "speedrun_100_blocks",
    name: "Speedrun: Mass Builder",
    description: "Place 100 blocks as fast as possible.",
    category: "speedrun" as const,
    difficulty: "medium" as const,
    requirements: {
      type: "custom" as const,
      params: {
        customType: "place_blocks",
        count: 100,
      },
    },
    maxPoints: 400,
    timeBonus: true,
  },
  {
    taskId: "efficiency_shelter",
    name: "Efficient Shelter",
    description: "Build an enclosed shelter using exactly 27 blocks (no more, no less). 3x3x3 with door.",
    category: "building" as const,
    difficulty: "hard" as const,
    requirements: {
      type: "build_structure" as const,
      params: {
        exactBlocks: 27,
        needsEnclosure: true,
        needsOpening: true,
      },
    },
    maxPoints: 250,
    timeBonus: false,
  },
  {
    taskId: "collect_variety_10",
    name: "Block Collector",
    description: "Collect at least 1 of 10 different block types.",
    category: "mining" as const,
    difficulty: "medium" as const,
    requirements: {
      type: "custom" as const,
      params: {
        customType: "collect_variety",
        uniqueTypes: 10,
      },
    },
    maxPoints: 175,
    timeBonus: true,
  },
  {
    taskId: "chat_10",
    name: "Socializer",
    description: "Send 10 chat messages to other agents.",
    category: "exploration" as const,
    difficulty: "easy" as const,
    requirements: {
      type: "custom" as const,
      params: {
        customType: "chat_messages",
        count: 10,
      },
    },
    maxPoints: 50,
    timeBonus: false,
  },
  {
    taskId: "build_glass_dome",
    name: "Dome Builder",
    description: "Build a glass dome at least 7 blocks in diameter.",
    category: "building" as const,
    difficulty: "hard" as const,
    requirements: {
      type: "build_structure" as const,
      params: {
        shape: "dome",
        minDiameter: 7,
        allowedBlocks: [12], // Glass
      },
    },
    maxPoints: 400,
    timeBonus: true,
  },
  {
    taskId: "waypoint_5",
    name: "Navigator",
    description: "Create 5 waypoints in different locations (at least 50 blocks apart).",
    category: "exploration" as const,
    difficulty: "easy" as const,
    requirements: {
      type: "custom" as const,
      params: {
        customType: "create_waypoints",
        count: 5,
        minDistance: 50,
      },
    },
    maxPoints: 75,
    timeBonus: false,
  },
  {
    taskId: "survival_craft_chain",
    name: "Survival Chain",
    description: "Complete the survival chain: collect wood → craft planks → craft wooden pickaxe → mine stone → craft stone pickaxe.",
    category: "mining" as const,
    difficulty: "medium" as const,
    requirements: {
      type: "custom" as const,
      params: {
        customType: "craft_chain",
        chain: ["collect_wood", "craft_planks", "craft_wooden_pickaxe", "collect_stone", "craft_stone_pickaxe"],
      },
    },
    maxPoints: 200,
    timeBonus: true,
  },
];

// ============ QUERIES ============

// List all available tasks
export const listTasks = query({
  args: {
    category: v.optional(v.string()),
    difficulty: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let tasks = await ctx.db.query("tasks")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();
    
    if (args.category) {
      tasks = tasks.filter(t => t.category === args.category);
    }
    if (args.difficulty) {
      tasks = tasks.filter(t => t.difficulty === args.difficulty);
    }
    
    return tasks;
  },
});

// Get a specific task
export const getTask = query({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    const task = await ctx.db.query("tasks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .first();
    return task;
  },
});

// Get task completions for a task
export const getTaskCompletions = query({
  args: { taskId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const completions = await ctx.db.query("taskCompletions")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .order("desc")
      .take(args.limit ?? 50);
    
    // Sort by score descending
    return completions.sort((a, b) => b.score - a.score);
  },
});

// Get agent's task progress
export const getAgentTasks = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const completions = await ctx.db.query("taskCompletions")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    
    const attempts = await ctx.db.query("taskAttempts")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    
    return { completions, attempts };
  },
});

// Get active attempt for an agent on a task
export const getActiveAttempt = query({
  args: { taskId: v.string(), agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const attempts = await ctx.db.query("taskAttempts")
      .withIndex("by_task_agent", (q) => q.eq("taskId", args.taskId).eq("agentId", args.agentId))
      .collect();
    
    return attempts.find(a => a.status === "active") ?? null;
  },
});

// ============ LEADERBOARD ============

export const getLeaderboard = query({
  args: { 
    limit: v.optional(v.number()),
    taskId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    
    // If specific task, get top scores for that task
    if (args.taskId) {
      const completions = await ctx.db.query("taskCompletions")
        .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
        .collect();
      
      return completions
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((c, i) => ({
          rank: i + 1,
          agentId: c.agentId,
          agentName: c.agentName,
          score: c.score,
          taskId: c.taskId,
          completedAt: c.completedAt,
          timeMs: c.timeMs,
        }));
    }
    
    // Global leaderboard: aggregate scores per agent
    const allCompletions = await ctx.db.query("taskCompletions").collect();
    
    const agentScores: Record<string, { agentId: string; agentName: string; totalScore: number; tasksCompleted: number }> = {};
    
    for (const c of allCompletions) {
      const key = c.agentId;
      if (!agentScores[key]) {
        agentScores[key] = {
          agentId: c.agentId,
          agentName: c.agentName,
          totalScore: 0,
          tasksCompleted: 0,
        };
      }
      agentScores[key].totalScore += c.score;
      agentScores[key].tasksCompleted += 1;
    }
    
    return Object.values(agentScores)
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, limit)
      .map((a, i) => ({
        rank: i + 1,
        ...a,
      }));
  },
});

// ============ MUTATIONS ============

// Seed default tasks (run once)
export const seedTasks = mutation({
  args: {},
  handler: async (ctx) => {
    for (const taskDef of TASK_DEFINITIONS) {
      // Check if already exists
      const existing = await ctx.db.query("tasks")
        .withIndex("by_taskId", (q) => q.eq("taskId", taskDef.taskId))
        .first();
      
      if (!existing) {
        await ctx.db.insert("tasks", {
          ...taskDef,
          enabled: true,
          createdAt: Date.now(),
        });
      }
    }
    return { seeded: TASK_DEFINITIONS.length };
  },
});

// Start a task attempt
export const startTask = mutation({
  args: {
    taskId: v.string(),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    // Check task exists
    const task = await ctx.db.query("tasks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .first();
    
    if (!task || !task.enabled) {
      return { success: false, error: "Task not found or disabled" };
    }
    
    // Check for existing active attempt
    const existing = await ctx.db.query("taskAttempts")
      .withIndex("by_task_agent", (q) => q.eq("taskId", args.taskId).eq("agentId", args.agentId))
      .collect();
    
    const activeAttempt = existing.find(a => a.status === "active");
    if (activeAttempt) {
      return { 
        success: true, 
        attemptId: activeAttempt._id, 
        startedAt: activeAttempt.startedAt,
        message: "Already have an active attempt" 
      };
    }
    
    // Get agent's current position
    const agent = await ctx.db.get(args.agentId);
    
    // Create new attempt
    const attemptId = await ctx.db.insert("taskAttempts", {
      taskId: args.taskId,
      agentId: args.agentId,
      startedAt: Date.now(),
      status: "active",
      startPosition: agent?.position,
    });
    
    return { success: true, attemptId, startedAt: Date.now() };
  },
});

// Submit task completion
export const submitTask = mutation({
  args: {
    taskId: v.string(),
    agentId: v.id("agents"),
    details: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Get the task
    const task = await ctx.db.query("tasks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .first();
    
    if (!task) {
      return { success: false, error: "Task not found" };
    }
    
    // Get active attempt
    const attempts = await ctx.db.query("taskAttempts")
      .withIndex("by_task_agent", (q) => q.eq("taskId", args.taskId).eq("agentId", args.agentId))
      .collect();
    
    const activeAttempt = attempts.find(a => a.status === "active");
    if (!activeAttempt) {
      return { success: false, error: "No active attempt. Start the task first." };
    }
    
    // Get agent info
    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      return { success: false, error: "Agent not found" };
    }
    
    // Calculate time taken
    const timeMs = Date.now() - activeAttempt.startedAt;
    
    // Calculate score (base + time bonus)
    let score = task.maxPoints;
    if (task.timeBonus) {
      // Bonus: up to 50% extra points for speed
      // Baseline: 5 minutes (300000ms) for full bonus decay
      const timeBonusMultiplier = Math.max(0, 1 - (timeMs / 300000));
      const timeBonus = Math.floor(task.maxPoints * 0.5 * timeBonusMultiplier);
      score += timeBonus;
    }
    
    // Check if already completed this task (only count first completion for leaderboard)
    const existingCompletion = await ctx.db.query("taskCompletions")
      .withIndex("by_task_agent", (q) => q.eq("taskId", args.taskId).eq("agentId", args.agentId))
      .first();
    
    // Mark attempt as completed
    await ctx.db.patch(activeAttempt._id, { status: "completed" });
    
    // Record completion (update if better score)
    if (!existingCompletion) {
      await ctx.db.insert("taskCompletions", {
        taskId: args.taskId,
        agentId: args.agentId,
        agentName: agent.username,
        completedAt: Date.now(),
        score,
        timeMs,
        details: args.details,
      });
    } else if (score > existingCompletion.score) {
      // Update with better score
      await ctx.db.patch(existingCompletion._id, {
        score,
        timeMs,
        completedAt: Date.now(),
        details: args.details,
      });
    }
    
    return { 
      success: true, 
      score,
      timeMs,
      isNewBest: !existingCompletion || score > existingCompletion.score,
      previousBest: existingCompletion?.score,
    };
  },
});

// Abandon a task attempt
export const abandonTask = mutation({
  args: {
    taskId: v.string(),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const attempts = await ctx.db.query("taskAttempts")
      .withIndex("by_task_agent", (q) => q.eq("taskId", args.taskId).eq("agentId", args.agentId))
      .collect();
    
    const activeAttempt = attempts.find(a => a.status === "active");
    if (!activeAttempt) {
      return { success: false, error: "No active attempt" };
    }
    
    await ctx.db.patch(activeAttempt._id, { status: "failed" });
    return { success: true };
  },
});
