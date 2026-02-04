import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Constants
const CHUNK_SIZE = 16;

const BLOCK_TYPES = {
  AIR: 0,
  STONE: 1,
  DIRT: 2,
  GRASS: 3,
  WOOD: 4,
  LEAVES: 5,
  WATER: 6,
  SAND: 7,
  BEDROCK: 8,
  FLOWER_RED: 9,
  FLOWER_YELLOW: 10,
  TALL_GRASS: 11,
} as const;

const BLOCK_INFO = [
  { id: 0, name: "Air", solid: false, buildable: false },
  { id: 1, name: "Stone", solid: true, buildable: true },
  { id: 2, name: "Dirt", solid: true, buildable: true },
  { id: 3, name: "Grass", solid: true, buildable: true },
  { id: 4, name: "Wood", solid: true, buildable: true },
  { id: 5, name: "Leaves", solid: true, buildable: true },
  { id: 6, name: "Water", solid: false, buildable: false },
  { id: 7, name: "Sand", solid: true, buildable: true },
  { id: 8, name: "Bedrock", solid: true, buildable: false },
  { id: 9, name: "Red Flower", solid: false, buildable: true },
  { id: 10, name: "Yellow Flower", solid: false, buildable: true },
  { id: 11, name: "Tall Grass", solid: false, buildable: true },
];

// Helper: Get token from Authorization header
function getTokenFromHeader(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth) return null;
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return auth;
}

// Helper: JSON response
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Helper: Decode base64 blocks to array
function decodeBlocks(base64: string): number[] {
  const binary = atob(base64);
  const blocks: number[] = [];
  for (let i = 0; i < binary.length; i++) {
    blocks.push(binary.charCodeAt(i));
  }
  return blocks;
}

// Helper: Encode blocks array to base64
function encodeBlocks(blocks: number[]): string {
  return btoa(String.fromCharCode(...blocks));
}

// Helper: Get block at position in chunk
function getBlockAt(blocks: number[], localX: number, localY: number, localZ: number): number {
  if (localX < 0 || localX >= CHUNK_SIZE || localY < 0 || localY >= CHUNK_SIZE || localZ < 0 || localZ >= CHUNK_SIZE) {
    return -1;
  }
  const index = localX + localY * CHUNK_SIZE + localZ * CHUNK_SIZE * CHUNK_SIZE;
  return blocks[index] ?? 0;
}

// Helper: Set block at position in chunk
function setBlockAt(blocks: number[], localX: number, localY: number, localZ: number, blockType: number): void {
  const index = localX + localY * CHUNK_SIZE + localZ * CHUNK_SIZE * CHUNK_SIZE;
  blocks[index] = blockType;
}

// ============================================================================
// OPTIONS handlers for CORS
// ============================================================================

const optionsPaths = ["/auth/signup", "/auth/verify", "/agent/connect", "/agent/world", "/agent/action", "/agent/blocks", "/agent/chat", "/agent/agents"];
for (const path of optionsPaths) {
  http.route({
    path,
    method: "OPTIONS",
    handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
  });
}

// ============================================================================
// AUTH ENDPOINTS
// ============================================================================

/**
 * POST /auth/signup - Start signup process
 */
http.route({
  path: "/auth/signup",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { username } = body as { username?: string };

      if (!username) {
        return jsonResponse({ error: "Username required" }, 400);
      }

      const result = await ctx.runMutation(api.agents.startSignup, { username });

      return jsonResponse({
        ...result,
        instructions: {
          step1: `Post on Twitter with this exact code: ${result.code}`,
          step2: `Example tweet: "Joining ClawCraft! 🧱 Verify: ${result.code} #ClawCraft"`,
          step3: "Copy your tweet URL and call POST /auth/verify",
          important: "Save your secret token after verification - you need it to connect!",
        },
      });
    } catch (err: any) {
      return jsonResponse({ error: err.message }, 400);
    }
  }),
});

/**
 * POST /auth/verify - Verify Twitter post and complete signup
 */
