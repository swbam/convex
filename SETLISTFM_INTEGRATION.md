# Setlist.fm API Integration

This document describes the complete Setlist.fm API integration for fetching actual setlist data after shows.

## Overview

The Setlist.fm integration allows the application to:
- Fetch actual setlists from Setlist.fm after shows have occurred
- Automatically check for completed shows and sync their setlists
- Create official setlists in the database with proper attribution
- Score predicted setlists against actual setlists for gamification

## Setup Instructions

### 1. Get Setlist.fm API Key

1. Visit [Setlist.fm API Documentation](https://api.setlist.fm/docs/1.0/index.html)
2. Register for an API account
3. Generate your API key

### 2. Configure Environment Variables

#### Local Development (.env.local)
```env
# Add to your .env.local file
SETLISTFM_API_KEY=your_setlistfm_api_key_here
```

#### Production (Convex Dashboard)
1. Go to your [Convex Dashboard](https://dashboard.convex.dev)
2. Navigate to your project
3. Go to Settings > Environment Variables
4. Add: `SETLISTFM_API_KEY` with your API key value

### 3. Deploy Functions

```bash
# Deploy to production
npx convex deploy --prod

# Or for development
npx convex dev
```

## API Functions

### Public Actions

#### `triggerSetlistSync`
Manually trigger setlist synchronization for a specific show.

```typescript
const result = await api.setlistfm.triggerSetlistSync({
  showId: "show_id_here",
  artistName: "Artist Name",
  venueCity: "City Name",
  showDate: "2024-01-15"
});
```

**Returns:** `string | null` - The created setlist ID or null if no setlist found

#### `triggerCompletedShowsCheck`
Check all shows and automatically sync setlists for completed ones.

```typescript
const result = await api.setlistfm.triggerCompletedShowsCheck({});
```

**Returns:** `{ success: boolean; message: string }`

### Internal Actions

#### `syncActualSetlist`
Internal function that handles the actual API call to Setlist.fm and creates the official setlist.

#### `checkCompletedShows`
Internal function that identifies past shows and triggers setlist sync for each.

## Database Schema

### Setlists Table
```typescript
setlists: {
  showId: Id<"shows">,
  userId?: Id<"users">,
  songs: string[],
  isOfficial: boolean,
  confidence?: number,
  upvotes?: number,
  downvotes?: number,
  setlistfmId?: string, // Reference to original Setlist.fm entry
}
```

## Testing

### Test Page
A dedicated test page is available at `/setlist-test` (when running locally) that allows you to:

1. **View Recent Shows** - See a list of recent shows in the database
2. **Sync Individual Setlists** - Click "Sync Setlist" on any show to fetch its actual setlist
3. **Check Completed Shows** - Run the batch process to check all past shows
4. **View Results** - See fetched setlists with official attribution

### Manual Testing

```bash
# Start development server
npm run dev

# Navigate to test page
open http://localhost:5174/setlist-test
```

## API Rate Limits

Setlist.fm has minimal rate limiting compared to other APIs:
- Generally allows reasonable request volumes
- No specific rate limit documented
- Recommended to implement reasonable delays between requests

## Error Handling

The integration includes comprehensive error handling:

1. **Missing API Key** - Logs warning and returns null
2. **API Errors** - Logs HTTP status and returns null
3. **No Setlist Found** - Logs info message and returns null
4. **Parsing Errors** - Handled gracefully with fallbacks

## Data Flow

1. **Show Completion Detection**
   - Cron job or manual trigger identifies past shows
   - Shows with status "completed" are processed

2. **Setlist.fm API Call**
   - Search by artist name, city, and date
   - Parse response for matching setlists
   - Extract song list from setlist data

3. **Database Storage**
   - Create official setlist entry
   - Link to original show
   - Mark as `isOfficial: true`
   - Store Setlist.fm ID for reference

4. **Scoring & Gamification**
   - Compare user predictions against official setlist
   - Calculate accuracy scores
   - Update user statistics

## Troubleshooting

### Common Issues

1. **"Setlist.fm API key not configured"**
   - Ensure `SETLISTFM_API_KEY` is set in environment variables
   - Check Convex dashboard for production deployments

2. **"No setlist found"**
   - Setlist.fm may not have data for that specific show
   - Try different search parameters (artist name variations)
   - Check if the show actually occurred

3. **API Errors**
   - Verify API key is valid and active
   - Check Setlist.fm service status
   - Review request format and parameters

### Debug Logging

The integration includes detailed console logging:
- API key configuration status
- Request URLs and parameters
- Response status codes
- Parsing results
- Database operations

## Integration Status

✅ **Completed Features:**
- Core API integration with Setlist.fm
- Public action endpoints for external use
- Comprehensive error handling
- Test page for manual verification
- Environment variable configuration
- Database schema and mutations
- Automatic show completion detection

🔄 **Future Enhancements:**
- Automated cron job scheduling
- Batch processing optimizations
- Advanced setlist matching algorithms
- User verification system for setlist accuracy
- Integration with scoring and gamification systems

## Related Files

- `convex/setlistfm.ts` - Main integration logic
- `convex/setlists.ts` - Database operations and queries
- `src/pages/SetlistTest.tsx` - Test interface
- `convex/schema.ts` - Database schema definitions
- `CONVEX.md` - Overall system architecture
- `PRD.md` - Product requirements and specifications