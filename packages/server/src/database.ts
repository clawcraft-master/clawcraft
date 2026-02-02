/**
 * PostgreSQL database connection and queries
 */

import { Pool } from 'pg';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';

// Database connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'clawcraft',
  user: process.env.DB_USER || 'openclaw',
  password: process.env.DB_PASSWORD || '',
});

// Test connection on startup
pool.query('SELECT NOW()').then(() => {
  console.log('✅ Database connected');
}).catch((err) => {
  console.error('❌ Database connection failed:', err.message);
});

// ============================================================================
// AGENTS
// ============================================================================

export interface DbAgent {
  id: string;
  username: string;
  provider: 'twitter' | 'moltbook';
  socialId: string;
  socialHandle: string;
  postUrl: string;
  secretToken: string;
  verifiedAt: Date;
  lastSeen: Date | null;
}

/**
 * Generate a secure random token
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new verified agent
 */
export async function createAgent(data: {
  username: string;
  provider: 'twitter' | 'moltbook';
  socialId: string;
  socialHandle: string;
  postUrl: string;
}): Promise<DbAgent> {
  const id = `${data.provider}:${data.socialId}`;
  const secretToken = generateToken();

  const result = await pool.query(
    `INSERT INTO agents (id, username, provider, social_id, social_handle, post_url, secret_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET
       username = EXCLUDED.username,
       post_url = EXCLUDED.post_url,
       secret_token = EXCLUDED.secret_token
     RETURNING *`,
    [id, data.username, data.provider, data.socialId, data.socialHandle, data.postUrl, secretToken]
  );

  return rowToAgent(result.rows[0]);
}

/**
 * Find agent by username
 */
export async function findAgentByUsername(username: string): Promise<DbAgent | null> {
  const result = await pool.query(
    'SELECT * FROM agents WHERE LOWER(username) = LOWER($1)',
    [username]
  );
  return result.rows.length > 0 ? rowToAgent(result.rows[0]) : null;
}

/**
 * Find agent by secret token
 */
export async function findAgentByToken(token: string): Promise<DbAgent | null> {
  const result = await pool.query(
    'SELECT * FROM agents WHERE secret_token = $1',
    [token]
  );
  return result.rows.length > 0 ? rowToAgent(result.rows[0]) : null;
}

/**
 * Find agent by social ID
 */
export async function findAgentBySocialId(provider: string, socialId: string): Promise<DbAgent | null> {
  const id = `${provider}:${socialId}`;
  const result = await pool.query(
    'SELECT * FROM agents WHERE id = $1',
    [id]
  );
  return result.rows.length > 0 ? rowToAgent(result.rows[0]) : null;
}

/**
 * Update last seen timestamp
 */
export async function updateLastSeen(agentId: string): Promise<void> {
  await pool.query(
    'UPDATE agents SET last_seen = NOW() WHERE id = $1',
    [agentId]
  );
}

/**
 * Get all agents
 */
export async function getAllAgents(): Promise<DbAgent[]> {
  const result = await pool.query('SELECT * FROM agents ORDER BY verified_at DESC');
  return result.rows.map(rowToAgent);
}

/**
 * Check if username is taken
 */
export async function isUsernameTaken(username: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT 1 FROM agents WHERE LOWER(username) = LOWER($1)',
    [username]
  );
  return result.rows.length > 0;
}

function rowToAgent(row: any): DbAgent {
  return {
    id: row.id,
    username: row.username,
    provider: row.provider,
    socialId: row.social_id,
    socialHandle: row.social_handle,
    postUrl: row.post_url,
    secretToken: row.secret_token,
    verifiedAt: row.verified_at,
    lastSeen: row.last_seen,
  };
}

// ============================================================================
// WORLD CHUNKS
// ============================================================================

export interface DbChunk {
  chunkKey: string;
  cx: number;
  cy: number;
  cz: number;
  blocks: Buffer;
  modifiedAt: Date;
}

/**
 * Save a chunk to the database
 */
export async function saveChunk(key: string, cx: number, cy: number, cz: number, blocks: Uint8Array): Promise<void> {
  await pool.query(
    `INSERT INTO world_chunks (chunk_key, cx, cy, cz, blocks)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (chunk_key) DO UPDATE SET
       blocks = EXCLUDED.blocks,
       modified_at = NOW()`,
    [key, cx, cy, cz, Buffer.from(blocks)]
  );
}

/**
 * Load a chunk from the database
 */
export async function loadChunk(key: string): Promise<DbChunk | null> {
  const result = await pool.query(
    'SELECT * FROM world_chunks WHERE chunk_key = $1',
    [key]
  );
  if (result.rows.length === 0) return null;
  
  const row = result.rows[0];
  return {
    chunkKey: row.chunk_key,
    cx: row.cx,
    cy: row.cy,
    cz: row.cz,
    blocks: row.blocks,
    modifiedAt: row.modified_at,
  };
}

/**
 * Load all saved chunks
 */
export async function loadAllChunks(): Promise<DbChunk[]> {
  const result = await pool.query('SELECT * FROM world_chunks');
  return result.rows.map(row => ({
    chunkKey: row.chunk_key,
    cx: row.cx,
    cy: row.cy,
    cz: row.cz,
    blocks: row.blocks,
    modifiedAt: row.modified_at,
  }));
}

// ============================================================================
// CHAT HISTORY
// ============================================================================

export interface DbChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  createdAt: Date;
}

/**
 * Save a chat message
 */
export async function saveChatMessage(senderId: string, senderName: string, message: string): Promise<DbChatMessage> {
  const id = uuid();
  const result = await pool.query(
    `INSERT INTO chat_history (id, sender_id, sender_name, message)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [id, senderId, senderName, message]
  );
  
  const row = result.rows[0];
  return {
    id: row.id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    message: row.message,
    createdAt: row.created_at,
  };
}

/**
 * Get recent chat messages
 */
export async function getRecentChat(limit: number = 50): Promise<DbChatMessage[]> {
  const result = await pool.query(
    'SELECT * FROM chat_history ORDER BY created_at DESC LIMIT $1',
    [limit]
  );
  return result.rows.map(row => ({
    id: row.id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    message: row.message,
    createdAt: row.created_at,
  })).reverse(); // Oldest first
}

/**
 * Cleanup old chat messages (keep last N)
 */
export async function cleanupOldChat(keepCount: number = 1000): Promise<number> {
  const result = await pool.query(
    `DELETE FROM chat_history WHERE id NOT IN (
      SELECT id FROM chat_history ORDER BY created_at DESC LIMIT $1
    )`,
    [keepCount]
  );
  return result.rowCount || 0;
}
