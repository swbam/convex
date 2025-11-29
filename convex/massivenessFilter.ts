// Utility to classify and score artists/shows for "massive" trending curation
// Used by maintenance sync to filter out small/niche acts from homepage

export function isMassiveArtist(args: {
  artistName?: string;
  artistPopularity?: number;
  artistFollowers?: number;
  upcomingEvents?: number;
  genres?: string[];
}): boolean {
  const name = (args.artistName || '').toLowerCase();
  
  // Auto-reject patterns (theatrical, tribute, non-concerts, plays, musicals)
  const rejectPatterns = [
    // Theatrical/Stage productions
    'tribute', 'experience', 'orchestra', 'symphony', 'chamber', 
    'ballet', 'opera', 'broadway', 'musical', 'playhouse',
    'cirque', 'comedy', 'film with', '- film', 'live in concert',
    // Plays and theater
    'play', 'theatre', 'theater', 'the play', 'stage production',
    'drama', 'pantomime', 'puppet', 'improv',
    // Film screenings
    'film score', 'movie score', 'cinema', 'screening',
    'live to film', 'in concert film', 'soundtrack live',
    // Holiday/Themed shows (often not real concerts)
    'holiday inn', 'christmas carol', 'nutcracker', 'swan lake',
    // Non-music entertainment
    'magic show', 'illusionist', 'hypnotist', 'speaker', 'lecture',
    'podcast', 'wrestling', 'ufc', 'boxing', 'esports',
    // Orchestra/Classical performances of pop music
    'performed by orchestra', 'symphonic tribute', 'classical rendition'
  ];
  if (rejectPatterns.some(p => name.includes(p))) return false;
  
  // Reject non-concert genres (plays, musicals, classical, theater)
  const genres = (args.genres || []).map(g => g.toLowerCase());
  const nonConcertGenres = [
    'chamber music', 'opera', 'classical', 'medieval',
    'broadway', 'musical theater', 'musical theatre', 'theater', 'theatre',
    'soundtrack', 'film score', 'children\'s music', 'kids',
    'comedy', 'spoken word', 'audiobook', 'podcast'
  ];
  if (genres.some(g => nonConcertGenres.some(ng => g.includes(ng)))) return false;
  
  // Minimum thresholds for "massive"
  const popularity = args.artistPopularity ?? 0;
  const followers = args.artistFollowers ?? 0;
  const upcoming = args.upcomingEvents ?? 0;
  
  // Gate: Must have minimum reach
  // Tier 1 (Superstar): 70+ popularity OR 5M+ followers
  // Tier 2 (Major): 60+ popularity AND 1M+ followers
  // Tier 3 (Mid-major): 55+ popularity AND 500k+ followers
  
  if (popularity >= 70 || followers >= 5_000_000) return true;
  if (popularity >= 60 && followers >= 1_000_000) return true;
  if (popularity >= 55 && followers >= 500_000 && upcoming >= 3) return true;
  
  return false;
}

export function isMassiveShow(args: {
  artistName?: string;
  venueName?: string;
  artistPopularity?: number;
  artistFollowers?: number;
  venueCapacity?: number;
  hasImage?: boolean;
  status?: string;
}): boolean {
  const okStatus = args.status === 'upcoming';
  const okName = !!args.artistName && !args.artistName.toLowerCase().includes('unknown');
  const okImg = !!args.hasImage;
  
  if (!okStatus || !okName || !okImg) return false;
  
  // Venue check: prefer major venues
  const venueName = (args.venueName || '').toLowerCase();
  const majorVenues = ['arena', 'stadium', 'center', 'amphitheatre', 'amphitheater', 'sphere', 'bowl', 'pavilion', 'garden', 'coliseum', 'forum'];
  const isMajorVenue = majorVenues.some(k => venueName.includes(k)) || (args.venueCapacity && args.venueCapacity >= 8000);
  
  if (!isMajorVenue) return false;
  
  // Artist must meet massive criteria
  return isMassiveArtist({
    artistName: args.artistName,
    artistPopularity: args.artistPopularity,
    artistFollowers: args.artistFollowers,
  });
}

export function computeMassivenessScore(args: {
  artistFollowers?: number;
  artistPopularity?: number;
  upcomingEvents?: number;
  venueCapacity?: number;
}): number {
  const followers = Math.log10(Math.max(1, args.artistFollowers ?? 1)); // 0..8 scale
  const popularity = Math.max(0, (args.artistPopularity ?? 0) / 100); // 0..1
  const upcoming = Math.min(1, (args.upcomingEvents ?? 0) / 20); // cap at 20
  const capacity = args.venueCapacity ?? 0;
  
  let venueWeight = 0.2;
  if (capacity >= 30000) venueWeight = 1.0;
  else if (capacity >= 15000) venueWeight = 0.8;
  else if (capacity >= 8000) venueWeight = 0.6;
  
  // Weighted combination (emphasize followers and popularity)
  return (followers * 0.40) + (popularity * 0.35) + (venueWeight * 0.20) + (upcoming * 0.05);
}

