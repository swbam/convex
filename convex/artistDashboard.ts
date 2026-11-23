import { canonicalShowKey, showWithTickets } from "./lib/showTickets";
import { songKey as normalizeSongKey, summarizeRequests } from "./lib/predictions";
import { getRequestCounts } from "./lib/songVoteCounts";
import { query } from "./_generated/server";
import { v } from "convex/values";

async function getCurrentAppUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q: any) => q.eq("authId", identity.subject))
    .first();
}

async function requireArtistMember(ctx: any, artistId: any) {
  const user = await getCurrentAppUser(ctx);
  if (!user) throw new Error("Must be logged in");
  const membership = await ctx.db
    .query("artistMembers")
    .withIndex("by_user_artist", (q: any) => q.eq("userId", user._id).eq("artistId", artistId))
    .first();
  if (!membership) throw new Error("Artist access required");
  return { user, membership };
}

const parseDate = (dateString?: string) => new Date(dateString || "");

export const getArtistHome = query({
  args: { artistId: v.id("artists") },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireArtistMember(ctx, args.artistId);

    const artist = await ctx.db.get(args.artistId);
    if (!artist) throw new Error("Artist not found");

    const upcoming = await ctx.db
      .query("shows")
      .withIndex("by_artist_status_and_date", (q) => q.eq("artistId", args.artistId).eq("status", "upcoming"))
      .order("asc")
      .take(100);

    const hydrated = await Promise.all(
      upcoming.map(async show => {
        const [venue, canonicalKey] = await Promise.all([ctx.db.get(show.venueId), canonicalShowKey(ctx, show)]);
        return { ...show, venue, canonicalKey };
      }),
    );

    const shows = hydrated
      .filter((s: any) => !!s.venue)
      .sort((a: any, b: any) => parseDate(a.date).getTime() - parseDate(b.date).getTime());

    const hasCatalog = !!await ctx.db.query("artistSongs").withIndex("by_artist", q => q.eq("artistId", args.artistId)).first();
    const nextShow = shows[0];
    const hasFanRequests = nextShow ? !!await ctx.db.query("showSongDemand")
      .withIndex("by_show_upvotes", q => q.eq("showId", nextShow._id)).filter(q => q.gt(q.field("upvotes"), 0)).first() : false;
    return { artist, shows, readiness: { hasCatalog, hasNextShow: !!nextShow, hasFanRequests } };
  },
});

export const getShowDemand = query({
  args: { showId: v.id("shows") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const show = await ctx.db.get(args.showId);
    if (!show) throw new Error("Show not found");

    await requireArtistMember(ctx, show.artistId);

    const [artist, venue] = await Promise.all([ctx.db.get(show.artistId), ctx.db.get(show.venueId)]);

    const setlists = await ctx.db
      .query("setlists")
      .withIndex("by_show", (q) => q.eq("showId", args.showId))
      .collect();

    const prediction =
      setlists.find((s: any) => !s.isOfficial && !s.userId) ??
      setlists.find((s: any) => !s.isOfficial) ??
      null;

    const predictedTitles = Array.isArray(prediction?.songs)
      ? (prediction!.songs as any[])
          .map((s) => (typeof s === "string" ? s : s?.title))
          .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      : [];

    const predictedSet = new Set(predictedTitles.map((t) => normalizeSongKey(t)));

    const demandRows = await ctx.db
      .query("showSongDemand")
      .withIndex("by_show_upvotes", (q) => q.eq("showId", args.showId))
      .order("desc")
      .take(250);

    const demandByKey = new Map<string, any>();
    for (const row of demandRows) {
      demandByKey.set(row.songKey, row);
    }

    const merged: Array<{
      songKey: string;
      songTitle: string;
      upvotes: number;
      inPrediction: boolean;
      lastVoteAt?: number;
    }> = [];

    // First: voted songs (descending), include whether they are already in prediction.
    for (const row of demandRows) {
      merged.push({
        songKey: row.songKey,
        songTitle: row.songTitle,
        upvotes: row.upvotes,
        inPrediction: predictedSet.has(row.songKey),
        lastVoteAt: row.lastVoteAt,
      });
    }

    // Then: prediction songs with 0 votes (so artists see the full predicted list).
    for (const title of predictedTitles) {
      const key = normalizeSongKey(title);
      if (demandByKey.has(key)) continue;
      merged.push({
        songKey: key,
        songTitle: title,
        upvotes: 0,
        inPrediction: true,
      });
    }

    return {
      show: { ...await showWithTickets(ctx, show), artist, venue },
      predictionSetlistId: prediction?._id ?? null,
      songs: merged,
    };
  },
});

