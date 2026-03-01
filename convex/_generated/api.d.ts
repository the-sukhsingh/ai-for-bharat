/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as ai_socialScripts from "../ai_socialScripts.js";
import type * as ai_tools from "../ai_tools.js";
import type * as chats from "../chats.js";
import type * as contentDrafts from "../contentDrafts.js";
import type * as crons from "../crons.js";
import type * as messages from "../messages.js";
import type * as plans from "../plans.js";
import type * as publish from "../publish.js";
import type * as publishLogs from "../publishLogs.js";
import type * as scheduledPosts from "../scheduledPosts.js";
import type * as socialScripts from "../socialScripts.js";
import type * as thumbnails from "../thumbnails.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  ai_socialScripts: typeof ai_socialScripts;
  ai_tools: typeof ai_tools;
  chats: typeof chats;
  contentDrafts: typeof contentDrafts;
  crons: typeof crons;
  messages: typeof messages;
  plans: typeof plans;
  publish: typeof publish;
  publishLogs: typeof publishLogs;
  scheduledPosts: typeof scheduledPosts;
  socialScripts: typeof socialScripts;
  thumbnails: typeof thumbnails;
  users: typeof users;
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
