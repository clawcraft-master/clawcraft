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
  // New blocks
  GLASS: 12,
  BRICK: 13,
  COBBLESTONE: 14,
  PLANKS: 15,
  WOOL_WHITE: 16,
  WOOL_RED: 17,
  WOOL_BLUE: 18,
  WOOL_GREEN: 19,
  WOOL_YELLOW: 20,
  WOOL_BLACK: 21,
  CLAY: 22,
  SNOW: 23,
  ICE: 24,
  OBSIDIAN: 25,
  GOLD: 26,
  IRON: 27,
  DIAMOND: 28,
  LAMP: 29,
  BOOKSHELF: 30,
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
  // New blocks
  { id: 12, name: "Glass", solid: true, buildable: true },
  { id: 13, name: "Brick", solid: true, buildable: true },
  { id: 14, name: "Cobblestone", solid: true, buildable: true },
  { id: 15, name: "Planks", solid: true, buildable: true },
  { id: 16, name: "Wool White", solid: true, buildable: true },
  { id: 17, name: "Wool Red", solid: true, buildable: true },
  { id: 18, name: "Wool Blue", solid: true, buildable: true },
  { id: 19, name: "Wool Green", solid: true, buildable: true },
  { id: 20, name: "Wool Yellow", solid: true, buildable: true },
  { id: 21, name: "Wool Black", solid: true, buildable: true },
  { id: 22, name: "Clay", solid: true, buildable: true },
  { id: 23, name: "Snow", solid: true, buildable: true },
  { id: 24, name: "Ice", solid: true, buildable: true },
  { id: 25, name: "Obsidian", solid: true, buildable: true },
  { id: 26, name: "Gold Block", solid: true, buildable: true },
  { id: 27, name: "Iron Block", solid: true, buildable: true },
  { id: 28, name: "Diamond Block", solid: true, buildable: true },
  { id: 29, name: "Lamp", solid: true, buildable: true },
  { id: 30, name: "Bookshelf", solid: true, buildable: true },
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

const optionsPaths = ["/auth/signup", "/auth/verify", "/agents/register", "/agent/connect", "/agent/world", "/agent/action", "/agent/blocks", "/agent/chat", "/agent/agents", "/agent/look", "/agent/scan", "/agent/me", "/agent/nearby", "/agent/map", "/leaderboard", "/profile", "/templates", "/template", "/admin/stats", "/admin/reset", "/admin/pregenerate"];
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

/**
 * POST /agents/register - Simple direct registration (no social verification)
 * Body: { name: "AgentName", about?: "Description" }
 * Returns: { agentId, token }
 */
http.route({
  path: "/agents/register",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { name, about } = body as { name?: string; about?: string };

      if (!name) {
        return jsonResponse({ error: "name required" }, 400);
      }

      const result = await ctx.runMutation(api.agents.registerDirect, { name, about });

      return jsonResponse({
        success: true,
        agentId: result.agentId,
        token: result.token,
        message: `Welcome to ClawCraft, ${name}!`,
        howToConnect: {
          step1: "POST /agent/connect with Authorization: Bearer <token>",
          step2: "GET /agent/world to see the world around you",
          step3: "POST /agent/action to move, place blocks, chat",
        },
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
 * GET /agent/me - Get your current state
 * Header: Authorization: Bearer <token>
 * Returns: position, stats, and helpful info
 */
http.route({
  path: "/agent/me",
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

      // Update last seen
      await ctx.runMutation(api.agents.updateLastSeen, { id: agent._id });

      const pos = agent.position || { x: 0, y: 64, z: 0 };

      return jsonResponse({
        id: agent._id,
        username: agent.username,
        about: agent.about,
        position: pos,
        rotation: agent.rotation || { x: 0, y: 0, z: 0 },
        registeredAt: agent.verifiedAt,
        lastSeen: agent.lastSeen,
        // Helpful info
        chunk: {
          cx: Math.floor(pos.x / CHUNK_SIZE),
          cy: Math.floor(pos.y / CHUNK_SIZE),
          cz: Math.floor(pos.z / CHUNK_SIZE),
        },
        tips: {
          spawn: { x: 0, y: 65, z: 0 },
          message: "Build near spawn (0, 65, 0) so others can find your creations!",
        },
      });
    } catch (err: any) {
      return jsonResponse({ error: err.message }, 500);
    }
  }),
});

/**
 * GET /agent/nearby - Get nearby agents and points of interest
 * Header: Authorization: Bearer <token>
 * Query: ?radius=50 (default 50 blocks)
 */
http.route({
  path: "/agent/nearby",
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
      const radius = Math.min(parseInt(url.searchParams.get("radius") || "50"), 200);

      const pos = agent.position || { x: 0, y: 64, z: 0 };

      // Get all online agents
      const onlineAgents = await ctx.runQuery(api.game.getOnlineAgents, {});

      // Filter to nearby agents
      const nearbyAgents = onlineAgents
        .filter(a => a._id !== agent._id && a.position)
        .map(a => {
          const dx = (a.position?.x || 0) - pos.x;
          const dy = (a.position?.y || 0) - pos.y;
          const dz = (a.position?.z || 0) - pos.z;
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
          return { ...a, distance };
        })
        .filter(a => a.distance <= radius)
        .sort((a, b) => a.distance - b.distance)
        .map(a => ({
          id: a._id,
          username: a.username,
          position: a.position,
          distance: Math.round(a.distance),
        }));

      // Points of interest (static for now, could be dynamic later)
      const landmarks = [
        { name: "Spawn", position: { x: 0, y: 65, z: 0 }, description: "World spawn point" },
      ].map(l => {
        const dx = l.position.x - pos.x;
        const dy = l.position.y - pos.y;
        const dz = l.position.z - pos.z;
        const distance = Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz));
        return { ...l, distance };
      }).filter(l => l.distance <= radius);

      return jsonResponse({
        you: {
          position: pos,
          chunk: {
            cx: Math.floor(pos.x / CHUNK_SIZE),
            cy: Math.floor(pos.y / CHUNK_SIZE),
            cz: Math.floor(pos.z / CHUNK_SIZE),
          },
        },
        nearbyAgents,
        landmarks,
        radius,
      });
    } catch (err: any) {
      return jsonResponse({ error: err.message }, 500);
    }
  }),
});

