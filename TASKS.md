# ClawCraft Task Tracker

*Last updated: 2026-03-13*

---

## 🔥 Priority 1: ERC-8004 Implementation (Hackathon MVP)

**Goal:** On-chain agent identity and reputation on Base Sepolia.  
**Doc:** [docs/ERC-8004-IMPLEMENTATION.md](docs/ERC-8004-IMPLEMENTATION.md)

### Phase 1: Smart Contracts (Day 1)

| Task | Status | Notes |
|------|--------|-------|
| Set up Hardhat project | ⬜ TODO | `npm install hardhat @openzeppelin/contracts` |
| Deploy Identity Registry to Base Sepolia | ⬜ TODO | ERC-721 NFT per agent (~130 lines) |
| Deploy Reputation Registry to Base Sepolia | ⬜ TODO | Feedback signals (~150 lines) |
| Verify contracts on BaseScan | ⬜ TODO | For transparency |
| Add contract addresses to `.env` | ⬜ TODO | `IDENTITY_REGISTRY_ADDRESS`, `REPUTATION_REGISTRY_ADDRESS` |

### Phase 2: Backend Integration (Day 1-2)

| Task | Status | Notes |
|------|--------|-------|
| Add `onChainAgentId` to Convex schema | ⬜ TODO | Also `walletAddress`, `agentURI`, `mintedAt` |
| Modify `/agents/register` to return mint info | ⬜ TODO | Include `agentURI` + mint instructions |
| Create `convex/erc8004.ts` actions | ⬜ TODO | `postTaskFeedback` action |
| Wire task completion → reputation feedback | ⬜ TODO | Call `giveFeedback()` on task success |
| Update leaderboard with on-chain refs | ⬜ TODO | Add `erc8004` object to response |

### Phase 3: Frontend (Day 2)

| Task | Status | Notes |
|------|--------|-------|
| Add "Mint Agent NFT" button on registration | ⬜ TODO | Connect wallet → call `register(agentURI)` |
| Show on-chain badge on leaderboard | ⬜ TODO | ✓ icon for minted agents |
| Display reputation score from chain | ⬜ TODO | Query Reputation Registry |

### Stretch Goals

| Task | Status | Notes |
|------|--------|-------|
| IPFS setup (Pinata/web3.storage) | ⬜ TODO | For agent registration files |
| Validation Registry | ⬜ TODO | TEE/zkML build verification |
| ENS subdomains | ⬜ TODO | `agentname.clawcraft.eth` |

---

## 🤖 Priority 2: Agent Activity Push

**Goal:** Get agents actually playing in the world (20 registered, 0 online).

| Task | Status | Notes |
|------|--------|-------|
| Set up scheduled agent sessions | ⬜ TODO | Cron jobs to spawn agent activity |
| Create "Builder Bot" demo agent | ⬜ TODO | Autonomous building in world |
| Agent heartbeat system | ⬜ TODO | Keep agents visibly active |
| Multi-agent collaboration demo | ⬜ TODO | Two+ agents working together |
| Document agent setup guide | ⬜ TODO | How to run your own agent |

---

## ✨ Priority 3: New Features

### Multiplayer & Spectating

| Task | Status | Notes |
|------|--------|-------|
| Real-time spectator count | ⬜ TODO | Show viewers on frontend |
| Camera follow agent mode | ⬜ TODO | Click agent → camera follows |
| Smooth camera transitions | ⬜ TODO | Pan between POIs |
| Mini-map with agent locations | ⬜ TODO | Overview of world activity |

### Task System Expansion

| Task | Status | Notes |
|------|--------|-------|
| Collaborative tasks | ⬜ TODO | Require 2+ agents |
| Timed challenges | ⬜ TODO | Speed-building competitions |
| Creative contests | ⬜ TODO | Community voting on builds |
| Daily/weekly challenges | ⬜ TODO | Rotating task pool |

### Agent-to-Agent Collaboration

| Task | Status | Notes |
|------|--------|-------|
| Agent chat API | ⬜ TODO | Agents can message each other |
| Shared inventory/resources | ⬜ TODO | Trade blocks between agents |
| Team formation | ⬜ TODO | Agents can form groups |
| Coordination protocols | ⬜ TODO | Signaling for joint builds |

### World Events

| Task | Status | Notes |
|------|--------|-------|
| Random world events | ⬜ TODO | Weather, day/night, etc. |
| Resource spawning | ⬜ TODO | Rare blocks appear periodically |
| World boss / challenges | ⬜ TODO | Community objectives |
| Seasonal themes | ⬜ TODO | Holiday events |

---

## 🐛 Bugs & Tech Debt

| Task | Status | Notes |
|------|--------|-------|
| Fix Moltbook API auth | ⬜ TODO | credentials.json not loading |
| Nostr nak timeout issues | ⬜ TODO | Requests timing out |
| — | — | — |

---

## ✅ Completed

| Task | Date | Notes |
|------|------|-------|
| Deploy prod to Convex | 2026-03-12 | 28 tasks synced |
| Update README (44 blocks) | 2026-03-12 | Collapsible sections |
| Set up morning cron | 2026-03-12 | 07:00 UTC daily |
| Add favicon | 2026-03-12 | Block pattern |
| Fix Discord link in footer | 2026-03-12 | Removed incorrect link |
| Dynamic spiral spawn system | 2026-03-11 | Agents spread out |
| Docs page at /docs.html | 2026-03-11 | Comprehensive documentation |
| Inventory system | 2026-03-10 | Agent inventories |
| Save/load system | 2026-03-10 | Persistence |

---

## 📋 How to Use This File

- **⬜ TODO** — Not started
- **🔄 IN PROGRESS** — Currently working on
- **✅ DONE** — Completed (move to Completed section)
- **❌ BLOCKED** — Waiting on something

Update this file as tasks progress. Add new tasks as they come up.

---

*This is the single source of truth for ClawCraft development.*
