import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { DEFAULT_SERVER_PORT } from '@clawcraft/shared';
import { GameServer } from './game-server';
import { startSignup, verifyPost, getVerifiedAgents, getPendingCount } from './auth';

const PORT = Number(process.env.PORT) || DEFAULT_SERVER_PORT;

// Express app for REST API
const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Create game server
const gameServer = new GameServer();

// REST endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/api/stats', (req, res) => {
  res.json(gameServer.getStats());
});

app.get('/api/agents', (req, res) => {
  res.json(gameServer.getPublicAgentList());
});

app.get('/api/proposals', (req, res) => {
  res.json(gameServer.getProposals());
});

app.post('/api/proposals/:id/vote', (req, res) => {
  const { agentId, vote, reason } = req.body;
  const result = gameServer.vote(req.params.id, agentId, vote, reason);
  res.json(result);
});

// ============================================================================
// AUTH ENDPOINTS
// ============================================================================

/**
 * Start signup - get verification code
 * POST /api/auth/signup { username: "MyAgentName" }
 * Returns: { id, code, expiresIn, instructions }
 */
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }

    const result = await startSignup(username);
    
    res.json({
      ...result,
      instructions: {
        step1: `Post on Twitter or Moltbook with this exact code: ${result.code}`,
        step2: 'Example tweet: "Joining ClawCraft! 🧱 Verify: ' + result.code + ' #ClawCraft"',
        step3: 'Copy your post URL and call POST /api/auth/verify',
        important: 'Save your secret token after verification - you need it to connect!',
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Complete verification with post URL
 * POST /api/auth/verify { id, postUrl: "https://twitter.com/..." }
 * Returns: { agent, secretToken }
 */
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { id, postUrl } = req.body;
    if (!id || !postUrl) {
      return res.status(400).json({ error: 'id and postUrl required' });
    }

    const result = await verifyPost(id, postUrl);
    
    res.json({
      success: true,
      agent: {
        id: result.agent.id,
        username: result.agent.username,
        provider: result.agent.provider,
        socialHandle: result.agent.socialHandle,
      },
      secretToken: result.secretToken,
      message: `Welcome to ClawCraft, ${result.agent.username}! Save your secret token - you need it to connect.`,
      howToConnect: 'Connect to WebSocket with: { type: "auth", token: "YOUR_SECRET_TOKEN" }',
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Get verified agents list (public)
 */
app.get('/api/auth/verified', async (req, res) => {
  const agents = await getVerifiedAgents();
  res.json({ 
    agents: agents.map(a => ({
      username: a.username,
      provider: a.provider,
      socialHandle: a.socialHandle,
      verifiedAt: a.verifiedAt,
    })), 
    count: agents.length 
  });
});

/**
 * Auth stats
 */
app.get('/api/auth/stats', async (req, res) => {
  const agents = await getVerifiedAgents();
  res.json({
    verifiedAgents: agents.length,
    pendingVerifications: getPendingCount(),
  });
});

// WebSocket handling
wss.on('connection', (ws) => {
  gameServer.handleConnection(ws);
});

// Start game loop
gameServer.start();

// Start server
server.listen(PORT, () => {
  console.log(`🧱 ClawCraft server running on port ${PORT}`);
  console.log(`   REST API: http://localhost:${PORT}/api`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  gameServer.stop();
  server.close();
  process.exit(0);
});
