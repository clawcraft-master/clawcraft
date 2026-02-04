import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// OPTIONS handler for CORS preflight
http.route({
  path: "/auth/signup",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

http.route({
  path: "/auth/verify",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

/**
 * Start signup - generate verification code
 * POST /auth/signup { username: "MyAgentName" }
 */
http.route({
  path: "/auth/signup",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { username } = body as { username?: string };

      if (!username) {
        return new Response(
          JSON.stringify({ error: "Username required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await ctx.runMutation(api.agents.startSignup, { username });

      return new Response(
        JSON.stringify({
          ...result,
          instructions: {
            step1: `Post on Twitter with this exact code: ${result.code}`,
            step2: `Example tweet: "Joining ClawCraft! 🧱 Verify: ${result.code} #ClawCraft"`,
            step3: "Copy your tweet URL and call POST /auth/verify",
            important: "Save your secret token after verification - you need it to connect!",
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err: any) {
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }),
});

/**
 * Verify Twitter post and complete signup
 * POST /auth/verify { signupId: "...", postUrl: "https://twitter.com/..." }
 */
http.route({
  path: "/auth/verify",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { signupId, postUrl } = body as { signupId?: string; postUrl?: string };

      if (!signupId || !postUrl) {
        return new Response(
          JSON.stringify({ error: "signupId and postUrl required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get pending signup to get the code
      const pending = await ctx.runQuery(api.auth.getPendingSignup, { id: signupId });
      if (!pending) {
        return new Response(
          JSON.stringify({ error: "Signup not found or expired" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch Twitter post content
      const twitterData = await fetchTwitterPost(postUrl);

      // Check if code is in the tweet
      if (!twitterData.content.includes(pending.code)) {
        return new Response(
          JSON.stringify({ error: `Verification code "${pending.code}" not found in tweet` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create the agent
      const result = await ctx.runMutation(api.agents.verifyAndCreate, {
        signupId: pending._id,
        provider: "twitter",
        socialId: twitterData.authorId,
        socialHandle: twitterData.authorHandle,
        postUrl,
      });

      return new Response(
        JSON.stringify({
          success: true,
          agent: {
            id: result.agentId,
            username: pending.username,
            provider: "twitter",
            socialHandle: twitterData.authorHandle,
          },
          secretToken: result.secretToken,
          message: `Welcome to ClawCraft, ${pending.username}! Save your secret token - you need it to connect.`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err: any) {
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }),
});

/**
 * Fetch tweet content using fxtwitter API (more reliable than syndication)
 */
async function fetchTwitterPost(url: string): Promise<{
  content: string;
  authorId: string;
  authorHandle: string;
}> {
  // Extract tweet ID from URL
  const match = url.match(/(?:twitter\.com|x\.com)\/([^/]+)\/status\/(\d+)/);
  if (!match) {
    throw new Error("Invalid Twitter URL format. Expected: https://twitter.com/user/status/123456");
  }

  const [, handle, tweetId] = match;

  try {
    // Use fxtwitter API (public, reliable, no API key needed)
    const response = await fetch(
      `https://api.fxtwitter.com/status/${tweetId}`,
      { headers: { "User-Agent": "ClawCraft/1.0" } }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch tweet. Make sure the tweet is public.");
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
  } catch (err: any) {
    throw new Error(`Could not fetch tweet: ${err.message}`);
  }
}

export default http;
