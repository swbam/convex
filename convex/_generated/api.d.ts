/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as admin_errorMonitoring from "../admin/errorMonitoring.js";
import type * as admin_sentryForward from "../admin/sentryForward.js";
import type * as admin from "../admin.js";
import type * as artistSongs from "../artistSongs.js";
import type * as artistSync from "../artistSync.js";
import type * as artists from "../artists.js";
import type * as auth from "../auth.js";
import type * as bulkCatalogSync from "../bulkCatalogSync.js";
import type * as common from "../common.js";
import type * as cronSettings from "../cronSettings.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as deployment from "../deployment.js";
import type * as diagnostics from "../diagnostics.js";
import type * as errorTracking from "../errorTracking.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as importTrendingShows from "../importTrendingShows.js";
import type * as leaderboard from "../leaderboard.js";
import type * as logger from "../logger.js";
import type * as maintenance from "../maintenance.js";
import type * as massivenessFilter from "../massivenessFilter.js";
import type * as media from "../media.js";
import type * as migrations_20240929_add_shows_fields from "../migrations/20240929_add_shows_fields.js";
import type * as migrations_fixUserFieldsMismatch from "../migrations/fixUserFieldsMismatch.js";
import type * as setlistfm from "../setlistfm.js";
import type * as setlists from "../setlists.js";
import type * as shows from "../shows.js";
import type * as songVotes from "../songVotes.js";
import type * as songs from "../songs.js";
import type * as spotify from "../spotify.js";
import type * as spotifyAuth from "../spotifyAuth.js";
import type * as spotifyAuthQueries from "../spotifyAuthQueries.js";
import type * as spotifyOAuth from "../spotifyOAuth.js";
import type * as syncJobs from "../syncJobs.js";
import type * as syncStatus from "../syncStatus.js";
import type * as ticketmaster from "../ticketmaster.js";
import type * as trending from "../trending.js";
import type * as users from "../users.js";
import type * as validators from "../validators.js";
import type * as venues from "../venues.js";
import type * as votes from "../votes.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

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
  "admin/errorMonitoring": typeof admin_errorMonitoring;
  "admin/sentryForward": typeof admin_sentryForward;
  admin: typeof admin;
  artistSongs: typeof artistSongs;
  artistSync: typeof artistSync;
  artists: typeof artists;
  auth: typeof auth;
  bulkCatalogSync: typeof bulkCatalogSync;
  common: typeof common;
  cronSettings: typeof cronSettings;
  crons: typeof crons;
  dashboard: typeof dashboard;
  deployment: typeof deployment;
  diagnostics: typeof diagnostics;
  errorTracking: typeof errorTracking;
  health: typeof health;
  http: typeof http;
  importTrendingShows: typeof importTrendingShows;
  leaderboard: typeof leaderboard;
  logger: typeof logger;
  maintenance: typeof maintenance;
  massivenessFilter: typeof massivenessFilter;
  media: typeof media;
  "migrations/20240929_add_shows_fields": typeof migrations_20240929_add_shows_fields;
  "migrations/fixUserFieldsMismatch": typeof migrations_fixUserFieldsMismatch;
  setlistfm: typeof setlistfm;
  setlists: typeof setlists;
  shows: typeof shows;
  songVotes: typeof songVotes;
  songs: typeof songs;
  spotify: typeof spotify;
  spotifyAuth: typeof spotifyAuth;
  spotifyAuthQueries: typeof spotifyAuthQueries;
  spotifyOAuth: typeof spotifyOAuth;
  syncJobs: typeof syncJobs;
  syncStatus: typeof syncStatus;
  ticketmaster: typeof ticketmaster;
  trending: typeof trending;
  users: typeof users;
  validators: typeof validators;
  venues: typeof venues;
  votes: typeof votes;
  webhooks: typeof webhooks;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