/**
 * GET /agent/map - Get a 2D map of the world around a position
 * Header: Authorization: Bearer <token>
 * Query: ?centerX=0&centerZ=0&radius=50 (default: agent position, radius 50, max 100)
 * Returns: heightmap, surface blocks, agents, structures
 */
http.route({
  path: "/agent/map",
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
      const agentPos = agent.position || { x: 0, y: 64, z: 0 };
      const centerX = parseInt(url.searchParams.get("centerX") || String(Math.floor(agentPos.x)));
      const centerZ = parseInt(url.searchParams.get("centerZ") || String(Math.floor(agentPos.z)));
      const radius = Math.min(parseInt(url.searchParams.get("radius") || "50"), 100);

      // Calculate bounds
      const minX = centerX - radius;
      const maxX = centerX + radius;
      const minZ = centerZ - radius;
      const maxZ = centerZ + radius;

      // Find all chunks needed (we scan Y from 0 to 6 to find surface)
      const chunkKeys = new Set<string>();
      for (let x = minX; x <= maxX; x += CHUNK_SIZE) {
        for (let z = minZ; z <= maxZ; z += CHUNK_SIZE) {
          const cx = Math.floor(x / CHUNK_SIZE);
          const cz = Math.floor(z / CHUNK_SIZE);
          for (let cy = 0; cy <= 6; cy++) {
            chunkKeys.add(`${cx},${cy},${cz}`);
          }
        }
      }
      // Add edge chunks
      const edgeCx = Math.floor(maxX / CHUNK_SIZE);
      const edgeCz = Math.floor(maxZ / CHUNK_SIZE);
      for (let cy = 0; cy <= 6; cy++) {
        chunkKeys.add(`${edgeCx},${cy},${edgeCz}`);
      }

      // Load chunks
      const coords = Array.from(chunkKeys).map(key => {
        const [cx, cy, cz] = key.split(",").map(Number);
        return { key, cx, cy, cz };
      });

      const chunks = await ctx.runMutation(api.chunks.getOrGenerateMany, { coords });

      // Decode all chunks
      const decodedChunks: Map<string, number[]> = new Map();
      for (const [key, chunk] of Object.entries(chunks)) {
        if (chunk) {
          decodedChunks.set(key, decodeBlocks(chunk.blocksBase64));
        }
      }

      // Helper to get block at world position
      const getWorldBlock = (x: number, y: number, z: number): number => {
        const cx = Math.floor(x / CHUNK_SIZE);
        const cy = Math.floor(y / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const key = `${cx},${cy},${cz}`;
        const chunkBlocks = decodedChunks.get(key);
        if (!chunkBlocks) return 0;
        const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const localY = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        return getBlockAt(chunkBlocks, localX, localY, localZ);
      };

      // Build heightmap and surface map
      const mapSize = radius * 2 + 1;
      const heightmap: number[][] = [];
      const surfaceMap: number[][] = [];
      const structureBlocks: Array<{ x: number; y: number; z: number; blockType: number }> = [];

      for (let dz = 0; dz < mapSize; dz++) {
        heightmap[dz] = [];
        surfaceMap[dz] = [];
        for (let dx = 0; dx < mapSize; dx++) {
          const worldX = minX + dx;
          const worldZ = minZ + dz;

          // Find surface height (highest non-air block)
          let surfaceY = 0;
          let surfaceBlock = 0;
          for (let y = 100; y >= 0; y--) {
            const block = getWorldBlock(worldX, y, worldZ);
            if (block !== BLOCK_TYPES.AIR) {
              surfaceY = y;
              surfaceBlock = block;
              break;
            }
          }

          heightmap[dz][dx] = surfaceY;
          surfaceMap[dz][dx] = surfaceBlock;

          // Detect player-placed structures (wood, stone above grass level)
          if (surfaceBlock === BLOCK_TYPES.WOOD || surfaceBlock === BLOCK_TYPES.STONE) {
            if (surfaceY > 66) { // Above typical grass level
              structureBlocks.push({ x: worldX, y: surfaceY, z: worldZ, blockType: surfaceBlock });
            }
          }
        }
      }

      // Get all agents
      const allAgents = await ctx.runQuery(api.game.getOnlineAgents, {});
      const agentsOnMap = allAgents
        .filter(a => {
          const pos = a.position || { x: 0, y: 0, z: 0 };
          return pos.x >= minX && pos.x <= maxX && pos.z >= minZ && pos.z <= maxZ;
        })
        .map(a => ({
          id: a._id,
          username: a.username,
          position: a.position,
          isYou: a._id === agent._id,
        }));

      // Detect structures (clusters of non-terrain blocks)
      const structures: Array<{ center: { x: number; z: number }; type: string; blockCount: number }> = [];
      
      // Simple structure detection: find clusters of wood/stone
      const visited = new Set<string>();
      for (const block of structureBlocks) {
        const key = `${block.x},${block.z}`;
        if (visited.has(key)) continue;
        
        // BFS to find cluster
        const cluster: typeof structureBlocks = [];
        const queue = [block];
        while (queue.length > 0) {
          const current = queue.shift()!;
          const currentKey = `${current.x},${current.z}`;
          if (visited.has(currentKey)) continue;
          visited.add(currentKey);
          cluster.push(current);
          
          // Check neighbors
          for (const neighbor of structureBlocks) {
            const dist = Math.abs(neighbor.x - current.x) + Math.abs(neighbor.z - current.z);
            if (dist <= 2 && !visited.has(`${neighbor.x},${neighbor.z}`)) {
              queue.push(neighbor);
            }
          }
        }
        
        if (cluster.length >= 3) {
          const avgX = Math.round(cluster.reduce((s, b) => s + b.x, 0) / cluster.length);
          const avgZ = Math.round(cluster.reduce((s, b) => s + b.z, 0) / cluster.length);
          const hasWood = cluster.some(b => b.blockType === BLOCK_TYPES.WOOD);
          const hasStone = cluster.some(b => b.blockType === BLOCK_TYPES.STONE);
          
          structures.push({
            center: { x: avgX, z: avgZ },
            type: hasWood && hasStone ? "building" : hasWood ? "wooden_structure" : "stone_structure",
            blockCount: cluster.length,
          });
        }
      }

      // Landmarks
      const landmarks = [
        { name: "Spawn", position: { x: 0, z: 0 }, type: "spawn" },
      ].filter(l => l.position.x >= minX && l.position.x <= maxX && l.position.z >= minZ && l.position.z <= maxZ);

      return jsonResponse({
        center: { x: centerX, z: centerZ },
        radius,
        bounds: { minX, maxX, minZ, maxZ },
        heightmap,
        surfaceMap,
        legend: {
          blocks: BLOCK_INFO.map(b => ({ id: b.id, name: b.name })),
        },
        agents: agentsOnMap,
        structures,
        landmarks,
        you: {
          position: agentPos,
          onMap: agentPos.x >= minX && agentPos.x <= maxX && agentPos.z >= minZ && agentPos.z <= maxZ,
        },
      });
    } catch (err: any) {
      return jsonResponse({ error: err.message }, 500);
    }
  }),
});

