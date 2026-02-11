/**
 * Shared admin helper functions extracted from admin.ts
 * These are pure utility functions used across admin operations.
 */
import { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const internalRef = internal as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const apiRef: any = require("./_generated/api").api;

// ============================================================================
// AUTH HELPERS
// ============================================================================

/** Require the current user to be an admin (for queries/mutations) */
export const requireAdmin = async (ctx: QueryCtx | MutationCtx): Promise<Id<"users">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
        throw new Error("Must be logged in");
    }

    const user = await ctx.db
        .query("users")
        .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
        .first();

    if (!user) {
        throw new Error("User not found");
    }

    if (user.role !== "admin") {
        throw new Error("Admin access required");
    }

    return user._id;
};

/** Require admin for actions (runs an internal query to check) */
export const requireAdminForAction = async (ctx: ActionCtx): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isAdmin: boolean = await ctx.runQuery(internalRef.admin.checkAdminInternal as any, {});
    if (!isAdmin) {
        throw new Error("Admin access required");
    }
};

// ============================================================================
// CONTENT FILTERING HELPERS
// ============================================================================

/** Check if a name represents a real concert (not children's, orchestral, etc.) */
export function isRealConcert(name: string): boolean {
    const lowerName = (name || '').toLowerCase();
    const rejectPatterns = [
        'tribute', 'experience', 'orchestra', 'symphony', 'chamber',
        'ballet', 'opera', 'broadway', 'musical', 'playhouse',
        'cirque', 'comedy', 'film with', '- film', 'live in concert',
        'ensemble', 'philharmonic', 'chorale', 'choir', 'choral',
        'film score', 'movie score', 'cinema', 'screening',
        'live to film', 'in concert film', 'soundtrack live',
        'charlie brown', 'a christmas', 'christmas story', 'holiday spectacular',
        'on ice', 'disney on', 'sesame street', 'paw patrol', 'peppa pig',
        'bluey', 'baby shark', 'cocomelon', 'nick jr', 'nutcracker',
        'magic show', 'illusionist', 'hypnotist', 'speaker', 'lecture',
        'podcast', 'wrestling', 'ufc', 'boxing', 'esports',
        'stand-up', 'standup', 'comedian', 'line dancing', 'game night',
        'wicked', 'hamilton', 'phantom', 'les mis', 'cats the musical',
        'lion king', 'book of mormon', 'dear evan', 'moulin rouge',
        'recital', 'concerto', 'twilight in concert', 'gaither vocal',
        'celtic woman', 'engelbert humperdinck', 'new york philharmonic'
    ];
    return !rejectPatterns.some(p => lowerName.includes(p));
}

/** Check if a song is a non-studio track (live, remix, etc.) */
export function isNonStudioSong(songTitle: string, albumName: string): boolean {
    const songLower = songTitle.toLowerCase().trim();
    const albumLower = albumName.toLowerCase().trim();

    const nonStudioIndicators = [
        // Live indicators
        'live', '- live', '(live)', '[live]', 'concert', 'acoustic version',
        'unplugged', 'session', 'bootleg', 'performance',

        // Remix/alternate indicators  
        'remix', 'rmx', 'mix)', 'edit', 'version)', 'radio edit', 'extended',

        // Feature indicators
        'feat.', 'featuring', 'ft.', '(with ', 'duet',

        // Deluxe/reissue indicators in album
        'deluxe', 'remaster', 'anniversary', 'tour edition', 'expanded',
        'special edition', 'collector', 'édition de luxe'
    ];

    return nonStudioIndicators.some(indicator =>
        songLower.includes(indicator) || albumLower.includes(indicator)
    );
}

/** Normalize a song key for demand backfill */
export function normalizeSongKey(title: string): string {
    return title
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/** Check if a country string represents the US */
export function isUSCountry(country: string | undefined): boolean {
    if (!country) return false;
    const lower = country.toLowerCase();
    return lower === 'united states of america' ||
        lower === 'united states' ||
        lower === 'usa' ||
        lower === 'us';
}
