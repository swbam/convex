"use node";

import { action, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const syncActualSetlist = internalAction({
  args: {
    showId: v.id("shows"),
    artistName: v.string(),
    venueCity: v.string(),
    showDate: v.string(),
  },
  handler: async (ctx, args): Promise<string | null> => {
    const apiKey = process.env.SETLISTFM_API_KEY;
    if (!apiKey) {
      console.log("Setlist.fm API key not configured");
      return null;
    }

    try {
      // Search for setlists by artist and date
      const searchUrl = `https://api.setlist.fm/rest/1.0/search/setlists?artistName=${encodeURIComponent(args.artistName)}&cityName=${encodeURIComponent(args.venueCity)}&date=${args.showDate}`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'x-api-key': apiKey,
          'Accept': 'application/json',
          'User-Agent': 'TheSet/1.0'
        }
      });

      if (!response.ok) {
        console.log(`Setlist.fm API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const setlists = data.setlist || [];

      if (setlists.length === 0) {
        console.log(`No setlist found for ${args.artistName} on ${args.showDate}`);
        return null;
      }

      // Take the first matching setlist
      const setlist = setlists[0];
      const songs: { title: string }[] = [];

      // Extract songs from sets
      if (setlist.sets && setlist.sets.set) {
        for (const set of setlist.sets.set) {
          if (set.song) {
            for (const song of set.song) {
              if (song.name && !song.name.includes('(with ') && !song.name.includes('Jam')) {
                songs.push({ title: song.name });
              }
            }
          }
        }
      }

      if (songs.length === 0) {
        console.log(`No songs found in setlist for ${args.artistName}`);
        return null;
      }

      // Update existing community setlist with actual setlist data, or create new one
      const existingSetlist = await ctx.db
        .query("setlists")
        .withIndex("by_show", (q) => q.eq("showId", args.showId))
        .filter((q) => q.eq(q.field("isOfficial"), false))
        .first();

      if (existingSetlist) {
        // Update existing community setlist with actual data
        await ctx.db.patch(existingSetlist._id, {
          actualSetlist: songs.map(song => ({
            title: song.title,
            album: song.album,
            setNumber: 1, // Default to main set
            encore: false,
          })),
          setlistfmId: setlist.id,
          setlistfmData: setlist, // Store raw setlist.fm data
          lastUpdated: Date.now(),
        });
        
        console.log(`Updated existing setlist for ${args.artistName} with actual setlist data`);
        return existingSetlist._id;
      } else {
        // Create new setlist with actual data only
        const setlistId = await ctx.db.insert("setlists", {
          showId: args.showId,
          userId: undefined,
          songs: [], // Empty user predictions
          actualSetlist: songs.map(song => ({
            title: song.title,
            album: song.album,
            setNumber: 1, // Default to main set
            encore: false,
          })),
          verified: true,
          source: "setlistfm",
          lastUpdated: Date.now(),
          isOfficial: true,
          confidence: 1.0,
          upvotes: 0,
          downvotes: 0,
          setlistfmId: setlist.id,
          setlistfmData: setlist, // Store raw setlist.fm data
        });
        
        console.log(`Created new setlist for ${args.artistName} with actual setlist data`);
        return setlistId;
      }

    } catch (error) {
      console.error("Setlist.fm sync error:", error);
      return null;
    }
  },
});

export const checkCompletedShows = internalAction({
  args: {},
  handler: async (ctx) => {
    // Get shows that are past their date but still marked as upcoming
    const today = new Date().toISOString().split('T')[0];
    
    const upcomingShows = await ctx.runQuery(internal.shows.getUpcomingShows, {});
    
    let completedCount = 0;
    let setlistsSynced = 0;
    
    for (const show of upcomingShows) {
      if (show.date < today) {
        // Mark show as completed
        await ctx.runMutation(internal.shows.markCompleted, {
          showId: show._id,
        });
        completedCount++;

        // Try to sync actual setlist with retry logic
        if (show.artist && show.venue) {
          try {
            const setlistId = await ctx.runAction(internal.setlistfm.syncActualSetlist, {
              showId: show._id,
              artistName: show.artist.name,
              venueCity: show.venue.city,
              showDate: show.date,
            });
            
            if (setlistId) {
              setlistsSynced++;
              console.log(`✅ Synced setlist for ${show.artist.name} at ${show.venue.name}`);
            }
          } catch (error) {
            console.error(`❌ Failed to sync setlist for ${show.artist.name}:`, error);
          }
        }
        
        // Rate limiting to respect setlist.fm API
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`Completed shows check: ${completedCount} shows marked complete, ${setlistsSynced} setlists synced`);
  },
});

// Public actions for external use
export const triggerSetlistSync = action({
  args: {
    showId: v.id("shows"),
    artistName: v.string(),
    venueCity: v.string(),
    showDate: v.string(),
  },
  handler: async (ctx, args): Promise<string | null> => {
    return await ctx.runAction(internal.setlistfm.syncActualSetlist, args);
  },
});

export const triggerCompletedShowsCheck = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; message: string }> => {
    await ctx.runAction(internal.setlistfm.checkCompletedShows, {});
    return { success: true, message: "Completed shows check triggered successfully" };
  },
});
