# Spotify Integration Summary

## Overview
I've implemented a genius Spotify authentication integration that seamlessly imports and displays the user's Spotify artists with upcoming concerts.

## Key Features

### 1. **Automatic Import on First Login**
- When a user signs in with Spotify for the first time, their artists are automatically imported
- Combines both followed artists and top listened artists
- Deduplicates and prioritizes based on listening habits

### 2. **Smart Artist Correlation**
- Checks if Spotify artists already exist in the database by Spotify ID
- Falls back to name matching for artists without Spotify IDs
- Updates existing artists with Spotify metadata (followers, popularity)
- Creates new artists only when necessary

### 3. **Background Show Import**
- After importing an artist, automatically searches Ticketmaster for their shows
- Runs Spotify catalog sync to get all their songs
- All happens in the background while the UI remains responsive

### 4. **My Artists Tab in Profile**
- Only visible for users who logged in with Spotify
- Shows artists with upcoming concerts
- Displays "Top X" badge for user's most listened artists
- Shows followed status and upcoming show count
- Refresh button to re-import latest data

## Technical Implementation

### Database Schema
- Added `userSpotifyArtists` table to track user-artist relationships
- Stores whether artist is followed, top artist, and ranking
- Indexed for fast queries by user

### Convex Functions
1. **spotifyAuth.ts**
   - `importUserSpotifyArtistsWithToken` - Main import action
   - `trackUserArtist` - Internal mutation to track relationships
   - `getUserSpotifyArtists` - Query for My Artists tab

2. **Updated Functions**
   - `auth.createAppUser` - Extracts Spotify ID on user creation
   - `ticketmaster.searchAndSyncArtistShows` - Finds shows for Spotify artists

### Frontend Hooks
1. **useSpotifyAuth** - Manages Spotify authentication state
2. **useSpotifyData** - Handles Spotify API calls with Clerk tokens

### UI Components
- Enhanced UserProfilePage with My Artists tab
- Reuses existing ArtistCard component
- Loading states and empty states
- Responsive design

## User Flow

1. User clicks "Sign in with Spotify" (configured in Clerk)
2. After OAuth flow, user is created with Spotify ID
3. Background import starts automatically
4. User sees "Importing your Spotify artists..." toast
5. Artists appear in My Artists tab as they're imported
6. Clicking an artist navigates to their page with shows

## Priority System

Artists are imported in this order:
1. Top artists (by rank 1-50)
2. Followed artists (by popularity)
3. Background syncs for shows and catalogs

This ensures the user's favorite artists appear immediately.

## Security

- Spotify access tokens are managed by Clerk
- Token is fetched on-demand from frontend
- No tokens stored in database
- All API calls authenticated through Convex

## Performance

- Imports happen in parallel where possible
- Background jobs for heavy operations
- Efficient deduplication
- Only shows artists with upcoming concerts

## Future Enhancements

1. Show recently played artists
2. Concert recommendations based on listening habits  
3. Notifications when favorite artists announce shows
4. Spotify playlist creation from setlists