// ============================================================================
// TOUR INSIGHTS
// ============================================================================

/**
 * Get tour-wide top songs across all upcoming shows.
 * Aggregates demand from all shows to show overall fan preferences.
 */
export const getTourTopSongs = query({
  args: { 
    artistId: v.id("artists"),
    limit: v.optional(v.number()),
    daysWindow: v.optional(v.number()), // Only count votes from last N days
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireArtistMember(ctx, args.artistId);
    
    const limit = args.limit ?? 25;
    const daysWindow = args.daysWindow ?? 30;
    const windowStart = Date.now() - daysWindow * 24 * 60 * 60 * 1000;

    // Get all upcoming shows
    const upcomingShows = await ctx.db
      .query("shows")
      .withIndex("by_artist_and_status", (q) => q.eq("artistId", args.artistId).eq("status", "upcoming"))
      .collect();

    if (upcomingShows.length === 0) {
      return { songs: [], totalShows: 0, totalVotes: 0 };
    }

    // Aggregate demand across all shows
    const songDemandMap = new Map<string, { 
      songTitle: string; 
      totalUpvotes: number; 
      showCount: number;
      recentVotes: number; // Votes in the window
      lastVoteAt: number;
    }>();

    let totalVotes = 0;

    for (const show of upcomingShows) {
      const demandRows = await ctx.db
        .query("showSongDemand")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .collect();

      for (const row of demandRows) {
        const existing = songDemandMap.get(row.songKey);
        const isRecent = row.lastVoteAt >= windowStart;
        
        if (existing) {
          existing.totalUpvotes += row.upvotes;
          existing.showCount++;
          if (isRecent) {
            existing.recentVotes += row.upvotes;
          }
          if (row.lastVoteAt > existing.lastVoteAt) {
            existing.lastVoteAt = row.lastVoteAt;
            existing.songTitle = row.songTitle; // Keep most recent title format
          }
        } else {
          songDemandMap.set(row.songKey, {
            songTitle: row.songTitle,
            totalUpvotes: row.upvotes,
            showCount: 1,
            recentVotes: isRecent ? row.upvotes : 0,
            lastVoteAt: row.lastVoteAt,
          });
        }
        totalVotes += row.upvotes;
      }
    }

    // Convert to array and sort by total upvotes
    const songs = Array.from(songDemandMap.entries())
      .map(([songKey, data]) => ({
        songKey,
        ...data,
        avgPerShow: data.showCount > 0 ? Math.round((data.totalUpvotes / data.showCount) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.totalUpvotes - a.totalUpvotes)
      .slice(0, limit);

    return {
      songs,
      totalShows: upcomingShows.length,
      totalVotes,
      windowDays: daysWindow,
    };
  },
});

/**
 * Get city-specific demand deltas.
 * Shows which songs are over/under-indexed in each city compared to tour average.
 */
export const getCityDeltas = query({
  args: { 
    artistId: v.id("artists"),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireArtistMember(ctx, args.artistId);
    
    const limit = args.limit ?? 10;

    // Get all upcoming shows with venues
    const upcomingShows = await ctx.db
      .query("shows")
      .withIndex("by_artist_and_status", (q) => q.eq("artistId", args.artistId).eq("status", "upcoming"))
      .collect();

    if (upcomingShows.length === 0) {
      return { cities: [] };
    }

    // Get venues and aggregate by city
    const showsByCity = new Map<string, Array<{ show: any; venue: any }>>();
    
    for (const show of upcomingShows) {
      const venue = await ctx.db.get(show.venueId);
      if (!venue) continue;
      
      const cityKey = `${venue.city}, ${venue.state || venue.country}`;
      const existing = showsByCity.get(cityKey) || [];
      existing.push({ show, venue });
      showsByCity.set(cityKey, existing);
    }

    // Calculate tour-wide song averages first
    const tourSongTotals = new Map<string, { total: number; count: number; title: string }>();
    
    for (const show of upcomingShows) {
      const demandRows = await ctx.db
        .query("showSongDemand")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .collect();
      
      for (const row of demandRows) {
        const existing = tourSongTotals.get(row.songKey);
        if (existing) {
          existing.total += row.upvotes;
          existing.count++;
        } else {
          tourSongTotals.set(row.songKey, { total: row.upvotes, count: 1, title: row.songTitle });
        }
      }
    }

    // Calculate city-specific deltas
    const cities = [];
    
    for (const [cityKey, cityShows] of showsByCity.entries()) {
      // Aggregate demand for this city
      const citySongTotals = new Map<string, number>();
      
      for (const { show } of cityShows) {
        const demandRows = await ctx.db
          .query("showSongDemand")
          .withIndex("by_show", (q) => q.eq("showId", show._id))
          .collect();
        
        for (const row of demandRows) {
          citySongTotals.set(row.songKey, (citySongTotals.get(row.songKey) || 0) + row.upvotes);
        }
      }

      // Calculate deltas (city % vs tour %)
      const cityTotal = Array.from(citySongTotals.values()).reduce((a, b) => a + b, 0);
      const tourTotal = Array.from(tourSongTotals.values()).reduce((sum, v) => sum + v.total, 0);
      
      if (cityTotal === 0 || tourTotal === 0) continue;

      const songDeltas: Array<{ songKey: string; songTitle: string; cityPct: number; tourPct: number; delta: number }> = [];
      
      for (const [songKey, cityVotes] of citySongTotals.entries()) {
        const tourData = tourSongTotals.get(songKey);
        if (!tourData) continue;
        
        const cityPct = (cityVotes / cityTotal) * 100;
        const tourPct = (tourData.total / tourTotal) * 100;
        const delta = cityPct - tourPct;
        
        songDeltas.push({
          songKey,
          songTitle: tourData.title,
          cityPct: Math.round(cityPct * 10) / 10,
          tourPct: Math.round(tourPct * 10) / 10,
          delta: Math.round(delta * 10) / 10,
        });
      }

      // Get top over-indexed and under-indexed songs
      songDeltas.sort((a, b) => b.delta - a.delta);
      const overIndexed = songDeltas.slice(0, 3).filter(s => s.delta > 1);
      const underIndexed = songDeltas.slice(-3).filter(s => s.delta < -1).reverse();

      cities.push({
        city: cityKey,
        showCount: cityShows.length,
        totalVotes: cityTotal,
        overIndexed,
        underIndexed,
        nextShowDate: cityShows[0]?.show.date,
      });
    }

    // Sort cities by next show date
    cities.sort((a, b) => parseDate(a.nextShowDate).getTime() - parseDate(b.nextShowDate).getTime());

    return { cities };
  },
});

/**
 * Get song momentum - which songs are gaining/losing votes recently.
 */
export const getSongMomentum = query({
  args: { 
    artistId: v.id("artists"),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireArtistMember(ctx, args.artistId);
    
    const limit = args.limit ?? 10;
    const now = Date.now();
    const recentWindow = 7 * 24 * 60 * 60 * 1000; // 7 days
    const olderWindow = 30 * 24 * 60 * 60 * 1000; // 30 days

    // Get all upcoming shows
    const upcomingShows = await ctx.db
      .query("shows")
      .withIndex("by_artist_and_status", (q) => q.eq("artistId", args.artistId).eq("status", "upcoming"))
      .collect();

    if (upcomingShows.length === 0) {
      return { trending: [], falling: [] };
    }

    // For each show, look at recent votes from songVotes table
    const songRecentVotes = new Map<string, { title: string; recent: number; older: number }>();
    
    for (const show of upcomingShows) {
      // Get setlists for this show
      const setlists = await ctx.db
        .query("setlists")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .collect();
      
      for (const setlist of setlists) {
        // Get votes for this setlist
        const votes = await ctx.db
          .query("songVotes")
          .withIndex("by_setlist", (q) => q.eq("setlistId", setlist._id))
          .collect();
        
        for (const vote of votes) {
          const songKey = normalizeSongKey(vote.songTitle);
          const existing = songRecentVotes.get(songKey) || { title: vote.songTitle, recent: 0, older: 0 };
          
          const age = now - vote.createdAt;
          if (age < recentWindow) {
            existing.recent++;
          } else if (age < olderWindow) {
            existing.older++;
          }
          
          songRecentVotes.set(songKey, existing);
        }
      }
    }

    // Calculate momentum (recent - older, normalized)
    const songs = Array.from(songRecentVotes.entries())
      .filter(([_, data]) => data.recent + data.older >= 3) // Minimum sample
      .map(([songKey, data]) => {
        // Momentum = recent rate vs older rate
        const totalVotes = data.recent + data.older;
        const recentRate = data.recent / 7; // votes per day in recent window
        const olderRate = data.older / 23;  // votes per day in older window (30-7 days)
        const momentum = olderRate > 0 ? (recentRate - olderRate) / olderRate * 100 : (data.recent > 0 ? 100 : 0);
        
        return {
          songKey,
          songTitle: data.title,
          recentVotes: data.recent,
          olderVotes: data.older,
          totalVotes,
          momentum: Math.round(momentum),
        };
      });

    // Sort by momentum
    songs.sort((a, b) => b.momentum - a.momentum);
    
    const trending = songs.filter(s => s.momentum > 20).slice(0, limit);
    const falling = songs.filter(s => s.momentum < -20).sort((a, b) => a.momentum - b.momentum).slice(0, limit);

    return { trending, falling };
  },
});

/**
 * Get post-show report comparing predictions to actual setlist.
 */
export const getPostShowReport = query({
  args: { showId: v.id("shows") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const show = await ctx.db.get(args.showId);
    if (!show) throw new Error("Show not found");

    await requireArtistMember(ctx, show.artistId);

    const [artist, venue] = await Promise.all([
      ctx.db.get(show.artistId),
      ctx.db.get(show.venueId),
    ]);

    // Get setlists
    const setlists = await ctx.db
      .query("setlists")
      .withIndex("by_show", (q) => q.eq("showId", args.showId))
      .collect();

    // Find the actual setlist (from setlist.fm) and fan prediction
    const actualSetlist = setlists.find((s: any) => s.actualSetlist && s.actualSetlist.length > 0);
    const prediction = setlists.find((s: any) => !s.isOfficial && !s.userId);

    if (!actualSetlist?.actualSetlist) {
      return {
        show: { ...show, artist, venue },
        status: "no_actual_setlist",
        message: "Actual setlist not available yet",
      };
    }

    const counts = prediction ? await getRequestCounts(ctx, prediction) : [];
    const summary = summarizeRequests(counts, actualSetlist.actualSetlist);
    const demandByKey = new Map([...summary.requested.entries()].map(([key, row]) => [key, row.upvotes]));

    // Build the actual setlist with vote data
    const actualSongs = (actualSetlist.actualSetlist as any[]).map((song, index) => {
      const songKey = normalizeSongKey(song.title);
      const votes = demandByKey.get(songKey) || 0;
      
      const wasPredicted = votes > 0;

      return {
        position: index + 1,
        title: song.title,
        setNumber: song.setNumber,
        encore: song.encore,
        votes,
        wasPredicted,
        songKey,
      };
    });

    // Calculate stats
    const totalSongsPlayed = actualSongs.length;
    const songsWithVotes = actualSongs.filter(s => s.votes > 0).length;
    const predictedAndPlayed = actualSongs.filter(s => s.wasPredicted).length;
    
    // Get top voted songs that weren't played
    const playedKeys = new Set(actualSongs.map(s => s.songKey));
    const missedRequests = Array.from(demandByKey.entries())
      .filter(([key, votes]) => !playedKeys.has(key) && votes > 0)
      .map(([key, votes]) => {
        const demandRow = summary.requested.get(key);
        return { songKey: key, songTitle: demandRow?.songTitle || key, votes };
      })
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 10);

    // Get songs with most votes that were played
    const topRequestsPlayed = actualSongs
      .filter(s => s.votes > 0)
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 10);

    return {
      show: { ...show, artist, venue },
      status: "complete",
      setlist: actualSongs,
      stats: {
        totalSongsPlayed,
        songsWithVotes,
        predictedAndPlayed,
        predictionAccuracy: summary.accuracy,
        requestedSongs: summary.requestedSongs,
        fanRequestsFulfilled: summary.accuracy,
        hasCommunityData: summary.hasCommunityData,
      },
      topRequestsPlayed,
      missedRequests,
      sourceSetlistId: actualSetlist._id,
      predictionSetlistId: prediction?._id,
    };
  },
});

/**
 * Get completed shows for post-show reports.
 */
export const getCompletedShows = query({
  args: { 
    artistId: v.id("artists"),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireArtistMember(ctx, args.artistId);
    
    const limit = args.limit ?? 20;

    // Get completed shows
    const completedShows = await ctx.db
      .query("shows")
      .withIndex("by_artist_and_status", (q) => q.eq("artistId", args.artistId).eq("status", "completed"))
      .order("desc")
      .take(limit);

    // Hydrate with venue and check if actual setlist exists
    const hydratedShows = await Promise.all(
      completedShows.map(async (show) => {
        const venue = await ctx.db.get(show.venueId);
        
        // Check if we have an actual setlist
        const setlists = await ctx.db
          .query("setlists")
          .withIndex("by_show", (q) => q.eq("showId", show._id))
          .collect();
        
        const hasActualSetlist = setlists.some((s: any) => s.actualSetlist && s.actualSetlist.length > 0);
        
        return {
          ...show,
          venue,
          hasActualSetlist,
        };
      })
    );

    // Sort by date (most recent first)
    hydratedShows.sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());

    return { shows: hydratedShows };
  },
});

