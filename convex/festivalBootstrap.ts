"use node";

import { internalAction, action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import * as cheerio from "cheerio";

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internalRef = internal as any;

// ============================================================================
// TOP US MUSIC FESTIVALS - Hardcoded list with Wikipedia URLs
// ============================================================================

interface FestivalSource {
  name: string;
  slug: string;
  wikiUrl: string;
  location: string;
  typicalMonth: string; // For date estimation
  genres: string[];
}

const MAJOR_US_FESTIVALS: FestivalSource[] = [
  {
    name: "Coachella",
    slug: "coachella",
    wikiUrl: "https://en.wikipedia.org/wiki/Coachella_Valley_Music_and_Arts_Festival",
    location: "Indio, CA",
    typicalMonth: "April",
    genres: ["Rock", "Pop", "Electronic", "Hip-Hop"],
  },
  {
    name: "Bonnaroo",
    slug: "bonnaroo",
    wikiUrl: "https://en.wikipedia.org/wiki/Bonnaroo_Music_Festival",
    location: "Manchester, TN",
    typicalMonth: "June",
    genres: ["Rock", "Indie", "Electronic", "Hip-Hop"],
  },
  {
    name: "Lollapalooza",
    slug: "lollapalooza",
    wikiUrl: "https://en.wikipedia.org/wiki/Lollapalooza",
    location: "Chicago, IL",
    typicalMonth: "August",
    genres: ["Alternative", "Rock", "Hip-Hop", "Electronic"],
  },
  {
    name: "Austin City Limits",
    slug: "acl-fest",
    wikiUrl: "https://en.wikipedia.org/wiki/Austin_City_Limits_Music_Festival",
    location: "Austin, TX",
    typicalMonth: "October",
    genres: ["Rock", "Country", "Folk", "Electronic"],
  },
  {
    name: "Outside Lands",
    slug: "outside-lands",
    wikiUrl: "https://en.wikipedia.org/wiki/Outside_Lands_Music_and_Arts_Festival",
    location: "San Francisco, CA",
    typicalMonth: "August",
    genres: ["Rock", "Electronic", "Hip-Hop", "Indie"],
  },
  {
    name: "Electric Daisy Carnival",
    slug: "edc-las-vegas",
    wikiUrl: "https://en.wikipedia.org/wiki/Electric_Daisy_Carnival",
    location: "Las Vegas, NV",
    typicalMonth: "May",
    genres: ["EDM", "House", "Techno", "Trance"],
  },
  {
    name: "Ultra Music Festival",
    slug: "ultra-miami",
    wikiUrl: "https://en.wikipedia.org/wiki/Ultra_Music_Festival",
    location: "Miami, FL",
    typicalMonth: "March",
    genres: ["EDM", "House", "Techno", "Trance"],
  },
  {
    name: "Governors Ball",
    slug: "governors-ball",
    wikiUrl: "https://en.wikipedia.org/wiki/Governors_Ball_Music_Festival",
    location: "New York, NY",
    typicalMonth: "June",
    genres: ["Rock", "Hip-Hop", "Electronic", "Pop"],
  },
  {
    name: "Pitchfork Music Festival",
    slug: "pitchfork-fest",
    wikiUrl: "https://en.wikipedia.org/wiki/Pitchfork_Music_Festival",
    location: "Chicago, IL",
    typicalMonth: "July",
    genres: ["Indie", "Alternative", "Experimental"],
  },
  {
    name: "Firefly Music Festival",
    slug: "firefly",
    wikiUrl: "https://en.wikipedia.org/wiki/Firefly_Music_Festival",
    location: "Dover, DE",
    typicalMonth: "June",
    genres: ["Rock", "Pop", "Hip-Hop", "Electronic"],
  },
  {
    name: "Life Is Beautiful",
    slug: "life-is-beautiful",
    wikiUrl: "https://en.wikipedia.org/wiki/Life_Is_Beautiful_(festival)",
    location: "Las Vegas, NV",
    typicalMonth: "September",
    genres: ["Rock", "Hip-Hop", "Electronic", "Pop"],
  },
  {
    name: "Rolling Loud Miami",
    slug: "rolling-loud-miami",
    wikiUrl: "https://en.wikipedia.org/wiki/Rolling_Loud",
    location: "Miami, FL",
    typicalMonth: "July",
    genres: ["Hip-Hop", "Rap", "Trap"],
  },
  {
    name: "Electric Forest",
    slug: "electric-forest",
    wikiUrl: "https://en.wikipedia.org/wiki/Electric_Forest_Festival",
    location: "Rothbury, MI",
    typicalMonth: "June",
    genres: ["EDM", "Jam Band", "Electronic"],
  },
  {
    name: "BottleRock Napa Valley",
    slug: "bottlerock",
    wikiUrl: "https://en.wikipedia.org/wiki/BottleRock_Napa_Valley",
    location: "Napa, CA",
    typicalMonth: "May",
    genres: ["Rock", "Pop", "Country", "Hip-Hop"],
  },
  {
    name: "Riot Fest",
    slug: "riot-fest",
    wikiUrl: "https://en.wikipedia.org/wiki/Riot_Fest",
    location: "Chicago, IL",
    typicalMonth: "September",
    genres: ["Punk", "Rock", "Alternative"],
  },
  {
    name: "Stagecoach",
    slug: "stagecoach",
    wikiUrl: "https://en.wikipedia.org/wiki/Stagecoach_Festival",
    location: "Indio, CA",
    typicalMonth: "April",
    genres: ["Country", "Americana", "Folk"],
  },
  {
    name: "Hangout Music Festival",
    slug: "hangout-fest",
    wikiUrl: "https://en.wikipedia.org/wiki/Hangout_Music_Festival",
    location: "Gulf Shores, AL",
    typicalMonth: "May",
    genres: ["Rock", "Pop", "Country", "Hip-Hop"],
  },
  {
    name: "When We Were Young",
    slug: "when-we-were-young",
    wikiUrl: "https://en.wikipedia.org/wiki/When_We_Were_Young_(music_festival)",
    location: "Las Vegas, NV",
    typicalMonth: "October",
    genres: ["Emo", "Pop-Punk", "Rock"],
  },
  {
    name: "Shaky Knees",
    slug: "shaky-knees",
    wikiUrl: "https://en.wikipedia.org/wiki/Shaky_Knees_Music_Festival",
    location: "Atlanta, GA",
    typicalMonth: "May",
    genres: ["Rock", "Indie", "Alternative"],
  },
  {
    name: "Summerfest",
    slug: "summerfest",
    wikiUrl: "https://en.wikipedia.org/wiki/Summerfest",
    location: "Milwaukee, WI",
    typicalMonth: "June",
    genres: ["Rock", "Pop", "Country", "Hip-Hop"],
  },
];

// ============================================================================
// SCRAPING FUNCTIONS
// ============================================================================

// Scrape lineup from a festival's Wikipedia page
export const scrapeFestivalLineup = internalAction({
  args: {
    wikiUrl: v.string(),
    year: v.number(),
    festivalName: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    artists: v.array(v.string()),
    dates: v.optional(v.object({
      start: v.string(),
      end: v.string(),
    })),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      console.log(`🔍 Scraping ${args.festivalName} ${args.year} from Wikipedia...`);
      
      const response = await fetch(args.wikiUrl, {
        headers: {
          "User-Agent": "SetlistsLive/1.0 (Educational Project; https://setlists.live)",
          "Accept": "text/html",
        },
      });
      
      if (!response.ok) {
        return {
          success: false,
          artists: [],
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      const artists: string[] = [];
      const yearStr = String(args.year);
      
      // Strategy 1: Find tables/sections with year in heading
      $("h2, h3, h4").each((_, heading) => {
        const headingText = $(heading).text();
        
        // Look for year-specific lineup sections
        if (headingText.includes(yearStr) && 
            (/lineup|artist|performer|headliner/i.test(headingText) || headingText.match(/^\d{4}$/))) {
          
          // Get content after heading until next heading
          let next = $(heading).nextAll().first();
          let iterations = 0;
          
          while (next.length && !next.is("h2, h3, h4") && iterations < 50) {
            // Extract from lists
            next.find("li").each((_, li) => {
              // Get the main link text (artist name)
              const link = $(li).find("a").first();
              const text = link.length ? link.text().trim() : $(li).text().split("[")[0].trim();
              
              if (isValidArtistName(text)) {
                artists.push(text);
              }
            });
            
            // Extract from tables
            next.find("td a").each((_, link) => {
              const text = $(link).text().trim();
              if (isValidArtistName(text)) {
                artists.push(text);
              }
            });
            
            next = next.next();
            iterations++;
          }
        }
      });
      
      // Strategy 2: If no year-specific section, look for "Lineups" or similar tables
      if (artists.length === 0) {
        $("table.wikitable").each((_, table) => {
          const tableHtml = $(table).html() || "";
          
          // Check if table contains year and artist-like content
          if (tableHtml.includes(yearStr)) {
            $(table).find("td a, th a").each((_, link) => {
              const text = $(link).text().trim();
              if (isValidArtistName(text)) {
                artists.push(text);
              }
            });
          }
        });
      }
      
      // Strategy 3: Look for inline lists with artist names
      if (artists.length === 0) {
        $("p, div").each((_, elem) => {
          const text = $(elem).text();
          if (text.includes(yearStr) && /headlin|lineup|perform/i.test(text)) {
            $(elem).find("a").each((_, link) => {
              const artistName = $(link).text().trim();
              if (isValidArtistName(artistName)) {
                artists.push(artistName);
              }
            });
          }
        });
      }
      
      // Dedupe and clean
      const uniqueArtists = [...new Set(artists)]
        .filter((name) => name.length > 0)
        .slice(0, 200); // Cap at 200 artists per festival
      
      console.log(`  Found ${uniqueArtists.length} artists`);
      
      return {
        success: uniqueArtists.length > 0,
        artists: uniqueArtists,
        error: uniqueArtists.length === 0 ? "No artists found for this year" : undefined,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error(`❌ Scrape failed for ${args.festivalName}: ${msg}`);
      return {
        success: false,
        artists: [],
        error: msg,
      };
    }
  },
});

// Helper: Check if a string looks like a valid artist name
function isValidArtistName(text: string): boolean {
  if (!text || text.length < 2 || text.length > 100) return false;
  
  // Reject common non-artist strings
  const rejectPatterns = [
    /^\d{4}$/, // Just a year
    /^(january|february|march|april|may|june|july|august|september|october|november|december)/i,
    /^day\s*\d/i,
    /^stage/i,
    /^weekend/i,
    /^\[.+\]$/, // Wikipedia references
    /^main stage|outdoor|tent|arena/i,
    /^edit|cite|reference|source/i,
    /festival|lineup|headliner|performer/i,
    /^the$|^a$|^an$/i,
    /^\d+:\d+/, // Times
    /^(pm|am)$/i,
  ];
  
  return !rejectPatterns.some((pattern) => pattern.test(text.trim()));
}

// ============================================================================
// BOOTSTRAP FUNCTION - Run once to populate festivals
// ============================================================================

export const bootstrapFestivals = internalAction({
  args: {
    year: v.optional(v.number()),
    festivalSlugs: v.optional(v.array(v.string())), // Optional: only bootstrap specific festivals
  },
  returns: v.object({
    festivalsCreated: v.number(),
    artistsLinked: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const year = args.year || new Date().getFullYear();
    const errors: string[] = [];
    let festivalsCreated = 0;
    let artistsLinked = 0;
    
    console.log(`\n🎪 FESTIVAL BOOTSTRAP - ${year}`);
    console.log("=".repeat(50));
    
    // Filter festivals if specific slugs provided
    const festivalsToProcess = args.festivalSlugs
      ? MAJOR_US_FESTIVALS.filter((f) => args.festivalSlugs!.includes(f.slug))
      : MAJOR_US_FESTIVALS;
    
    for (const source of festivalsToProcess) {
      console.log(`\n📥 Processing: ${source.name} ${year}`);
      
      try {
        // Create festival slug with year
        const slug = `${source.slug}-${year}`;
        
        // Estimate dates based on typical month
        const { startDate, endDate } = estimateFestivalDates(source.typicalMonth, year);
        
        // Step 1: Create/update festival record
        const festivalId = await ctx.runMutation(internalRef.festivals.upsertFestival, {
          name: `${source.name} ${year}`,
          slug,
          year,
          startDate,
          endDate,
          location: source.location,
          wikiUrl: source.wikiUrl,
          genres: source.genres,
        });
        
        festivalsCreated++;
        console.log(`  ✅ Festival record created/updated`);
        
        // Step 2: Scrape lineup from Wikipedia
        const lineup = await ctx.runAction(internalRef.festivalBootstrap.scrapeFestivalLineup, {
          wikiUrl: source.wikiUrl,
          year,
          festivalName: source.name,
        });
        
        if (!lineup.success || lineup.artists.length === 0) {
          console.log(`  ⚠️ No lineup found: ${lineup.error}`);
          errors.push(`${source.name}: ${lineup.error || "No artists found"}`);
          continue;
        }
        
        console.log(`  🎤 Found ${lineup.artists.length} artists`);
        
        // Step 3: Link artists to festival
        let linked = 0;
        for (const artistName of lineup.artists) {
          try {
            const showId = await ctx.runMutation(internalRef.festivals.addArtistByName, {
              festivalId,
              artistName,
              dayNumber: 1, // Default to day 1 since we don't have day info
            });
            
            if (showId) {
              linked++;
              artistsLinked++;
            }
          } catch (e) {
            // Artist not in database - skip silently
          }
        }
        
        console.log(`  ✅ Linked ${linked} artists to festival`);
        
        // Rate limit: 3 seconds between festivals to be nice to Wikipedia
        await new Promise((r) => setTimeout(r, 3000));
        
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        console.error(`  ❌ Error: ${msg}`);
        errors.push(`${source.name}: ${msg}`);
      }
    }
    
    console.log("\n" + "=".repeat(50));
    console.log(`🎉 BOOTSTRAP COMPLETE`);
    console.log(`   Festivals: ${festivalsCreated}`);
    console.log(`   Artists linked: ${artistsLinked}`);
    console.log(`   Errors: ${errors.length}`);
    
    return { festivalsCreated, artistsLinked, errors };
  },
});

// Helper: Estimate festival dates based on typical month
function estimateFestivalDates(month: string, year: number): { startDate: string; endDate: string } {
  const monthMap: Record<string, number> = {
    January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
    July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
  };
  
  const monthIndex = monthMap[month] ?? 0;
  
  // Assume festivals typically run Friday-Sunday in the middle of the month
  const startDate = new Date(year, monthIndex, 12); // Middle of month
  const endDate = new Date(year, monthIndex, 14); // 3-day festival
  
  // Adjust to nearest Friday
  const dayOfWeek = startDate.getDay();
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  startDate.setDate(startDate.getDate() + daysUntilFriday);
  endDate.setDate(startDate.getDate() + 2);
  
  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
}

// ============================================================================
// PUBLIC ACTION - Trigger bootstrap from admin dashboard
// ============================================================================

export const runBootstrap = action({
  args: {
    year: v.optional(v.number()),
    festivalSlugs: v.optional(v.array(v.string())),
  },
  returns: v.object({
    festivalsCreated: v.number(),
    artistsLinked: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    // TODO: Add admin check here
    return await ctx.runAction(internalRef.festivalBootstrap.bootstrapFestivals, {
      year: args.year,
      festivalSlugs: args.festivalSlugs,
    });
  },
});

// Get list of available festivals to bootstrap
export const getAvailableFestivals = action({
  args: {},
  returns: v.array(v.object({
    name: v.string(),
    slug: v.string(),
    location: v.string(),
    typicalMonth: v.string(),
    genres: v.array(v.string()),
  })),
  handler: async () => {
    return MAJOR_US_FESTIVALS.map((f) => ({
      name: f.name,
      slug: f.slug,
      location: f.location,
      typicalMonth: f.typicalMonth,
      genres: f.genres,
    }));
  },
});