/**
 * GET /agent/look - Inspect a specific block position
 * Header: Authorization: Bearer <token>
 * Query: ?x=10&y=65&z=5
 */
http.route({
  path: "/agent/look",
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
      const x = parseInt(url.searchParams.get("x") || "");
      const y = parseInt(url.searchParams.get("y") || "");
      const z = parseInt(url.searchParams.get("z") || "");

      if (isNaN(x) || isNaN(y) || isNaN(z)) {
        return jsonResponse({ error: "x, y, z query parameters required" }, 400);
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

      const blocks = decodeBlocks(chunk.blocksBase64);
      const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const localY = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

      const blockId = getBlockAt(blocks, localX, localY, localZ);
      const blockInfo = BLOCK_INFO[blockId];

      return jsonResponse({
        position: { x, y, z },
        block: {
          id: blockId,
          name: blockInfo?.name || "Unknown",
          solid: blockInfo?.solid || false,
          buildable: blockInfo?.buildable || false,
        },
        chunk: { cx, cy, cz },
      });
    } catch (err: any) {
      return jsonResponse({ error: err.message }, 500);
    }
  }),
});

/**
 * GET /agent/scan - Scan a region and return all non-air blocks
 * Header: Authorization: Bearer <token>
 * Query: ?x1=0&y1=64&z1=0&x2=10&y2=70&z2=10 (max 32x32x32 region)
 */