/**
 * Get tour overview stats.
 */
export const getTourOverview = query({
  args: { artistId: v.id("artists") },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireArtistMember(ctx, args.artistId);

    const artist = await ctx.db.get(args.artistId);
    if (!artist) throw new Error("Artist not found");

    // Count shows by status
    const upcoming = await ctx.db
      .query("shows")
      .withIndex("by_artist_and_status", (q) => q.eq("artistId", args.artistId).eq("status", "upcoming"))
      .collect();

    const completed = await ctx.db
      .query("shows")
      .withIndex("by_artist_and_status", (q) => q.eq("artistId", args.artistId).eq("status", "completed"))
      .collect();

    // Calculate total votes across all upcoming shows
    let totalUpcomingVotes = 0;
    let totalUniqueSongs = new Set<string>();
    
    for (const show of upcoming) {
      const demandRows = await ctx.db
        .query("showSongDemand")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .collect();
      
      for (const row of demandRows) {
        totalUpcomingVotes += row.upvotes;
        totalUniqueSongs.add(row.songKey);
      }
    }

    // Get next show
    const sortedUpcoming = [...upcoming].sort(
      (a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime()
    );
    const nextShow = sortedUpcoming[0];
    const nextShowVenue = nextShow ? await ctx.db.get(nextShow.venueId) : null;

    return {
      artist,
      stats: {
        upcomingShows: upcoming.length,
        completedShows: completed.length,
        totalVotes: totalUpcomingVotes,
        uniqueSongsVoted: totalUniqueSongs.size,
      },
      nextShow: nextShow ? {
        ...nextShow,
        venue: nextShowVenue,
      } : null,
    };
  },
});