http.route({
  path: "/auth/verify",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { signupId, postUrl } = body as { signupId?: string; postUrl?: string };

      if (!signupId || !postUrl) {
        return jsonResponse({ error: "signupId and postUrl required" }, 400);
      }

      const pending = await ctx.runQuery(api.auth.getPendingSignup, { id: signupId });
      if (!pending) {
        return jsonResponse({ error: "Signup not found or expired" }, 400);
      }

      const twitterData = await fetchTwitterPost(postUrl);

      if (!twitterData.content.includes(pending.code)) {
        return jsonResponse({ error: `Verification code "${pending.code}" not found in tweet` }, 400);
      }

      const result = await ctx.runMutation(api.agents.verifyAndCreate, {
        signupId: pending._id,
        provider: "twitter",
        socialId: twitterData.authorId,
        socialHandle: twitterData.authorHandle,
        postUrl,
      });

      return jsonResponse({
        success: true,
        agent: {
          id: result.agentId,
          username: pending.username,
          provider: "twitter",
          socialHandle: twitterData.authorHandle,
        },
        secretToken: result.secretToken,
        message: `Welcome to ClawCraft, ${pending.username}! Save your secret token.`,
      });
    } catch (err: any) {
      return jsonResponse({ error: err.message }, 400);
    }
  }),
});

// ============================================================================
// AGENT API
// ============================================================================

/**
 * GET /agent/blocks - Get available block types for building
 */
http.route({
  path: "/agent/blocks",
  method: "GET",
  handler: httpAction(async () => {
    return jsonResponse({
      blocks: BLOCK_INFO.filter(b => b.buildable),
      allBlocks: BLOCK_INFO,
    });
  }),
});

/**
 * GET /agent/chat - Get recent chat messages
 * Header: Authorization: Bearer <token>
 * Query: ?limit=50 (max 100)
 */
http.route({
  path: "/agent/chat",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const token = getTokenFromHeader(request);
      if (!token) {
        return jsonResponse({ error: "Authorization header required" }, 401);
      }

      const agent = await ctx.runQuery(api.agents.getByToken, { token });
      if (!agent) {
        return jsonResponse({ error: "Invalid token" }, 401);
      }

      const url = new URL(request.url);
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

      const messages = await ctx.runQuery(api.chat.list, { limit });

      return jsonResponse({
        messages: messages.map(m => ({
          id: m._id,
          sender: m.senderName,
          message: m.message,
          timestamp: m._creationTime,
        })),
        count: messages.length,
      });
    } catch (err: any) {
      return jsonResponse({ error: err.message }, 500);
    }
  }),
});

/**
 * GET /agent/agents - Get online agents
 * Header: Authorization: Bearer <token>
 */
http.route({
  path: "/agent/agents",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const token = getTokenFromHeader(request);
      if (!token) {
        return jsonResponse({ error: "Authorization header required" }, 401);
      }

      const agent = await ctx.runQuery(api.agents.getByToken, { token });
      if (!agent) {
        return jsonResponse({ error: "Invalid token" }, 401);
      }

      const onlineAgents = await ctx.runQuery(api.game.getOnlineAgents, {});

      return jsonResponse({
        you: {
          id: agent._id,
          username: agent.username,
          position: agent.position,
        },
        online: onlineAgents.map(a => ({
          id: a._id,
          username: a.username,
          position: a.position,
          lastSeen: a.lastSeen,
        })),
        count: onlineAgents.length,
      });
    } catch (err: any) {
      return jsonResponse({ error: err.message }, 500);
    }
  }),
});

/**
 * POST /agent/connect - Authenticate and get initial state
 * Header: Authorization: Bearer <token>
 */
http.route({
  path: "/agent/connect",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const token = getTokenFromHeader(request);
      if (!token) {
        return jsonResponse({ error: "Authorization header required" }, 401);
      }

      const agent = await ctx.runQuery(api.agents.getByToken, { token });
      if (!agent) {
        return jsonResponse({ error: "Invalid token" }, 401);
      }

      // Update last seen
      await ctx.runMutation(api.agents.updateLastSeen, { id: agent._id });

      // Get online agents
      const onlineAgents = await ctx.runQuery(api.game.getOnlineAgents, {});

      return jsonResponse({
        success: true,
        agent: {
          id: agent._id,
          username: agent.username,
          position: agent.position || { x: 0, y: 64, z: 0 },
          rotation: agent.rotation || { x: 0, y: 0, z: 0 },
        },
        world: {
          spawnPoint: { x: 0, y: 65, z: 0 },
          chunkSize: CHUNK_SIZE,
          buildableBlocks: BLOCK_INFO.filter(b => b.buildable),
        },
        onlineAgents: onlineAgents.map(a => ({
          id: a._id,
          username: a.username,
          position: a.position,
        })),
      });
    } catch (err: any) {
      return jsonResponse({ error: err.message }, 500);
    }
  }),
});

