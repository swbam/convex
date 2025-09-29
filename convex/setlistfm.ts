"use node";

import { action, internalAction } from "./_generated/server";
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
      console.error("Setlist.fm API key not configured");
      return null;
    }

    // Validate show exists first
    const show = await ctx.runQuery(internal.shows.getByIdInternal, { id: args.showId });
    if (!show) {
      console.error(`Show ${args.showId} not found`);
      return null;
    }

    const maxRetries = 5; // Increased retries
    let attempt = 0;
    let lastError: unknown = null;

    while (attempt < maxRetries) {
      try {
        // Convert date with validation
        const dateMatch = args.showDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!dateMatch) {
          console.error(`Invalid date format: ${args.showDate}`);
          return null;
        }
        const [, year, month, day] = dateMatch;
        const setlistfmDate = `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
        
        console.log(`Converting date ${args.showDate} to setlist.fm format: ${setlistfmDate}`);
        
        // Search logic
        let searchUrl = `https://api.setlist.fm/rest/1.0/search/setlists?artistName=${encodeURIComponent(args.artistName)}&cityName=${encodeURIComponent(args.venueCity)}&date=${setlistfmDate}`;
        
        console.log(`Searching setlist.fm: ${searchUrl}`);
        
        let response = await fetch(searchUrl, {
          headers: {
            'x-api-key': apiKey,
            'Accept': 'application/json',
            'User-Agent': 'setlists.live/1.0'
          }
        });

        // Broader search if needed
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

        // Artist only if still no results
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
          const errorText = await response.text();
          throw new Error(`API request failed with status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        if (!data.setlist) {
          throw new Error("Invalid API response: no setlist data");
        }
        const setlists = data.setlist || [];

        if (setlists.length === 0) {
          console.log(`No setlist found for ${args.artistName} on ${setlistfmDate}`);
          return null;
        }

        // Enhanced matching with fuzzy logic
        let bestMatch = null;
        let bestScore = 0;

        // Simple fuzzy match function
        const fuzzyMatch = (str1: string, str2: string): number => {
          if (!str1 || !str2) return 0;
          str1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '');
          str2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (str1.length === 0 || str2.length === 0) return 0;
          const longer = Math.max(str1.length, str2.length);
          let distance = 0;
          for (let i = 0; i < longer; i++) {
            if (str1[i] !== str2[i]) distance++;
          }
          return 1 - (distance / longer);
        };

        for (const setlist of setlists) {
          let score = 0;
          if (setlist.eventDate === setlistfmDate) score += 0.4;
          if (setlist.venue) {
            const venueScore = fuzzyMatch(setlist.venue.name || '', args.venueCity) + fuzzyMatch(setlist.venue.city?.name || '', args.venueCity);
            score += venueScore * 0.6;
          }
          if (setlist.artist?.name.toLowerCase().includes(args.artistName.toLowerCase())) score += 0.2;

          if (score > bestScore) {
            bestScore = score;
            bestMatch = setlist;
          }
        }

        if (!bestMatch || bestScore < 0.3) { // Threshold for match
          console.log(`No good match found for ${args.artistName} on ${setlistfmDate} (best score: ${bestScore})`);
          return null;
        }
        
        console.log(`Found best match for ${bestMatch.artist?.name} at ${bestMatch.venue?.name} on ${bestMatch.eventDate} (score: ${bestScore})`);
        const setlist = bestMatch;
        const songs: { title: string; setNumber: number; encore: boolean; album?: string; duration?: number }[] = [];

        // Extract songs (existing logic)
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
          console.log(`No songs found in setlist for ${args.artistName}`);
          return null;
        }

        // Update setlist
        await ctx.runMutation(internal.setlists.updateWithActualSetlist, {
          showId: args.showId,
          actualSetlist: songs,
          setlistfmId: setlist.id,
          setlistfmData: setlist,
        });
          
        console.log(`✅ Updated setlist for ${args.artistName} with ${songs.length} songs from setlist.fm (match score: ${bestScore})`);
        return setlist.id;

      } catch (error: unknown) {
        attempt++;
        lastError = error;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Attempt ${attempt}/${maxRetries} failed for ${args.artistName}: ${errorMessage}`);
        if (attempt < maxRetries) {
          const backoff = Math.min(5000, 1000 * Math.pow(2, attempt)); // Exponential backoff up to 5s
          console.log(`Waiting ${backoff}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, backoff));
        }
      }
    }

    if (attempt >= maxRetries) {
      console.error(`Failed after ${maxRetries} attempts for ${args.artistName}:`, lastError);
      return null;
    }

    return null; // Should not reach here, but for type safety
  },
});

export const checkCompletedShows = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("🔍 Checking for completed shows needing setlist import...");
    
    // Get shows that are past their date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    const upcomingShows = await ctx.runQuery(internal.shows.getUpcomingShows, {});
    const allShows = await ctx.runQuery(internal.shows.getAllInternal, {});
    
    let completedCount = 0;
    let setlistsSynced = 0;
    let queuedForImport = 0;
    
    // Process upcoming shows that have passed
    for (const show of upcomingShows) {
      if (show.date < todayStr) {
        // Mark show as completed
        await ctx.runMutation(internal.shows.markCompleted, {
          showId: show._id,
        });
        
        // Set import status to pending
        await ctx.runMutation(internal.shows.updateImportStatus, {
          showId: show._id,
          status: "pending",
        });
        
        completedCount++;
        queuedForImport++;
      }
    }
    
    // Also check for completed shows that don't have setlists yet
    const completedShows = allShows.filter(show => 
      show.status === "completed" && 
      (!show.importStatus || show.importStatus === "pending" || show.importStatus === "failed")
    );
    
    console.log(`Found ${completedShows.length} completed shows needing setlist import`);
    
    // Process up to 10 completed shows per run (to avoid timeout)
    for (const show of completedShows.slice(0, 10)) {
      try {
        // Ensure import status is set
        if (!show.importStatus) {
          await ctx.runMutation(internal.shows.updateImportStatus, {
            showId: show._id,
            status: "importing",
          });
        }
        
        // Try to sync actual setlist
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
              await ctx.runMutation(internal.shows.updateImportStatus, {
                showId: show._id,
                status: "completed",
              });
              console.log(`✅ Synced setlist for ${show.artist.name} at ${show.venue.name}`);
            } else {
              // No setlist found - mark as failed
              await ctx.runMutation(internal.shows.updateImportStatus, {
                showId: show._id,
                status: "failed",
              });
            }
          } catch (error) {
            console.error(`❌ Failed to sync setlist for ${show.artist.name}:`, error);
            await ctx.runMutation(internal.shows.updateImportStatus, {
              showId: show._id,
              status: "failed",
            });
          }
        }
        
        // Rate limiting to respect setlist.fm API (2 second delay)
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Error processing show ${show._id}:`, error);
      }
    }
    
    console.log(`✅ Completed shows check: ${completedCount} newly completed, ${setlistsSynced} setlists synced, ${queuedForImport} queued for import`);
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