/**
 * Get historical setlists from completed shows.
 * Shows actual setlists from setlist.fm for past shows.
 */
export const getHistoricalSetlists = query({
  args: { 
    artistId: v.id("artists"),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireArtistMember(ctx, args.artistId);
    
    const limit = args.limit ?? 20;

    // Get completed shows
    const completedShows = await ctx.db
      .query("shows")
      .withIndex("by_artist_and_status", (q) => q.eq("artistId", args.artistId).eq("status", "completed"))
      .order("desc")
      .take(limit * 2); // Get more to filter

    const setlistsWithShows = [];
    
    for (const show of completedShows) {
      if (setlistsWithShows.length >= limit) break;
      
      const venue = await ctx.db.get(show.venueId);
      
      // Get setlist with actual songs
      const setlists = await ctx.db
        .query("setlists")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .collect();
      
      const actualSetlist = setlists.find((s: any) => s.actualSetlist && s.actualSetlist.length > 0);
      
      if (actualSetlist?.actualSetlist) {
        setlistsWithShows.push({
          showId: show._id,
          date: show.date,
          venue: venue ? {
            name: venue.name,
            city: venue.city,
            state: venue.state,
            country: venue.country,
          } : null,
          songCount: actualSetlist.actualSetlist.length,
          songs: actualSetlist.actualSetlist,
          setlistId: actualSetlist._id,
          setlistFmUrl: (actualSetlist as any).setlistfmData?.url,
        });
      }
    }

    // Sort by date descending
    setlistsWithShows.sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());

    return { 
      setlists: setlistsWithShows,
      total: setlistsWithShows.length,
    };
  },
});

