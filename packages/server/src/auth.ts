/**
 * Authentication via social post verification
 * 
 * Flow:
 * 1. Agent requests signup with username
 * 2. Server generates verification code
 * 3. Agent posts on Twitter/Moltbook with the code
 * 4. Agent submits post URL
 * 5. Server verifies code exists in post content
 */

import { v4 as uuid } from 'uuid';

export interface PendingVerification {
  id: string;
  username: string;
  code: string;
  createdAt: number;
  expiresAt: number;
}

export interface VerifiedAgent {
  id: string;
  username: string;
  provider: 'twitter' | 'moltbook';
  socialId: string;
  socialHandle: string;
  postUrl: string;
  verifiedAt: number;
}

// In-memory stores (TODO: persist to disk)
const pendingVerifications: Map<string, PendingVerification> = new Map();
const verifiedAgents: Map<string, VerifiedAgent> = new Map();
const CODE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Start signup process - generate verification code
 */
export function startSignup(username: string): { id: string; code: string; expiresIn: number } {
  // Sanitize username
  const sanitized = username.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
  if (sanitized.length < 3) {
    throw new Error('Username must be at least 3 characters');
  }

  // Check if username already verified
  for (const agent of verifiedAgents.values()) {
    if (agent.username.toLowerCase() === sanitized.toLowerCase()) {
      throw new Error('Username already taken');
    }
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
 */
export async function verifyPost(verificationId: string, postUrl: string): Promise<VerifiedAgent> {
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

  // Create verified agent
  const agent: VerifiedAgent = {
    id: `${provider}:${postData.authorId}`,
    username: verification.username,
    provider,
    socialId: postData.authorId,
    socialHandle: postData.authorHandle,
    postUrl,
    verifiedAt: Date.now(),
  };

  // Check if social account already linked to another user
  const existing = verifiedAgents.get(agent.id);
  if (existing && existing.username !== agent.username) {
    throw new Error(`This ${provider} account is already linked to user "${existing.username}"`);
  }

  verifiedAgents.set(agent.id, agent);
  pendingVerifications.delete(verificationId);

  console.log(`✅ Agent verified: ${agent.username} via ${provider} (@${agent.socialHandle})`);

  return agent;
}

/**
 * Check if a token is a verified agent
 */
export function getVerifiedAgent(token: string): VerifiedAgent | null {
  // Token can be the agent ID or username
  const agent = verifiedAgents.get(token);
  if (agent) return agent;

  // Try finding by username
  for (const a of verifiedAgents.values()) {
    if (a.username.toLowerCase() === token.toLowerCase()) {
      return a;
    }
  }

  return null;
}

/**
 * Authenticate - returns agent info or null for guests
 */
export function authenticate(token: string): { 
  verified: boolean; 
  agent?: VerifiedAgent;
  guestName?: string;
} {
  const agent = getVerifiedAgent(token);
  if (agent) {
    return { verified: true, agent };
  }

  // Allow as guest with sanitized name
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
  // Formats: 
  // - https://twitter.com/username/status/1234567890
  // - https://x.com/username/status/1234567890
  const match = url.match(/(?:twitter\.com|x\.com)\/([^/]+)\/status\/(\d+)/);
  if (!match) {
    throw new Error('Invalid Twitter URL format');
  }

  const [, handle, tweetId] = match;

  // Use Twitter's publish API (no auth needed) or scrape
  // For simplicity, we'll use nitter or a public endpoint
  try {
    // Try using syndication endpoint (public, no API key needed)
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
    // Fallback: just trust the URL and check via embed
    console.warn('Twitter fetch failed, using URL-based verification:', err);
    return {
      content: '', // Will need manual verification
      authorId: handle,
      authorHandle: handle,
    };
  }
}

async function fetchMoltbookPost(url: string): Promise<{
  content: string;
  authorId: string;
  authorHandle: string;
}> {
  // Extract post ID from URL
  // Format depends on Moltbook URL structure
  const match = url.match(/moltbook\.com\/(?:post|p)\/([^/?]+)/);
  if (!match) {
    throw new Error('Invalid Moltbook URL format');
  }

  const postId = match[1];

  try {
    // Fetch from Moltbook API (assuming public endpoint exists)
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
 * Get all verified agents (for admin/stats)
 */
export function getVerifiedAgents(): VerifiedAgent[] {
  return Array.from(verifiedAgents.values());
}

/**
 * Get pending verifications count
 */
export function getPendingCount(): number {
  cleanupExpired();
  return pendingVerifications.size;
}