// Scan for pending imports and trigger syncs
export const scanPendingImports = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("🔍 Scanning for pending Setlist.fm imports...");
    
    try {
      // Use runQuery to get all shows and filter
      const allShows = await ctx.runQuery(internal.shows.getAllInternal, {});
      const today = new Date().toISOString().split('T')[0];
      
      const pendingShows = allShows.filter(show =>
        show &&
        (show.importStatus === "pending" || show.importStatus === "failed") &&
        show.status === "completed" &&
        new Date(show.date) < new Date(today)
      );

      console.log(`Found ${pendingShows.length} pending/failed imports to process`);

      let successCount = 0;
      let errorCount = 0;

      for (const show of pendingShows) {
        try {
          // Update status to importing using runMutation
          await ctx.runMutation(internal.shows.updateImportStatus, {
            showId: show._id,
            status: "importing"
          });

          // Get artist and venue using runQuery
          const artist = await ctx.runQuery(internal.shows.getArtistByIdInternal, { id: show.artistId });
          const venue = await ctx.runQuery(internal.shows.getVenueByIdInternal, { id: show.venueId });

          if (artist && venue) {
            const setlistId = await ctx.runAction(internal.setlistfm.syncActualSetlist, {
              showId: show._id,
              artistName: artist.name,
              venueCity: venue.city,
              showDate: show.date,
            });

            if (setlistId) {
              await ctx.runMutation(internal.shows.updateImportStatus, {
                showId: show._id,
                status: "completed"
              });
              successCount++;
              console.log(`✅ Imported setlist for ${artist.name} (${show._id})`);
            } else {
              await ctx.runMutation(internal.shows.updateImportStatus, {
                showId: show._id,
                status: "failed"
              });
              errorCount++;
            }
          } else {
            await ctx.runMutation(internal.shows.updateImportStatus, {
              showId: show._id,
              status: "failed"
            });
            errorCount++;
          }

          // Rate limit
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`Failed to import for show ${show._id}:`, error);
          await ctx.runMutation(internal.shows.updateImportStatus, {
            showId: show._id,
            status: "failed"
          });
          errorCount++;
        }
      }

      console.log(`Import scan complete: ${successCount} successful, ${errorCount} errors`);
    } catch (error) {
      console.error("❌ Pending imports scan failed:", error);
    }

    return null;
  },
});
