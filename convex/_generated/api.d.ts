/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as agents from "../agents.js";
import type * as auth from "../auth.js";
import type * as chat from "../chat.js";
import type * as chunks from "../chunks.js";
import type * as game from "../game.js";
import type * as http from "../http.js";
import type * as lib_noise from "../lib/noise.js";
import type * as lib_terrain from "../lib/terrain.js";
import type * as proposals from "../proposals.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  agents: typeof agents;
  auth: typeof auth;
  chat: typeof chat;
  chunks: typeof chunks;
  game: typeof game;
  http: typeof http;
  "lib/noise": typeof lib_noise;
  "lib/terrain": typeof lib_terrain;
  proposals: typeof proposals;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
