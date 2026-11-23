import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { songKey } from "./lib/predictions";
import { repertoireTitle } from "./lib/spotifyRepertoire";

// Internal query to count songs for an artist
export const countByArtist = internalQuery({
  args: { artistId: v.id("artists") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const artistSongs = await ctx.db
      .query("artistSongs")
      .withIndex("by_artist", (q) => q.eq("artistId", args.artistId))
      .collect();
    return artistSongs.length;
  },
});

export const countByArtistPublic = query({
  args: { artistId: v.id("artists") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const artistSongs = await ctx.db
      .query("artistSongs")
      .withIndex("by_artist", (q) => q.eq("artistId", args.artistId))
      .collect();
    return artistSongs.length;
  },
});

export const getByArtist = query({
  args: { 
    artistId: v.id("artists"),
    limit: v.optional(v.number())
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    // The show picker can request a complete large catalog, while compact
    // surfaces (artist cards/details) pass a much smaller limit. Keep a hard
    // upper bound so one public query cannot create an unbounded read.
    const limit = Math.max(1, Math.min(args.limit ?? 200, 500));
    
    // Get artist-song relationships
    const artistSongs = await ctx.db
      .query("artistSongs")
      .withIndex("by_artist", (q) => q.eq("artistId", args.artistId))
      .take(limit);

    // Get the actual songs
    const songs = await Promise.all(
      artistSongs.map(async (artistSong) => {
        const song = await ctx.db.get(artistSong.songId);
        const title = song && artistSong.source === "spotify_repertoire" ? repertoireTitle(song.title) : song?.title;
        return song && title ? { ...song, title, repertoireSource: artistSong.source, album: song.album ?? (artistSong.source === "setlistfm" ? "Performed live · setlist.fm" : undefined) } : null;
      })
    );

    // Filter to studio songs only: exclude live, remixes, commentary/etc
    const studioSongs = (songs.filter(Boolean) as Array<any>)
      .filter((s) => !s.isLive && !s.isRemix)
      .filter((s) => !/(commentary)/i.test(s.title || ''));

    const unique = new Map<string, any>();
    for (const song of studioSongs.sort((a, b) => (b.popularity || 0) - (a.popularity || 0))) {
      const key = songKey(song.title);
      if (!unique.has(key)) unique.set(key, song);
    }
    return [...unique.values()];
  },
});

export const createFromSpotify = internalMutation({
  args: {
    title: v.string(),
    album: v.optional(v.string()),
    spotifyId: v.string(),
    durationMs: v.optional(v.number()),
    popularity: v.optional(v.number()),
    trackNo: v.optional(v.number()),
    isLive: v.optional(v.boolean()),
    isRemix: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // CRITICAL FIX: Use index instead of filter for performance
    const existing = await ctx.db
      .query("songs")
      .withIndex("by_spotify_id", (q) => q.eq("spotifyId", args.spotifyId))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("songs", {
      title: args.title,
      album: args.album,
      spotifyId: args.spotifyId,
      durationMs: args.durationMs,
      popularity: args.popularity || 0,
      trackNo: args.trackNo,
      isLive: args.isLive || false,
      isRemix: args.isRemix || false,
    });
  },
});

export const getBySpotifyIdInternal = internalQuery({
  args: { spotifyId: v.string() },
  handler: async (ctx, args) => {
    // CRITICAL FIX: Use index instead of filter
    return await ctx.db
      .query("songs")
      .withIndex("by_spotify_id", (q) => q.eq("spotifyId", args.spotifyId))
      .first();
  },
});

export const createInternal = internalMutation({
  args: {
    title: v.string(),
    album: v.optional(v.string()),
    spotifyId: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    popularity: v.optional(v.number()),
    trackNo: v.optional(v.number()),
    isLive: v.optional(v.boolean()),
    isRemix: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("songs", {
      title: args.title,
      album: args.album,
      spotifyId: args.spotifyId,
      durationMs: args.durationMs,
      popularity: args.popularity || 0,
      trackNo: args.trackNo,
      isLive: args.isLive || false,
      isRemix: args.isRemix || false,
    });
  },
});

export const cleanupOrphanedSongs = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // FIXED: Paginate to avoid 32K doc limit
    const songs = await ctx.db.query("songs").take(100); // Process 100 at a time
    
    let deletedCount = 0;
    for (const song of songs) {
      // FIXED: Use index instead of filter for performance
      const artistSong = await ctx.db
        .query("artistSongs")
        .withIndex("by_song", (q) => q.eq("songId", song._id))
        .first();
      
      // If no artist relationship exists, delete the song
      if (!artistSong) {
        await ctx.db.delete(song._id);
        deletedCount++;
      }
    }
    
    console.log(`🧹 Cleaned up ${deletedCount} orphaned songs`);
    return null;
  },
});

// Functions for cleanup operations
export const getAllForCleanup = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db.query("songs").take(500); // Limit for performance
  },
});

export const deleteSong = internalMutation({
  args: { songId: v.id("songs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Remove artist-song relationships first
    const artistSongs = await ctx.db
      .query("artistSongs")
      .withIndex("by_song", (q) => q.eq("songId", args.songId))
      .collect();
    
    for (const artistSong of artistSongs) {
      await ctx.db.delete(artistSong._id);
    }
    
    // Remove the song
    await ctx.db.delete(args.songId);
    return null;
  },
});

// NEW: Get all artistSongs for an artist (for spotify.ts catalog sync guard)
export const getByArtistInternal = internalQuery({
  args: { artistId: v.id("artists") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("artistSongs")
      .withIndex("by_artist", (q) => q.eq("artistId", args.artistId))
      .collect();
  },
});

export const deleteByArtist = internalMutation({
  args: { artistId: v.id("artists") },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get all artist-song relationships
    const artistSongs = await ctx.db
      .query("artistSongs")
      .withIndex("by_artist", (q) => q.eq("artistId", args.artistId))
      .collect();
    
    // Delete songs and relationships
    for (const artistSong of artistSongs) {
      await ctx.db.delete(artistSong._id);
      const remaining = await ctx.db.query("artistSongs").withIndex("by_song", q => q.eq("songId", artistSong.songId)).first();
      if (!remaining) await ctx.db.delete(artistSong.songId);
    }
    
    return null;
  },
});

// Required functions for sync operations
export const getBySpotifyId = query({
  args: { spotifyId: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("songs")
      .withIndex("by_spotify_id", (q) => q.eq("spotifyId", args.spotifyId))
      .first();
  },
});

export const create = internalMutation({
  args: {
    title: v.string(),
    album: v.optional(v.string()),
    spotifyId: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    popularity: v.optional(v.number()),
    trackNo: v.optional(v.number()),
    isLive: v.optional(v.boolean()),
    isRemix: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Check if song already exists by Spotify ID first
    if (args.spotifyId) {
      const existing = await ctx.db
        .query("songs")
        .withIndex("by_spotify_id", (q) => q.eq("spotifyId", args.spotifyId))
        .first();
      
      if (existing) {
        return existing._id;
      }
    }

    // Create new song
    return await ctx.db.insert("songs", {
      title: args.title,
      album: args.album,
      spotifyId: args.spotifyId,
      durationMs: args.durationMs,
      popularity: args.popularity || 0,
      trackNo: args.trackNo,
      isLive: args.isLive || false,
      isRemix: args.isRemix || false,
    });
  },
});
