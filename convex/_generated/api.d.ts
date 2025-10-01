/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as activity from "../activity.js";
import type * as admin from "../admin.js";
import type * as artistSongs from "../artistSongs.js";
import type * as artists from "../artists.js";
import type * as auth from "../auth.js";
import type * as common from "../common.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as deployment from "../deployment.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as leaderboard from "../leaderboard.js";
import type * as maintenance from "../maintenance.js";
import type * as migrations_20240929_add_shows_fields from "../migrations/20240929_add_shows_fields.js";
import type * as setlistfm from "../setlistfm.js";
import type * as setlists from "../setlists.js";
import type * as shows from "../shows.js";
import type * as songVotes from "../songVotes.js";
import type * as songs from "../songs.js";
import type * as spotify from "../spotify.js";
import type * as spotifyAuth from "../spotifyAuth.js";
import type * as syncJobs from "../syncJobs.js";
import type * as syncStatus from "../syncStatus.js";
import type * as ticketmaster from "../ticketmaster.js";
import type * as trending from "../trending.js";
import type * as users from "../users.js";
import type * as venues from "../venues.js";
import type * as votes from "../votes.js";
import type * as webhooks from "../webhooks.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  admin: typeof admin;
  artistSongs: typeof artistSongs;
  artists: typeof artists;
  auth: typeof auth;
  common: typeof common;
  crons: typeof crons;
  dashboard: typeof dashboard;
  deployment: typeof deployment;
  health: typeof health;
  http: typeof http;
  leaderboard: typeof leaderboard;
  maintenance: typeof maintenance;
  "migrations/20240929_add_shows_fields": typeof migrations_20240929_add_shows_fields;
  setlistfm: typeof setlistfm;
  setlists: typeof setlists;
  shows: typeof shows;
  songVotes: typeof songVotes;
  songs: typeof songs;
  spotify: typeof spotify;
  spotifyAuth: typeof spotifyAuth;
  syncJobs: typeof syncJobs;
  syncStatus: typeof syncStatus;
  ticketmaster: typeof ticketmaster;
  trending: typeof trending;
  users: typeof users;
  venues: typeof venues;
  votes: typeof votes;
  webhooks: typeof webhooks;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
