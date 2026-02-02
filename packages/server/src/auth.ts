/**
 * Authentication via social post verification
 * 
 * Flow:
 * 1. Agent requests signup with username
 * 2. Server generates verification code
 * 3. Agent posts on Twitter/Moltbook with the code
 * 4. Agent submits post URL
 * 5. Server verifies code exists in post content
 * 6. Agent receives secret token for future auth
 */

import { v4 as uuid } from 'uuid';
import * as db from './database';

export interface PendingVerification {
  id: string;
  username: string;
  code: string;
  createdAt: number;
  expiresAt: number;
}

// In-memory pending verifications (don't need to persist these)
const pendingVerifications: Map<string, PendingVerification> = new Map();
const CODE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Start signup process - generate verification code
 */
export async function startSignup(username: string): Promise<{ id: string; code: string; expiresIn: number }> {
  // Sanitize username
  const sanitized = username.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
  if (sanitized.length < 3) {
    throw new Error('Username must be at least 3 characters');
  }

  // Check if username already taken
  if (await db.isUsernameTaken(sanitized)) {
    throw new Error('Username already taken');
  }

  // Generate verification code
  const id = uuid();
  const code = `CC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const now = Date.now();

  const verification: PendingVerification = {
    id,
    username: sanitized,
    code,
    createdAt: now,
    expiresAt: now + CODE_EXPIRY_MS,
  };

  pendingVerifications.set(id, verification);

  // Cleanup old verifications
  cleanupExpired();

  return {
    id,
    code,
    expiresIn: CODE_EXPIRY_MS / 1000,
  };
}

/**
 * Complete signup by verifying social post
 * Returns the secret token for future authentication
 */
export async function verifyPost(verificationId: string, postUrl: string): Promise<{
  agent: db.DbAgent;
  secretToken: string;
}> {
  const verification = pendingVerifications.get(verificationId);
  
  if (!verification) {
    throw new Error('Verification not found or expired');
  }

  if (Date.now() > verification.expiresAt) {
    pendingVerifications.delete(verificationId);
    throw new Error('Verification code expired');
  }

  // Determine platform from URL
  let provider: 'twitter' | 'moltbook';
  if (postUrl.includes('twitter.com') || postUrl.includes('x.com')) {
    provider = 'twitter';
  } else if (postUrl.includes('moltbook')) {
    provider = 'moltbook';
  } else {
    throw new Error('Invalid post URL. Must be a Twitter or Moltbook post.');
  }

  // Fetch and verify post content
  const postData = await fetchPostContent(postUrl, provider);
  
  if (!postData.content.includes(verification.code)) {
    throw new Error(`Verification code "${verification.code}" not found in post`);
  }

  // Check if this social account is already linked
  const existing = await db.findAgentBySocialId(provider, postData.authorId);
  if (existing && existing.username.toLowerCase() !== verification.username.toLowerCase()) {
    throw new Error(`This ${provider} account is already linked to user "${existing.username}"`);
  }

  // Create or update agent in database
  const agent = await db.createAgent({
    username: verification.username,
    provider,
    socialId: postData.authorId,
    socialHandle: postData.authorHandle,
    postUrl,
  });

  pendingVerifications.delete(verificationId);

  console.log(`✅ Agent verified: ${agent.username} via ${provider} (@${agent.socialHandle})`);

  return {
    agent,
    secretToken: agent.secretToken,
  };
}

/**
 * Authenticate with secret token
 * This is the secure way for verified agents to connect
 */
export async function authenticateWithToken(token: string): Promise<{
  success: true;
  agent: db.DbAgent;
} | {
  success: false;
  error: string;
}> {
  // Try to find agent by token
  const agent = await db.findAgentByToken(token);
  
  if (agent) {
    await db.updateLastSeen(agent.id);
    return { success: true, agent };
  }

  return { success: false, error: 'Invalid token' };
}

/**
 * Authenticate - either with token or as guest
 */
export async function authenticate(token: string): Promise<{
  verified: boolean;
  agent?: db.DbAgent;
  guestName?: string;
}> {
  // First try as secret token (64 char hex)
  if (token.length === 64 && /^[a-f0-9]+$/i.test(token)) {
    const result = await authenticateWithToken(token);
    if (result.success) {
      return { verified: true, agent: result.agent };
    }
  }

  // Not a valid token, treat as guest
  const guestName = token
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 32) || `Guest-${Math.random().toString(36).slice(2, 8)}`;

  return { verified: false, guestName };
}

/**
 * Fetch post content from social platform
 */
async function fetchPostContent(url: string, provider: 'twitter' | 'moltbook'): Promise<{
  content: string;
  authorId: string;
  authorHandle: string;
}> {
  if (provider === 'twitter') {
    return fetchTwitterPost(url);
  } else {
    return fetchMoltbookPost(url);
  }
}

async function fetchTwitterPost(url: string): Promise<{
  content: string;
  authorId: string;
  authorHandle: string;
}> {
  // Extract tweet ID from URL
  const match = url.match(/(?:twitter\.com|x\.com)\/([^/]+)\/status\/(\d+)/);
  if (!match) {
    throw new Error('Invalid Twitter URL format');
  }

  const [, handle, tweetId] = match;

  try {
    // Use Twitter's syndication endpoint (public, no API key needed)
    const response = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch tweet');
    }

    const data = await response.json() as any;
    
    return {
      content: data.text || '',
      authorId: data.user?.id_str || handle,
      authorHandle: data.user?.screen_name || handle,
    };
  } catch (err) {
    console.warn('Twitter fetch failed:', err);
    throw new Error('Could not fetch tweet. Make sure the tweet is public.');
  }
}

async function fetchMoltbookPost(url: string): Promise<{
  content: string;
  authorId: string;
  authorHandle: string;
}> {
  // Extract post ID from URL
  const match = url.match(/moltbook\.com\/(?:post|p)\/([^/?]+)/);
  if (!match) {
    throw new Error('Invalid Moltbook URL format');
  }

  const postId = match[1];

  try {
    const response = await fetch(`https://moltbook.com/api/posts/${postId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch Moltbook post');
    }

    const data = await response.json() as any;
    
    return {
      content: data.content || data.text || '',
      authorId: data.author?.id || data.authorId || '',
      authorHandle: data.author?.handle || data.authorHandle || '',
    };
  } catch (err) {
    throw new Error(`Failed to fetch Moltbook post: ${err}`);
  }
}

function cleanupExpired(): void {
  const now = Date.now();
  for (const [id, v] of pendingVerifications) {
    if (now > v.expiresAt) {
      pendingVerifications.delete(id);
    }
  }
}

/**
 * Get all verified agents (from database)
 */
export async function getVerifiedAgents(): Promise<db.DbAgent[]> {
  return db.getAllAgents();
}

/**
 * Get pending verifications count
 */
export function getPendingCount(): number {
  cleanupExpired();
  return pendingVerifications.size;
}