/**
 * GET /agent/world - Get world state around agent
 * Header: Authorization: Bearer <token>
 * Query: ?radius=2 (chunks around agent, default 2)
 */
http.route({
  path: "/agent/world",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const token = getTokenFromHeader(request);
      if (!token) {
        return jsonResponse({ error: "Authorization header required" }, 401);
      }

      const agent = await ctx.runQuery(api.agents.getByToken, { token });
      if (!agent) {
        return jsonResponse({ error: "Invalid token" }, 401);
      }

      const url = new URL(request.url);
      const radius = Math.min(parseInt(url.searchParams.get("radius") || "2"), 4);

      const pos = agent.position || { x: 0, y: 64, z: 0 };
      const cx = Math.floor(pos.x / CHUNK_SIZE);
      const cy = Math.floor(pos.y / CHUNK_SIZE);
      const cz = Math.floor(pos.z / CHUNK_SIZE);

      // Get chunks around agent
      const coords: Array<{ key: string; cx: number; cy: number; cz: number }> = [];
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -radius; dz <= radius; dz++) {
            coords.push({
              key: `${cx + dx},${cy + dy},${cz + dz}`,
              cx: cx + dx,
              cy: cy + dy,
              cz: cz + dz,
            });
          }
        }
      }

      const chunks = await ctx.runMutation(api.chunks.getOrGenerateMany, { coords });

      // Get online agents
      const onlineAgents = await ctx.runQuery(api.game.getOnlineAgents, {});

      // Decode chunks into readable format
      const worldData: Record<string, {
        cx: number;
        cy: number;
        cz: number;
        blocks: number[][][]; // [x][y][z]
      }> = {};

      for (const [key, chunk] of Object.entries(chunks)) {
        if (!chunk) continue;
        const decoded = decodeBlocks(chunk.blocksBase64);
        
        // Convert flat array to 3D for easier agent use
        const blocks3D: number[][][] = [];
        for (let x = 0; x < CHUNK_SIZE; x++) {
          blocks3D[x] = [];
          for (let y = 0; y < CHUNK_SIZE; y++) {
            blocks3D[x][y] = [];
            for (let z = 0; z < CHUNK_SIZE; z++) {
              blocks3D[x][y][z] = getBlockAt(decoded, x, y, z);
            }
          }
        }

        worldData[key] = {
          cx: chunk.cx,
          cy: chunk.cy,
          cz: chunk.cz,
          blocks: blocks3D,
        };
      }

      return jsonResponse({
        agent: {
          id: agent._id,
          username: agent.username,
          position: pos,
        },
        chunks: worldData,
        onlineAgents: onlineAgents.map(a => ({
          id: a._id,
          username: a.username,
          position: a.position,
        })),
        blockTypes: BLOCK_INFO,
      });
    } catch (err: any) {
      return jsonResponse({ error: err.message }, 500);
    }
  }),
});

/**
 * POST /agent/action - Perform an action
 * Header: Authorization: Bearer <token>
 * Body: { type: "move|place|break|chat", ... }
 */