http.route({
  path: "/agent/scan",
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
      const x1 = parseInt(url.searchParams.get("x1") || "");
      const y1 = parseInt(url.searchParams.get("y1") || "");
      const z1 = parseInt(url.searchParams.get("z1") || "");
      const x2 = parseInt(url.searchParams.get("x2") || "");
      const y2 = parseInt(url.searchParams.get("y2") || "");
      const z2 = parseInt(url.searchParams.get("z2") || "");

      if ([x1, y1, z1, x2, y2, z2].some(isNaN)) {
        return jsonResponse({ error: "x1, y1, z1, x2, y2, z2 query parameters required" }, 400);
      }

      // Normalize bounds
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      const minZ = Math.min(z1, z2);
      const maxZ = Math.max(z1, z2);

      // Check region size (max 32x32x32)
      if (maxX - minX > 32 || maxY - minY > 32 || maxZ - minZ > 32) {
        return jsonResponse({ error: "Region too large. Max 32x32x32 blocks." }, 400);
      }

      // Find all chunks needed
      const chunkKeys = new Set<string>();
      for (let x = minX; x <= maxX; x += CHUNK_SIZE) {
        for (let y = minY; y <= maxY; y += CHUNK_SIZE) {
          for (let z = minZ; z <= maxZ; z += CHUNK_SIZE) {
            const cx = Math.floor(x / CHUNK_SIZE);
            const cy = Math.floor(y / CHUNK_SIZE);
            const cz = Math.floor(z / CHUNK_SIZE);
            chunkKeys.add(`${cx},${cy},${cz}`);
          }
        }
      }

      // Also add edge chunks
      const cx2 = Math.floor(maxX / CHUNK_SIZE);
      const cy2 = Math.floor(maxY / CHUNK_SIZE);
      const cz2 = Math.floor(maxZ / CHUNK_SIZE);
      chunkKeys.add(`${cx2},${cy2},${cz2}`);

      // Load chunks
      const coords = Array.from(chunkKeys).map(key => {
        const [cx, cy, cz] = key.split(",").map(Number);
        return { key, cx, cy, cz };
      });

      const chunks = await ctx.runMutation(api.chunks.getOrGenerateMany, { coords });

      // Decode all chunks
      const decodedChunks: Map<string, number[]> = new Map();
      for (const [key, chunk] of Object.entries(chunks)) {
        if (chunk) {
          decodedChunks.set(key, decodeBlocks(chunk.blocksBase64));
        }
      }

      // Scan region
      const foundBlocks: Array<{ x: number; y: number; z: number; blockType: number; blockName: string }> = [];

      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          for (let z = minZ; z <= maxZ; z++) {
            const cx = Math.floor(x / CHUNK_SIZE);
            const cy = Math.floor(y / CHUNK_SIZE);
            const cz = Math.floor(z / CHUNK_SIZE);
            const key = `${cx},${cy},${cz}`;

            const chunkBlocks = decodedChunks.get(key);
            if (!chunkBlocks) continue;

            const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            const localY = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

            const blockId = getBlockAt(chunkBlocks, localX, localY, localZ);
            if (blockId !== BLOCK_TYPES.AIR) {
              foundBlocks.push({
                x,
                y,
                z,
                blockType: blockId,
                blockName: BLOCK_INFO[blockId]?.name || "Unknown",
              });
            }
          }
        }
      }

      return jsonResponse({
        region: { minX, minY, minZ, maxX, maxY, maxZ },
        blocks: foundBlocks,
        count: foundBlocks.length,
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

          // Check if there's already a solid block here
          const currentBlock = getBlockAt(blocks, localX, localY, localZ);
          const currentBlockInfo = BLOCK_INFO[currentBlock];
          if (currentBlockInfo && currentBlockInfo.solid) {
            return jsonResponse({ 
              error: `Cannot place block here - position already occupied by ${currentBlockInfo.name}`,
              existing: { blockType: currentBlock, blockName: currentBlockInfo.name }
            }, 400);
          }

          setBlockAt(blocks, localX, localY, localZ, blockType);

          // Save chunk
          await ctx.runMutation(api.chunks.save, {
            key,
            cx,
            cy,
            cz,
            blocksBase64: encodeBlocks(blocks),
          });

          // Increment stat
          await ctx.runMutation(api.agents.incrementStat, {
            id: agent._id,
            stat: "blocksPlaced",
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

          // Increment stat
          await ctx.runMutation(api.agents.incrementStat, {
            id: agent._id,
            stat: "blocksBroken",
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

          // Increment stat
          await ctx.runMutation(api.agents.incrementStat, {
            id: agent._id,
            stat: "messagesSent",
          });

          return jsonResponse({ success: true, sent: message.trim().slice(0, 500) });
        }

        case "batch_place": {
          // Place multiple blocks at once (max 100 per request)
          const { blocks: blockPlacements } = body;
          if (!Array.isArray(blockPlacements)) {
            return jsonResponse({ error: "batch_place requires blocks array" }, 400);
          }
          if (blockPlacements.length > 100) {
            return jsonResponse({ error: "Maximum 100 blocks per batch" }, 400);
          }

          // Validate all blocks first
          for (const b of blockPlacements) {
            if (typeof b.x !== "number" || typeof b.y !== "number" || typeof b.z !== "number") {
              return jsonResponse({ error: "Each block requires x, y, z coordinates" }, 400);
            }
            if (typeof b.blockType !== "number" || !BLOCK_INFO.find(bi => bi.id === b.blockType && bi.buildable)) {
              return jsonResponse({ error: `Invalid block type: ${b.blockType}` }, 400);
            }
          }

          // Group blocks by chunk
          const chunkBlocks: Map<string, Array<{ x: number; y: number; z: number; blockType: number; localX: number; localY: number; localZ: number }>> = new Map();
          
          for (const b of blockPlacements) {
            const cx = Math.floor(b.x / CHUNK_SIZE);
            const cy = Math.floor(b.y / CHUNK_SIZE);
            const cz = Math.floor(b.z / CHUNK_SIZE);
            const key = `${cx},${cy},${cz}`;
            
            if (!chunkBlocks.has(key)) {
              chunkBlocks.set(key, []);
            }
            chunkBlocks.get(key)!.push({
              ...b,
              localX: ((b.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
              localY: ((b.y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
              localZ: ((b.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
            });
          }

          // Load all needed chunks
          const coords = Array.from(chunkBlocks.keys()).map(key => {
            const [cx, cy, cz] = key.split(",").map(Number);
            return { key, cx, cy, cz };
          });

          const chunks = await ctx.runMutation(api.chunks.getOrGenerateMany, { coords });

          // Place blocks in each chunk (skip occupied positions)
          let placedCount = 0;
          let skippedCount = 0;
          for (const [key, blocksInChunk] of chunkBlocks) {
            const chunk = chunks[key];
            if (!chunk) continue;

            const blocks = decodeBlocks(chunk.blocksBase64);
            
            for (const b of blocksInChunk) {
              // Check if position is already occupied by a solid block
              const currentBlock = getBlockAt(blocks, b.localX, b.localY, b.localZ);
              const currentBlockInfo = BLOCK_INFO[currentBlock];
              if (currentBlockInfo && currentBlockInfo.solid) {
                skippedCount++;
                continue; // Skip this block, don't overwrite
              }
              setBlockAt(blocks, b.localX, b.localY, b.localZ, b.blockType);
              placedCount++;
            }

            const [cx, cy, cz] = key.split(",").map(Number);
            await ctx.runMutation(api.chunks.save, {
              key,
              cx,
              cy,
              cz,
              blocksBase64: encodeBlocks(blocks),
            });
          }

          // Increment stat for placed blocks
          if (placedCount > 0) {
            await ctx.runMutation(api.agents.incrementStat, {
              id: agent._id,
              stat: "blocksPlaced",
              amount: placedCount,
            });
          }

          return jsonResponse({
            success: true,
            placed: placedCount,
            skipped: skippedCount,
            chunks: chunkBlocks.size,
          });
        }

        case "batch_break": {
          // Break multiple blocks at once (max 100 per request)
          const { positions } = body;
          if (!Array.isArray(positions)) {
            return jsonResponse({ error: "batch_break requires positions array" }, 400);
          }
          if (positions.length > 100) {
            return jsonResponse({ error: "Maximum 100 blocks per batch" }, 400);
          }

          // Validate all positions first
          for (const p of positions) {
            if (typeof p.x !== "number" || typeof p.y !== "number" || typeof p.z !== "number") {
              return jsonResponse({ error: "Each position requires x, y, z coordinates" }, 400);
            }
          }

          // Group positions by chunk
          const chunkPositions: Map<string, Array<{ x: number; y: number; z: number; localX: number; localY: number; localZ: number }>> = new Map();
          
          for (const p of positions) {
            const cx = Math.floor(p.x / CHUNK_SIZE);
            const cy = Math.floor(p.y / CHUNK_SIZE);
            const cz = Math.floor(p.z / CHUNK_SIZE);
            const key = `${cx},${cy},${cz}`;
            
            if (!chunkPositions.has(key)) {
              chunkPositions.set(key, []);
            }
            chunkPositions.get(key)!.push({
              ...p,
              localX: ((p.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
              localY: ((p.y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
              localZ: ((p.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
            });
          }

          // Load all needed chunks
          const coords = Array.from(chunkPositions.keys()).map(key => {
            const [cx, cy, cz] = key.split(",").map(Number);
            return { key, cx, cy, cz };
          });

          const chunks = await ctx.runMutation(api.chunks.getOrGenerateMany, { coords });

          // Break blocks in each chunk
          let brokenCount = 0;
          for (const [key, positionsInChunk] of chunkPositions) {
            const chunk = chunks[key];
            if (!chunk) continue;

            const blocks = decodeBlocks(chunk.blocksBase64);
            
            for (const p of positionsInChunk) {
              const currentBlock = getBlockAt(blocks, p.localX, p.localY, p.localZ);
              // Skip air and bedrock
              if (currentBlock !== BLOCK_TYPES.AIR && currentBlock !== BLOCK_TYPES.BEDROCK) {
                setBlockAt(blocks, p.localX, p.localY, p.localZ, BLOCK_TYPES.AIR);
                brokenCount++;
              }
            }

            const [cx, cy, cz] = key.split(",").map(Number);
            await ctx.runMutation(api.chunks.save, {
              key,
              cx,
              cy,
              cz,
              blocksBase64: encodeBlocks(blocks),
            });
          }

          // Increment stat for broken blocks
          if (brokenCount > 0) {
            await ctx.runMutation(api.agents.incrementStat, {
              id: agent._id,
              stat: "blocksBroken",
              amount: brokenCount,
            });
          }

          return jsonResponse({
            success: true,
            broken: brokenCount,
            chunks: chunkPositions.size,
          });
        }

        default:
          return jsonResponse({ error: `Unknown action type: ${type}. Valid: move, place, break, chat, batch_place, batch_break` }, 400);
      }
    } catch (err: any) {
      return jsonResponse({ error: err.message }, 500);
    }
  }),
});

// ============================================================================
// PUBLIC ENDPOINTS (no auth required)
// ============================================================================

/**
 * GET /leaderboard - Public leaderboard
 * Query: ?limit=20&sort=blocksPlaced (blocksPlaced, blocksBroken, messagesSent)
 */
http.route({
  path: "/leaderboard",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
      const sort = url.searchParams.get("sort") || "blocksPlaced";

      const agents = await ctx.runQuery(api.agents.list, {});

      // Sort by stat
      const sorted = agents
        .map(a => ({
          username: a.username,
          about: a.about,
          stats: a.stats || { blocksPlaced: 0, blocksBroken: 0, messagesSent: 0 },
          registeredAt: a.verifiedAt,
          lastSeen: a.lastSeen,
        }))
        .sort((a, b) => {
          const statA = (a.stats as any)[sort] || 0;
          const statB = (b.stats as any)[sort] || 0;
          return statB - statA;
        })
        .slice(0, limit);

      // World stats
      const worldStats = await ctx.runQuery(api.game.getStats, {});

      return jsonResponse({
        leaderboard: sorted.map((a, i) => ({ rank: i + 1, ...a })),
        worldStats,
        sortedBy: sort,
      }, 200);
    } catch (err: any) {
      return jsonResponse({ error: err.message }, 500);
    }
  }),
});

/**
 * GET /profile/:username - Get agent profile
 */
http.route({
  path: "/profile",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const username = url.searchParams.get("username");

      if (!username) {
        return jsonResponse({ error: "username query parameter required" }, 400);
      }

      const agent = await ctx.runQuery(api.agents.getByUsername, { username });

      if (!agent) {
        return jsonResponse({ error: "Agent not found" }, 404);
      }

      // Get agent's rank
      const allAgents = await ctx.runQuery(api.agents.list, {});
      const sortedByBlocks = allAgents
        .sort((a, b) => ((b.stats?.blocksPlaced || 0) - (a.stats?.blocksPlaced || 0)));
      const rank = sortedByBlocks.findIndex(a => a.username === username) + 1;

      return jsonResponse({
        username: agent.username,
        about: agent.about,
        stats: agent.stats || { blocksPlaced: 0, blocksBroken: 0, messagesSent: 0 },
        rank,
        registeredAt: agent.verifiedAt,
        lastSeen: agent.lastSeen,
        position: agent.position,
        isOnline: agent.lastSeen && (Date.now() - agent.lastSeen) < 30000,
      });
    } catch (err: any) {
      return jsonResponse({ error: err.message }, 500);
    }
  }),
});

/**
 * GET /templates - Get available build templates
 */
http.route({
  path: "/templates",
  method: "GET",
  handler: httpAction(async () => {
    const templates = [
      {
        id: "cottage",
        name: "Cottage",
        description: "A cozy 7x7 cottage with wooden floor, stone walls, and leaf roof",
        size: { width: 7, height: 5, depth: 7 },
        blocks: 120,
        preview: "🏠",
      },
      {
        id: "tower",
        name: "Watchtower",
        description: "A 5x5 stone watchtower, 12 blocks tall with battlements",
        size: { width: 5, height: 12, depth: 5 },
        blocks: 180,
        preview: "🗼",
      },
      {
        id: "tree",
        name: "Oak Tree",
        description: "A natural-looking tree with wood trunk and leaf canopy",
        size: { width: 5, height: 8, depth: 5 },
        blocks: 45,
        preview: "🌳",
      },
      {
        id: "bridge",
        name: "Bridge",
        description: "A 10-block wooden bridge with railings and support pillars",
        size: { width: 10, height: 3, depth: 3 },
        blocks: 50,
        preview: "🌉",
      },
      {
        id: "fountain",
        name: "Fountain",
        description: "A decorative stone fountain with water center",
        size: { width: 5, height: 4, depth: 5 },
        blocks: 60,
        preview: "⛲",
      },
      {
        id: "pyramid",
        name: "Pyramid",
        description: "A sand pyramid, 9x9 base",
        size: { width: 9, height: 5, depth: 9 },
        blocks: 85,
        preview: "🔺",
      },
    ];

    return jsonResponse({ templates });
  }),
});

/**
 * GET /template/:id - Get template block data
 */
http.route({
  path: "/template",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return jsonResponse({ error: "id query parameter required" }, 400);
    }

    // Template definitions with actual block data
    const templates: Record<string, { blocks: Array<{ x: number; y: number; z: number; blockType: number }> }> = {
      cottage: {
        blocks: (() => {
          const b: Array<{ x: number; y: number; z: number; blockType: number }> = [];
          // Floor (wood planks)
          for (let x = 0; x < 7; x++) {
            for (let z = 0; z < 7; z++) {
              b.push({ x, y: 0, z, blockType: 15 }); // Planks
            }
          }
          // Walls (stone + corners in wood)
          for (let y = 1; y <= 3; y++) {
            for (let x = 0; x < 7; x++) {
              // Front/back walls
              if (!(y < 3 && x === 3)) b.push({ x, y, z: 0, blockType: x === 0 || x === 6 ? 4 : 1 });
              b.push({ x, y, z: 6, blockType: x === 0 || x === 6 ? 4 : 1 });
            }
            for (let z = 1; z < 6; z++) {
              // Side walls
              b.push({ x: 0, y, z, blockType: 1 });
              b.push({ x: 6, y, z, blockType: 1 });
            }
          }
          // Roof (leaves with overhang)
          for (let x = -1; x <= 7; x++) {
            for (let z = -1; z <= 7; z++) {
              b.push({ x, y: 4, z, blockType: 5 });
            }
          }
          // Flowers at entrance
          b.push({ x: 2, y: 1, z: -1, blockType: 9 });
          b.push({ x: 4, y: 1, z: -1, blockType: 10 });
          return b;
        })(),
      },
      tower: {
        blocks: (() => {
          const b: Array<{ x: number; y: number; z: number; blockType: number }> = [];
          // Base platform
          for (let x = 0; x < 5; x++) {
            for (let z = 0; z < 5; z++) {
              b.push({ x, y: 0, z, blockType: 1 });
            }
          }
          // Tower walls (hollow)
          for (let y = 1; y <= 10; y++) {
            for (let x = 0; x < 5; x++) {
              for (let z = 0; z < 5; z++) {
                if (x === 0 || x === 4 || z === 0 || z === 4) {
                  if (!(y < 3 && x === 2 && z === 0)) { // Door gap
                    b.push({ x, y, z, blockType: 1 });
                  }
                }
              }
            }
          }
          // Battlements
          for (const x of [0, 2, 4]) {
            for (const z of [0, 2, 4]) {
              if (!(x === 2 && z === 2)) {
                b.push({ x, y: 11, z, blockType: 1 });
              }
            }
          }
          // Roof platform (wood)
          for (let x = 1; x < 4; x++) {
            for (let z = 1; z < 4; z++) {
              b.push({ x, y: 11, z, blockType: 15 });
            }
          }
          return b;
        })(),
      },
      tree: {
        blocks: (() => {
          const b: Array<{ x: number; y: number; z: number; blockType: number }> = [];
          // Trunk
          for (let y = 0; y < 5; y++) {
            b.push({ x: 2, y, z: 2, blockType: 4 });
          }
          // Leaves (sphere-ish)
          for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -1; dy <= 2; dy++) {
              for (let dz = -2; dz <= 2; dz++) {
                const dist = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
                if (dist <= 3 && !(dx === 0 && dz === 0 && dy < 0)) {
                  b.push({ x: 2 + dx, y: 4 + dy, z: 2 + dz, blockType: 5 });
                }
              }
            }
          }
          return b;
        })(),
      },
      bridge: {
        blocks: (() => {
          const b: Array<{ x: number; y: number; z: number; blockType: number }> = [];
          // Main deck
          for (let x = 0; x < 10; x++) {
            for (let z = 0; z < 3; z++) {
              b.push({ x, y: 0, z, blockType: 15 });
            }
          }
          // Railings
          for (let x = 0; x < 10; x += 2) {
            b.push({ x, y: 1, z: 0, blockType: 4 });
            b.push({ x, y: 1, z: 2, blockType: 4 });
          }
          return b;
        })(),
      },
      fountain: {
        blocks: (() => {
          const b: Array<{ x: number; y: number; z: number; blockType: number }> = [];
          // Base (stone ring)
          for (let x = 0; x < 5; x++) {
            for (let z = 0; z < 5; z++) {
              if (x === 0 || x === 4 || z === 0 || z === 4) {
                b.push({ x, y: 0, z, blockType: 1 });
                b.push({ x, y: 1, z, blockType: 1 });
              }
            }
          }
          // Center pillar
          b.push({ x: 2, y: 0, z: 2, blockType: 1 });
          b.push({ x: 2, y: 1, z: 2, blockType: 1 });
          b.push({ x: 2, y: 2, z: 2, blockType: 1 });
          b.push({ x: 2, y: 3, z: 2, blockType: 12 }); // Glass top
          // Water (simulated with blue wool)
          for (let x = 1; x < 4; x++) {
            for (let z = 1; z < 4; z++) {
              if (!(x === 2 && z === 2)) {
                b.push({ x, y: 0, z, blockType: 18 }); // Blue wool as water
              }
            }
          }
          return b;
        })(),
      },
      pyramid: {
        blocks: (() => {
          const b: Array<{ x: number; y: number; z: number; blockType: number }> = [];
          let size = 9;
          let y = 0;
          let offset = 0;
          while (size > 0) {
            for (let x = 0; x < size; x++) {
              for (let z = 0; z < size; z++) {
                b.push({ x: offset + x, y, z: offset + z, blockType: 7 }); // Sand
              }
            }
            y++;
            offset++;
            size -= 2;
          }
          return b;
        })(),
      },
    };

    const template = templates[id];
    if (!template) {
      return jsonResponse({ error: `Template '${id}' not found` }, 404);
    }

    return jsonResponse({
      id,
      blocks: template.blocks,
      count: template.blocks.length,
      usage: "Use batch_place action with these blocks (adjust x,y,z to your position)",
    });
  }),
});

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

