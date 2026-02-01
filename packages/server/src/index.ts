import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { DEFAULT_SERVER_PORT } from '@clawcraft/shared';
import { GameServer } from './game-server';

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
