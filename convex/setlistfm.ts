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
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args): Promise<string | null> => {
    const apiKey = process.env.SETLISTFM_API_KEY;
    if (!apiKey) {
      console.log("Setlist.fm API key not configured");
      return null;
    }

    try {
      // Convert YYYY-MM-DD to DD-MM-YYYY format for setlist.fm API
      const [year, month, day] = args.showDate.split('-');
      const setlistfmDate = `${day}-${month}-${year}`;
      
      console.log(`Converting date ${args.showDate} to setlist.fm format: ${setlistfmDate}`);
      
      // Try multiple search strategies to find setlists
      let searchUrl = `https://api.setlist.fm/rest/1.0/search/setlists?artistName=${encodeURIComponent(args.artistName)}&cityName=${encodeURIComponent(args.venueCity)}&date=${setlistfmDate}`;
      
      console.log(`Searching setlist.fm: ${searchUrl}`);
      
      let response = await fetch(searchUrl, {
        headers: {
          'x-api-key': apiKey,
          'Accept': 'application/json',
          'User-Agent': 'setlists.live/1.0'
        }
      });

      // If no results, try without city (broader search)
      if (!response.ok || (await response.clone().json()).setlist?.length === 0) {
        searchUrl = `https://api.setlist.fm/rest/1.0/search/setlists?artistName=${encodeURIComponent(args.artistName)}&date=${setlistfmDate}`;
        console.log(`Retrying broader search: ${searchUrl}`);
        
        response = await fetch(searchUrl, {
          headers: {
            'x-api-key': apiKey,
            'Accept': 'application/json',
            'User-Agent': 'setlists.live/1.0'
          }
        });
      }

      // If still no results, try just artist name for recent shows
      if (!response.ok || (await response.clone().json()).setlist?.length === 0) {
        searchUrl = `https://api.setlist.fm/rest/1.0/search/setlists?artistName=${encodeURIComponent(args.artistName)}&p=1`;
        console.log(`Retrying with just artist name: ${searchUrl}`);
        
        response = await fetch(searchUrl, {
          headers: {
            'x-api-key': apiKey,
            'Accept': 'application/json',
            'User-Agent': 'setlists.live/1.0'
          }
        });
      }

      if (!response.ok) {
        console.log(`Setlist.fm API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const setlists = data.setlist || [];

      if (setlists.length === 0) {
        console.log(`No setlist found for ${args.artistName} on ${setlistfmDate}`);
        return null;
      }

      // Find the best matching setlist by venue and date
      let bestMatch = setlists[0];
      
      // Try to find exact venue match
      for (const setlist of setlists) {
        const venueMatch = setlist.venue?.name?.toLowerCase().includes(args.venueCity.toLowerCase()) ||
                          setlist.venue?.city?.name?.toLowerCase().includes(args.venueCity.toLowerCase());
        
        if (venueMatch && setlist.eventDate === setlistfmDate) {
          bestMatch = setlist;
          break;
        }
      }
      
      console.log(`Found setlist for ${bestMatch.artist?.name} at ${bestMatch.venue?.name} on ${bestMatch.eventDate}`);
      const setlist = bestMatch;
      const songs: { title: string; setNumber: number; encore: boolean; album?: string; duration?: number }[] = [];

      // Extract songs from sets with proper set numbers and encore tracking
      if (setlist.sets && setlist.sets.set) {
        for (const [setIndex, set] of setlist.sets.set.entries()) {
          const isEncore = set.encore === 1 || set.encore === true || set.encore === "true";
          const setNumber = setIndex + 1;
          
          console.log(`Processing set ${setNumber} (encore: ${isEncore}) with ${set.song?.length || 0} songs`);
          
          if (set.song && Array.isArray(set.song)) {
            for (const song of set.song) {
              if (song.name && song.name.trim() !== '') {
                // Include all songs, even jams and collaborations for completeness
                songs.push({ 
                  title: song.name.trim(),
                  setNumber: setNumber,
                  encore: isEncore,
                  // Include additional metadata if available
                  album: song.info || undefined,
                  duration: undefined, // setlist.fm doesn't provide duration
                });
              }
            }
          }
        }
      }

      if (songs.length === 0) {
        console.log(`No songs found in setlist for ${args.artistName}`);
        return null;
      }

      // Update existing setlist with actual setlist data using internal mutation
      await ctx.runMutation(internal.setlists.updateWithActualSetlist, {
        showId: args.showId,
        actualSetlist: songs,
        setlistfmId: setlist.id,
        setlistfmData: setlist, // Store raw setlist.fm data
      });
        
      console.log(`✅ Updated setlist for ${args.artistName} with ${songs.length} songs from setlist.fm`);
      return setlist.id;

    } catch (error) {
      console.error("Setlist.fm sync error:", error);
      return null;
    }
  },
});

export const checkCompletedShows = internalAction({
  args: {},
  returns: v.null(),
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
    return null;
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
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args): Promise<string | null> => {
    return await ctx.runAction(internal.setlistfm.syncActualSetlist, args);
  },
});

export const syncSpecificSetlist = internalAction({
  args: {
    showId: v.id("shows"),
    setlistfmId: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args): Promise<string | null> => {
    const apiKey = process.env.SETLISTFM_API_KEY;
    if (!apiKey) {
      console.log("Setlist.fm API key not configured");
      return null;
    }

    try {
      // Get specific setlist by ID
      const setlistUrl = `https://api.setlist.fm/rest/1.0/setlist/${args.setlistfmId}`;
      console.log(`Fetching specific setlist: ${setlistUrl}`);
      
      const response = await fetch(setlistUrl, {
        headers: {
          'x-api-key': apiKey,
          'Accept': 'application/json',
          'User-Agent': 'setlists.live/1.0'
        }
      });

      if (!response.ok) {
        console.log(`Setlist.fm API error: ${response.status}`);
        return null;
      }

      const setlist = await response.json();
      const songs: { title: string; setNumber: number; encore: boolean; album?: string; duration?: number }[] = [];

      console.log(`Found setlist for ${setlist.artist?.name} at ${setlist.venue?.name} on ${setlist.eventDate}`);

      // Extract songs from sets
      if (setlist.sets && setlist.sets.set) {
        for (const [setIndex, set] of setlist.sets.set.entries()) {
          const isEncore = set.encore === 1 || set.encore === true || set.encore === "true";
          const setNumber = setIndex + 1;
          
          console.log(`Processing set ${setNumber} (encore: ${isEncore}) with ${set.song?.length || 0} songs`);
          
          if (set.song && Array.isArray(set.song)) {
            for (const song of set.song) {
              if (song.name && song.name.trim() !== '') {
                songs.push({ 
                  title: song.name.trim(),
                  setNumber: setNumber,
                  encore: isEncore,
                  album: song.info || undefined,
                  duration: undefined,
                });
              }
            }
          }
        }
      }

      if (songs.length === 0) {
        console.log(`No songs found in setlist`);
        return null;
      }

      // Update setlist with actual data
      await ctx.runMutation(internal.setlists.updateWithActualSetlist, {
        showId: args.showId,
        actualSetlist: songs,
        setlistfmId: args.setlistfmId,
        setlistfmData: setlist,
      });
        
      console.log(`✅ Updated setlist with ${songs.length} songs from setlist.fm ID ${args.setlistfmId}`);
      return args.setlistfmId;

    } catch (error) {
      console.error("Setlist.fm sync error:", error);
      return null;
    }
  },
});

export const triggerCompletedShowsCheck = action({
  args: {},
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx): Promise<{ success: boolean; message: string }> => {
    await ctx.runAction(internal.setlistfm.checkCompletedShows, {});
    return { success: true, message: "Completed shows check triggered successfully" };
  },
});