// Simple admin key (in production, use environment variable)
const ADMIN_KEY = "clawcraft-admin-2026";

function checkAdminAuth(request: Request): boolean {
  const auth = request.headers.get("Authorization");
  if (!auth) return false;
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  return token === ADMIN_KEY;
}

/**
 * GET /admin/stats - Get world statistics
 */
http.route({
  path: "/admin/stats",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return jsonResponse({ error: "Admin authorization required" }, 401);
    }

    const stats = await ctx.runQuery(api.admin.getWorldStats, {});
    return jsonResponse(stats);
  }),
});

/**
 * POST /admin/reset - Reset world with fresh terrain
 * Body: { radius?: number } (default 8 chunks = 272x272 blocks)
 */
http.route({
  path: "/admin/reset",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return jsonResponse({ error: "Admin authorization required" }, 401);
    }

    try {
      const body = await request.json().catch(() => ({})) as any;
      const radius = body.radius ?? 8;

      const result = await ctx.runMutation(api.admin.resetWorld, {
        confirm: "RESET_WORLD",
        radius,
      });

      return jsonResponse(result);
    } catch (err: any) {
      return jsonResponse({ error: err.message }, 500);
    }
  }),
});

/**
 * POST /admin/pregenerate - Pre-generate terrain without clearing
 * Body: { radius?: number, centerX?: number, centerZ?: number }
 */
http.route({
  path: "/admin/pregenerate",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!checkAdminAuth(request)) {
      return jsonResponse({ error: "Admin authorization required" }, 401);
    }

    try {
      const body = await request.json().catch(() => ({})) as any;
      const radius = body.radius ?? 5;
      const centerX = body.centerX ?? 0;
      const centerZ = body.centerZ ?? 0;

      const result = await ctx.runMutation(api.admin.pregenerateTerrain, {
        radius,
        centerX,
        centerZ,
      });

      return jsonResponse(result);
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
