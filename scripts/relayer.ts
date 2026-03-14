/**
 * ERC-8004 Relayer Script
 * 
 * Polls Convex for pending feedback items and submits them to Base Sepolia.
 * Run on VPS with: npx tsx scripts/relayer.ts
 * 
 * Environment variables required:
 * - RELAYER_PRIVATE_KEY: Private key for the relayer wallet
 * - CONVEX_URL: Convex deployment URL (or uses NEXT_PUBLIC_CONVEX_URL)
 */

import { ConvexHttpClient } from "convex/browser";
import { ethers } from "ethers";
import { api } from "../convex/_generated/api";

// Config
const POLL_INTERVAL_MS = 10000; // 10 seconds
const CHAIN_ID = 84532; // Base Sepolia
const RPC_URL = "https://sepolia.base.org";
const REPUTATION_REGISTRY = process.env.REPUTATION_REGISTRY_ADDRESS || "0x92E829A08B1Fe841A544F27Ca858d1fd4F919989";

// Minimal ABI for postFeedback
const REPUTATION_ABI = [
  "function postFeedback(uint256 agentId, string feedbackType, string metadata) external",
];

async function main() {
  // Check env
  const privateKey = process.env.RELAYER_PRIVATE_KEY;
  if (!privateKey) {
    console.error("RELAYER_PRIVATE_KEY not set");
    process.exit(1);
  }

  const convexUrl = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error("CONVEX_URL or NEXT_PUBLIC_CONVEX_URL not set");
    process.exit(1);
  }

  // Set up clients
  const convex = new ConvexHttpClient(convexUrl);
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(REPUTATION_REGISTRY, REPUTATION_ABI, wallet);

  console.log("🔗 ERC-8004 Relayer started");
  console.log(`   Chain: Base Sepolia (${CHAIN_ID})`);
  console.log(`   Relayer: ${wallet.address}`);
  console.log(`   Contract: ${REPUTATION_REGISTRY}`);
  console.log(`   Convex: ${convexUrl}`);
  console.log("");

  // Main loop
  while (true) {
    try {
      // Get pending feedback
      const pending = await convex.query(api.erc8004.getPendingFeedback, { limit: 5 });

      if (pending.length > 0) {
        console.log(`📤 Processing ${pending.length} pending feedback items...`);

        for (const item of pending) {
          try {
            console.log(`   → Agent ${item.onChainAgentId}: ${item.feedbackType}`);

            // Submit to chain
            const tx = await contract.postFeedback(
              item.onChainAgentId,
              item.feedbackType,
              item.metadata
            );

            console.log(`   → Tx sent: ${tx.hash}`);

            // Mark as submitted
            await convex.mutation(api.erc8004.markFeedbackSubmitted, {
              feedbackId: item._id,
              txHash: tx.hash,
            });

            // Wait for confirmation
            const receipt = await tx.wait();
            console.log(`   ✓ Confirmed in block ${receipt.blockNumber}`);

            // Mark as confirmed
            await convex.mutation(api.erc8004.markFeedbackConfirmed, {
              feedbackId: item._id,
            });

          } catch (err: any) {
            console.error(`   ✗ Failed: ${err.message}`);
            
            // Mark as failed
            await convex.mutation(api.erc8004.markFeedbackFailed, {
              feedbackId: item._id,
              error: err.message,
            });
          }
        }
      }

      // Sleep
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    } catch (err: any) {
      console.error("Relayer error:", err.message);
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

main().catch(console.error);
