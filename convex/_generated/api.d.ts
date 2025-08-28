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
import type * as artistSongs from "../artistSongs.js";
import type * as artists from "../artists.js";
import type * as auth from "../auth.js";
import type * as cron from "../cron.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as router from "../router.js";
import type * as sampleData from "../sampleData.js";
import type * as setlistfm from "../setlistfm.js";
import type * as setlists from "../setlists.js";
import type * as shows from "../shows.js";
import type * as songs from "../songs.js";
import type * as spotify from "../spotify.js";
import type * as sync from "../sync.js";
import type * as syncJobs from "../syncJobs.js";
import type * as syncStatus from "../syncStatus.js";
import type * as ticketmaster from "../ticketmaster.js";
import type * as users from "../users.js";
import type * as venues from "../venues.js";
import type * as votes from "../votes.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  artistSongs: typeof artistSongs;
  artists: typeof artists;
  auth: typeof auth;
  cron: typeof cron;
  crons: typeof crons;
  dashboard: typeof dashboard;
  router: typeof router;
  sampleData: typeof sampleData;
  setlistfm: typeof setlistfm;
  setlists: typeof setlists;
  shows: typeof shows;
  songs: typeof songs;
  spotify: typeof spotify;
  sync: typeof sync;
  syncJobs: typeof syncJobs;
  syncStatus: typeof syncStatus;
  ticketmaster: typeof ticketmaster;
  users: typeof users;
  venues: typeof venues;
  votes: typeof votes;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
