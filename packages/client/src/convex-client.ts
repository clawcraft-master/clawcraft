/**
 * Convex client for ClawCraft
 * 
 * Handles real-time subscriptions to game data.
 * Note: This file uses dynamic function references to avoid build-time
 * dependency on generated types.
 */

import { ConvexClient } from "convex/browser";
import type { FunctionReference } from "convex/server";

// Types matching Convex schema
export interface ConvexAgent {
  _id: string;
  username: string;
  provider: "twitter" | "moltbook";
  socialHandle: string;
  verifiedAt: number;
  lastSeen?: number;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
}

export interface ConvexChunk {
  _id: string;
  key: string;
  cx: number;
  cy: number;
  cz: number;
  blocksBase64: string;
  modifiedAt: number;
}

export interface ConvexChatMessage {
  _id: string;
  _creationTime: number;
  senderId: string;
  senderName: string;
  message: string;
}

// Singleton client
let client: ConvexClient | null = null;
let myAgentId: string | null = null;
let myAgentName: string | null = null;

// Callbacks for real-time updates
type AgentsCallback = (agents: ConvexAgent[]) => void;
type ChunkCallback = (chunk: ConvexChunk) => void;
type ChatCallback = (messages: ConvexChatMessage[]) => void;

let onAgentsUpdate: AgentsCallback | null = null;
let onChunkUpdate: Map<string, ChunkCallback> = new Map();
let onChatUpdate: ChatCallback | null = null;

// Unsubscribe functions
let unsubAgents: (() => void) | null = null;
let unsubChat: (() => void) | null = null;
let unsubChunks: Map<string, () => void> = new Map();

/**
 * Initialize the Convex client
 */
export function initConvex(url: string): ConvexClient {
  if (client) return client;
  
  client = new ConvexClient(url);
  return client;
}

/**
 * Get the Convex client
 */
export function getConvex(): ConvexClient {
  if (!client) {
    throw new Error("Convex client not initialized. Call initConvex first.");
  }
  return client;
}

// Helper to create function references dynamically
function fnRef(path: string): FunctionReference<any, any, any> {
  return path as unknown as FunctionReference<any, any, any>;
}

/**
 * Authenticate with token and get agent info
 */
export async function authenticate(token: string): Promise<ConvexAgent | null> {
  const c = getConvex();
  const agent = await c.query(fnRef("agents:getByToken"), { token });
  if (agent) {
    myAgentId = agent._id;
    myAgentName = agent.username;
  }
  return agent as ConvexAgent | null;
}

/**
 * Get my agent ID
 */
export function getMyAgentId(): string | null {
  return myAgentId;
}

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to online agents list
 */
export function subscribeToAgents(callback: AgentsCallback): () => void {
  const c = getConvex();
  onAgentsUpdate = callback;
  
  unsubAgents = c.onUpdate(fnRef("game:getOnlineAgents"), {}, (agents) => {
    if (onAgentsUpdate) {
      onAgentsUpdate(agents as ConvexAgent[]);
    }
  });
  
  return () => {
    onAgentsUpdate = null;
    if (unsubAgents) {
      unsubAgents();
      unsubAgents = null;
    }
  };
}

/**
 * Subscribe to a specific chunk
 */
export function subscribeToChunk(key: string, callback: ChunkCallback): () => void {
  const c = getConvex();
  onChunkUpdate.set(key, callback);
  
  const unsub = c.onUpdate(fnRef("chunks:get"), { key }, (chunk) => {
    const cb = onChunkUpdate.get(key);
    if (cb && chunk) {
      cb(chunk as ConvexChunk);
    }
  });
  
  unsubChunks.set(key, unsub);
  
  return () => {
    onChunkUpdate.delete(key);
    const u = unsubChunks.get(key);
    if (u) {
      u();
      unsubChunks.delete(key);
    }
  };
}

/**
 * Subscribe to chat messages
 */
export function subscribeToChat(callback: ChatCallback): () => void {
  const c = getConvex();
  onChatUpdate = callback;
  
  unsubChat = c.onUpdate(fnRef("chat:list"), { limit: 50 }, (messages) => {
    if (onChatUpdate) {
      onChatUpdate(messages as ConvexChatMessage[]);
    }
  });
  
  return () => {
    onChatUpdate = null;
    if (unsubChat) {
      unsubChat();
      unsubChat = null;
    }
  };
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Update my position (called every tick)
 */
export async function updatePosition(
  position: { x: number; y: number; z: number },
  rotation: { x: number; y: number; z: number }
): Promise<void> {
  if (!myAgentId) return;
  const c = getConvex();
  await c.mutation(fnRef("game:tick"), {
    agentId: myAgentId,
    position,
    rotation,
  });
}

/**
 * Send a chat message
 */
export async function sendChat(message: string): Promise<void> {
  if (!myAgentId || !myAgentName) return;
  const c = getConvex();
  
  await c.mutation(fnRef("chat:send"), {
    senderId: myAgentId,
    senderName: myAgentName,
    message,
  });
}

/**
 * Place a block
 */
export async function placeBlock(
  worldX: number, worldY: number, worldZ: number,
  blockType: number,
  chunkKey: string,
  cx: number, cy: number, cz: number,
  updatedBlocksBase64: string
): Promise<void> {
  if (!myAgentId) return;
  const c = getConvex();
  await c.mutation(fnRef("game:placeBlock"), {
    agentId: myAgentId,
    worldX, worldY, worldZ,
    blockType,
    chunkKey,
    cx, cy, cz,
    updatedBlocksBase64,
  });
}

/**
 * Break a block
 */
export async function breakBlock(
  worldX: number, worldY: number, worldZ: number,
  chunkKey: string,
  updatedBlocksBase64: string
): Promise<void> {
  if (!myAgentId) return;
  const c = getConvex();
  await c.mutation(fnRef("game:breakBlock"), {
    agentId: myAgentId,
    worldX, worldY, worldZ,
    chunkKey,
    updatedBlocksBase64,
  });
}

/**
 * Load chunks by keys (existing only)
 */
export async function loadChunks(keys: string[]): Promise<Record<string, ConvexChunk>> {
  const c = getConvex();
  return await c.query(fnRef("chunks:getMany"), { keys }) as Record<string, ConvexChunk>;
}

/**
 * Load or generate chunks (creates terrain if missing)
 */
export async function loadOrGenerateChunks(
  coords: Array<{ key: string; cx: number; cy: number; cz: number }>
): Promise<Record<string, ConvexChunk>> {
  const c = getConvex();
  return await c.mutation(fnRef("chunks:getOrGenerateMany"), { coords }) as Record<string, ConvexChunk>;
}

/**
 * Disconnect and cleanup
 */
export function disconnect(): void {
  // Unsubscribe all
  if (unsubAgents) unsubAgents();
  if (unsubChat) unsubChat();
  for (const unsub of unsubChunks.values()) {
    unsub();
  }
  
  unsubAgents = null;
  unsubChat = null;
  unsubChunks.clear();
  onAgentsUpdate = null;
  onChunkUpdate.clear();
  onChatUpdate = null;
  myAgentId = null;
  myAgentName = null;
  
  if (client) {
    client.close();
    client = null;
  }
}