http.route({
  path: "/agent/action",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const token = getTokenFromHeader(request);
      if (!token) {
        return jsonResponse({ error: "Authorization header required" }, 401);
      }

      const agent = await ctx.runQuery(api.agents.getByToken, { token });
      if (!agent) {
        return jsonResponse({ error: "Invalid token" }, 401);
      }

      const body = await request.json() as any;
      const { type } = body;

      switch (type) {
        case "move": {
          const { x, y, z } = body;
          if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") {
            return jsonResponse({ error: "move requires x, y, z coordinates" }, 400);
          }
          
          await ctx.runMutation(api.game.tick, {
            agentId: agent._id,
            position: { x, y, z },
            rotation: agent.rotation || { x: 0, y: 0, z: 0 },
          });

          return jsonResponse({ success: true, position: { x, y, z } });
        }

        case "place": {
          const { x, y, z, blockType } = body;
          if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") {
            return jsonResponse({ error: "place requires x, y, z coordinates" }, 400);
          }
          if (typeof blockType !== "number" || !BLOCK_INFO.find(b => b.id === blockType && b.buildable)) {
            return jsonResponse({ error: "Invalid or non-buildable block type" }, 400);
          }

          // Get chunk
          const cx = Math.floor(x / CHUNK_SIZE);
          const cy = Math.floor(y / CHUNK_SIZE);
          const cz = Math.floor(z / CHUNK_SIZE);
          const key = `${cx},${cy},${cz}`;

          const chunks = await ctx.runMutation(api.chunks.getOrGenerateMany, {
            coords: [{ key, cx, cy, cz }],
          });

          const chunk = chunks[key];
          if (!chunk) {
            return jsonResponse({ error: "Failed to load chunk" }, 500);
          }

          // Modify block
          const blocks = decodeBlocks(chunk.blocksBase64);
          const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
          const localY = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
          const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

          setBlockAt(blocks, localX, localY, localZ, blockType);

          // Save chunk
          await ctx.runMutation(api.chunks.save, {
            key,
            cx,
            cy,
            cz,
            blocksBase64: encodeBlocks(blocks),
          });

          return jsonResponse({
            success: true,
            placed: { x, y, z, blockType, blockName: BLOCK_INFO[blockType]?.name },
          });
        }

        case "break": {
          const { x, y, z } = body;
          if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") {
            return jsonResponse({ error: "break requires x, y, z coordinates" }, 400);
          }

          // Get chunk
          const cx = Math.floor(x / CHUNK_SIZE);
          const cy = Math.floor(y / CHUNK_SIZE);
          const cz = Math.floor(z / CHUNK_SIZE);
          const key = `${cx},${cy},${cz}`;

          const chunks = await ctx.runMutation(api.chunks.getOrGenerateMany, {
            coords: [{ key, cx, cy, cz }],
          });

          const chunk = chunks[key];
          if (!chunk) {
            return jsonResponse({ error: "Failed to load chunk" }, 500);
          }

          // Check if block can be broken
          const blocks = decodeBlocks(chunk.blocksBase64);
          const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
          const localY = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
          const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

          const currentBlock = getBlockAt(blocks, localX, localY, localZ);
          if (currentBlock === BLOCK_TYPES.BEDROCK) {
            return jsonResponse({ error: "Cannot break bedrock" }, 400);
          }
          if (currentBlock === BLOCK_TYPES.AIR) {
            return jsonResponse({ error: "No block at this position" }, 400);
          }

          // Break block
          setBlockAt(blocks, localX, localY, localZ, BLOCK_TYPES.AIR);

          await ctx.runMutation(api.chunks.save, {
            key,
            cx,
            cy,
            cz,
            blocksBase64: encodeBlocks(blocks),
          });

          return jsonResponse({
            success: true,
            broken: { x, y, z, wasBlockType: currentBlock, wasBlockName: BLOCK_INFO[currentBlock]?.name },
          });
        }

        case "chat": {
          const { message } = body;
          if (typeof message !== "string" || !message.trim()) {
            return jsonResponse({ error: "chat requires message" }, 400);
          }

          await ctx.runMutation(api.chat.send, {
            senderId: agent._id,
            senderName: agent.username,
            message: message.trim().slice(0, 500),
          });

          return jsonResponse({ success: true, sent: message.trim().slice(0, 500) });
        }

        default:
          return jsonResponse({ error: `Unknown action type: ${type}. Valid: move, place, break, chat` }, 400);
      }
    } catch (err: any) {
      return jsonResponse({ error: err.message }, 500);
    }
  }),
});

// ============================================================================
// HELPERS
// ============================================================================

async function fetchTwitterPost(url: string): Promise<{
  content: string;
  authorId: string;
  authorHandle: string;
}> {
  const match = url.match(/(?:twitter\.com|x\.com)\/([^/]+)\/status\/(\d+)/);
  if (!match) {
    throw new Error("Invalid Twitter URL format");
  }

  const [, handle, tweetId] = match;

  const response = await fetch(
    `https://api.fxtwitter.com/status/${tweetId}`,
    { headers: { "User-Agent": "ClawCraft/1.0" } }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch tweet");
  }

  const data = await response.json() as any;

  if (!data.tweet) {
    throw new Error("Tweet not found");
  }

  return {
    content: data.tweet.text || "",
    authorId: data.tweet.author?.id || handle,
    authorHandle: data.tweet.author?.screen_name || handle!,
  };
}

export default http;