/**
 * Get song frequency across historical setlists.
 * Helps artists see which songs they play most often.
 */
export const getSongFrequency = query({
  args: { 
    artistId: v.id("artists"),
    limit: v.optional(v.number()),
    showsToAnalyze: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireArtistMember(ctx, args.artistId);
    
    const showsToAnalyze = Math.max(1, Math.min(100, args.showsToAnalyze ?? 50));
    const limit = Math.max(1, Math.min(100, args.limit ?? 30));

    // Get recent completed shows
    const completedShows = await ctx.db
      .query("shows")
      .withIndex("by_artist_status_and_date", (q) => q.eq("artistId", args.artistId).eq("status", "completed"))
      .order("desc")
      .take(showsToAnalyze);

    const songCounts = new Map<string, { title: string; count: number; lastPlayed: string }>();
    let totalShowsWithSetlists = 0;
    
    for (const show of completedShows) {
      const setlists = await ctx.db
        .query("setlists")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .collect();
      
      const actualSetlist = setlists.find((s: any) => s.actualSetlist && s.actualSetlist.length > 0);
      
      if (actualSetlist?.actualSetlist) {
        totalShowsWithSetlists++;
        
        const playedAtShow = new Set<string>();
        for (const song of actualSetlist.actualSetlist as any[]) {
          const key = normalizeSongKey(song.title);
          if (!key || playedAtShow.has(key)) continue;
          playedAtShow.add(key);
          const existing = songCounts.get(key);
          
          if (existing) {
            existing.count++;
            // Keep most recent date
            if (parseDate(show.date).getTime() > parseDate(existing.lastPlayed).getTime()) {
              existing.lastPlayed = show.date;
            }
          } else {
            songCounts.set(key, {
              title: song.title,
              count: 1,
              lastPlayed: show.date,
            });
          }
        }
      }
    }

    // Convert to array and sort by frequency
    const songs = Array.from(songCounts.entries())
      .map(([songKey, data]) => ({
        songKey,
        ...data,
        percentage: totalShowsWithSetlists > 0 
          ? Math.round((data.count / totalShowsWithSetlists) * 100)
          : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return {
      songs,
      totalShowsAnalyzed: totalShowsWithSetlists,
    };
  },
});
