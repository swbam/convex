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
import type * as admin from "../admin.js";
import type * as admin_errorMonitoring from "../admin/errorMonitoring.js";
import type * as admin_sentryForward from "../admin/sentryForward.js";
import type * as adminAnalytics from "../adminAnalytics.js";
import type * as adminHelpers from "../adminHelpers.js";
import type * as analytics from "../analytics.js";
import type * as appearance from "../appearance.js";
import type * as artistAccess from "../artistAccess.js";
import type * as artistAutomation from "../artistAutomation.js";
import type * as artistClaims from "../artistClaims.js";
import type * as artistDashboard from "../artistDashboard.js";
import type * as artistDirectory from "../artistDirectory.js";
import type * as artistInvites from "../artistInvites.js";
import type * as artistNotifications from "../artistNotifications.js";
import type * as artistShowCounts from "../artistShowCounts.js";
import type * as artistSongs from "../artistSongs.js";
import type * as artistSync from "../artistSync.js";
import type * as artistWebsiteVerification from "../artistWebsiteVerification.js";
import type * as artists from "../artists.js";
import type * as auth from "../auth.js";
import type * as bulkCatalogSync from "../bulkCatalogSync.js";
import type * as catalogRepertoire from "../catalogRepertoire.js";
import type * as catalogSync from "../catalogSync.js";
import type * as clerkWebhookEvents from "../clerkWebhookEvents.js";
import type * as common from "../common.js";
import type * as cronOrchestrator from "../cronOrchestrator.js";
import type * as cronSettings from "../cronSettings.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as deployment from "../deployment.js";
import type * as diagnostics from "../diagnostics.js";
import type * as errorTracking from "../errorTracking.js";
import type * as festivalBootstrap from "../festivalBootstrap.js";
import type * as festivalLineupImport from "../festivalLineupImport.js";
import type * as festivalMediaSync from "../festivalMediaSync.js";
import type * as festivalRoster from "../festivalRoster.js";
import type * as festivals from "../festivals.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as importTrendingShows from "../importTrendingShows.js";
import type * as leaderboard from "../leaderboard.js";
import type * as lib_appearanceValidator from "../lib/appearanceValidator.js";
import type * as lib_artistLocks from "../lib/artistLocks.js";
import type * as lib_attractionIdentity from "../lib/attractionIdentity.js";
import type * as lib_catalogResult from "../lib/catalogResult.js";
import type * as lib_festivalIdentity from "../lib/festivalIdentity.js";
import type * as lib_festivalMedia from "../lib/festivalMedia.js";
import type * as lib_heroImages from "../lib/heroImages.js";
import type * as lib_importRetry from "../lib/importRetry.js";
import type * as lib_liveSetlistValidators from "../lib/liveSetlistValidators.js";
import type * as lib_officialSetlist from "../lib/officialSetlist.js";
import type * as lib_predictions from "../lib/predictions.js";
import type * as lib_setlistImportEvent from "../lib/setlistImportEvent.js";
import type * as lib_setlistMatch from "../lib/setlistMatch.js";
import type * as lib_setlistProviderFetch from "../lib/setlistProviderFetch.js";
import type * as lib_showTiming from "../lib/showTiming.js";
import type * as lib_songVoteCounts from "../lib/songVoteCounts.js";
import type * as lib_spotifyRepertoire from "../lib/spotifyRepertoire.js";
import type * as lib_voting from "../lib/voting.js";
import type * as liveSetlists from "../liveSetlists.js";
import type * as logger from "../logger.js";
import type * as maintenance from "../maintenance.js";
import type * as media from "../media.js";
import type * as mediaCache from "../mediaCache.js";
import type * as publicSeo from "../publicSeo.js";
import type * as seoEligibility from "../seoEligibility.js";
import type * as seoHtml from "../seoHtml.js";
import type * as seoRoutes from "../seoRoutes.js";
import type * as setlistProvider from "../setlistProvider.js";
import type * as setlistfm from "../setlistfm.js";
import type * as setlistfmHistory from "../setlistfmHistory.js";
import type * as setlists from "../setlists.js";
import type * as shows from "../shows.js";
import type * as sitemaps from "../sitemaps.js";
import type * as songSearch from "../songSearch.js";
import type * as songVotes from "../songVotes.js";
import type * as songs from "../songs.js";
import type * as spotify from "../spotify.js";
import type * as spotifyAuth from "../spotifyAuth.js";
import type * as spotifyAuthQueries from "../spotifyAuthQueries.js";
import type * as spotifyOAuth from "../spotifyOAuth.js";
import type * as syncJobs from "../syncJobs.js";
import type * as syncStatus from "../syncStatus.js";
import type * as ticketmaster from "../ticketmaster.js";
import type * as touringRefresh from "../touringRefresh.js";
import type * as trending from "../trending.js";
import type * as users from "../users.js";
import type * as validators from "../validators.js";
import type * as venues from "../venues.js";
import type * as votes from "../votes.js";
import type * as webhooks from "../webhooks.js";
import type * as wipeDatabase from "../wipeDatabase.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  admin: typeof admin;
  "admin/errorMonitoring": typeof admin_errorMonitoring;
  "admin/sentryForward": typeof admin_sentryForward;
  adminAnalytics: typeof adminAnalytics;
  adminHelpers: typeof adminHelpers;
  analytics: typeof analytics;
  appearance: typeof appearance;
  artistAccess: typeof artistAccess;
  artistAutomation: typeof artistAutomation;
  artistClaims: typeof artistClaims;
  artistDashboard: typeof artistDashboard;
  artistDirectory: typeof artistDirectory;
  artistInvites: typeof artistInvites;
  artistNotifications: typeof artistNotifications;
  artistShowCounts: typeof artistShowCounts;
  artistSongs: typeof artistSongs;
  artistSync: typeof artistSync;
  artistWebsiteVerification: typeof artistWebsiteVerification;
  artists: typeof artists;
  auth: typeof auth;
  bulkCatalogSync: typeof bulkCatalogSync;
  catalogRepertoire: typeof catalogRepertoire;
  catalogSync: typeof catalogSync;
  clerkWebhookEvents: typeof clerkWebhookEvents;
  common: typeof common;
  cronOrchestrator: typeof cronOrchestrator;
  cronSettings: typeof cronSettings;
  crons: typeof crons;
  dashboard: typeof dashboard;
  deployment: typeof deployment;
  diagnostics: typeof diagnostics;
  errorTracking: typeof errorTracking;
  festivalBootstrap: typeof festivalBootstrap;
  festivalLineupImport: typeof festivalLineupImport;
  festivalMediaSync: typeof festivalMediaSync;
  festivalRoster: typeof festivalRoster;
  festivals: typeof festivals;
  health: typeof health;
  http: typeof http;
  importTrendingShows: typeof importTrendingShows;
  leaderboard: typeof leaderboard;
  "lib/appearanceValidator": typeof lib_appearanceValidator;
  "lib/artistLocks": typeof lib_artistLocks;
  "lib/attractionIdentity": typeof lib_attractionIdentity;
  "lib/catalogResult": typeof lib_catalogResult;
  "lib/festivalIdentity": typeof lib_festivalIdentity;
  "lib/festivalMedia": typeof lib_festivalMedia;
  "lib/heroImages": typeof lib_heroImages;
  "lib/importRetry": typeof lib_importRetry;
  "lib/liveSetlistValidators": typeof lib_liveSetlistValidators;
  "lib/officialSetlist": typeof lib_officialSetlist;
  "lib/predictions": typeof lib_predictions;
  "lib/setlistImportEvent": typeof lib_setlistImportEvent;
  "lib/setlistMatch": typeof lib_setlistMatch;
  "lib/setlistProviderFetch": typeof lib_setlistProviderFetch;
  "lib/showTiming": typeof lib_showTiming;
  "lib/songVoteCounts": typeof lib_songVoteCounts;
  "lib/spotifyRepertoire": typeof lib_spotifyRepertoire;
  "lib/voting": typeof lib_voting;
  liveSetlists: typeof liveSetlists;
  logger: typeof logger;
  maintenance: typeof maintenance;
  media: typeof media;
  mediaCache: typeof mediaCache;
  publicSeo: typeof publicSeo;
  seoEligibility: typeof seoEligibility;
  seoHtml: typeof seoHtml;
  seoRoutes: typeof seoRoutes;
  setlistProvider: typeof setlistProvider;
  setlistfm: typeof setlistfm;
  setlistfmHistory: typeof setlistfmHistory;
  setlists: typeof setlists;
  shows: typeof shows;
  sitemaps: typeof sitemaps;
  songSearch: typeof songSearch;
  songVotes: typeof songVotes;
  songs: typeof songs;
  spotify: typeof spotify;
  spotifyAuth: typeof spotifyAuth;
  spotifyAuthQueries: typeof spotifyAuthQueries;
  spotifyOAuth: typeof spotifyOAuth;
  syncJobs: typeof syncJobs;
  syncStatus: typeof syncStatus;
  ticketmaster: typeof ticketmaster;
  touringRefresh: typeof touringRefresh;
  trending: typeof trending;
  users: typeof users;
  validators: typeof validators;
  venues: typeof venues;
  votes: typeof votes;
  webhooks: typeof webhooks;
  wipeDatabase: typeof wipeDatabase;
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

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
