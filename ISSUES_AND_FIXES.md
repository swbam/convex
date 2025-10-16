# Concert Setlist Voting App - Issues and Fixes

## Current Status: December 2024

### ✅ FIXED ISSUES

1. **Admin Dashboard Loading Error** ✅
   - **Issue**: `getAdminStats` query was throwing server errors
   - **Root Cause**: Missing error handling for votes without `createdAt` field
   - **Fix Applied**: Added try-catch blocks and safe fallbacks in `convex/admin.ts`
   - **Status**: Deployed and fixed

2. **Tab Alignment Issues** ✅
   - **Issue**: Admin and User dashboard tabs had incorrect heights
   - **Fix Applied**: Added `h-auto` and `h-10` classes to tabs in `AdminDashboard.tsx`
   - **Status**: Deployed and fixed

### 🚨 CRITICAL ISSUES REMAINING

1. **Empty Trending Artists Section** ❌
   - **Issue**: Homepage shows "Trending Artists" header but no artist cards
   - **Root Cause**: Database has NO artists with trending rankings
   - **Evidence**: 
     - Shows exist in database (Billie Eilish, Beautiful Losers, Ghibli Melodies)
     - Trending sync runs successfully but has no artists to rank
     - Ticketmaster API returns 20 trending artists successfully
   - **Solution Needed**: Import trending artists from Ticketmaster into database
   - **Files to Check**:
     - `convex/trending.ts` - Trending query logic
     - `convex/ticketmaster.ts` - Import logic
     - `src/components/TrendingArtists.tsx` - Frontend component

2. **Admin Page Still Failing** ❌
   - **Issue**: Admin page shows error despite `getAdminStats` fix
   - **Root Cause**: User authentication - need to be signed in as admin
   - **Evidence**: Error shows "Not Authorized" in console
   - **Solution Needed**: 
     - Sign in to the app
     - Promote user to admin role
     - Test admin page again

### 📋 ACTION ITEMS

#### Priority 1: Populate Trending Artists
```bash
# Step 1: Check if artists exist
npx convex run artists:list

# Step 2: If empty, import from Ticketmaster
npx convex run admin:importTrendingFromTicketmaster

# Step 3: Verify artists were created
npx convex run artists:list

# Step 4: Update trending rankings
npx convex run admin:testSyncTrending
```

#### Priority 2: Fix Admin Access
```bash
# Step 1: Sign into the app at setlists.live
# Step 2: Check your email address
# Step 3: Promote yourself to admin
npx convex run admin:promoteUserByEmail '{"email": "YOUR_EMAIL@example.com"}'

# Step 4: Refresh admin page and test
```

#### Priority 3: Verify All Components
- [ ] Homepage trending artists section shows 10-20 artists
- [ ] Admin dashboard loads without errors
- [ ] Admin stats show correct counts
- [ ] User dashboard loads correctly
- [ ] Activity page works
- [ ] Authentication flow works end-to-end

### 🔍 DIAGNOSTIC COMMANDS

```bash
# Check database status
npx convex run admin:getSystemHealth

# List all artists
npx convex run trending:getTrendingArtists '{}'

# List all shows
npx convex run shows:getUpcoming '{}'

# Check Ticketmaster API
npx convex run ticketmaster:getTrendingArtists '{" limit": 20}'

# Test trending sync
npx convex run admin:testSyncTrending
```

### 📊 DATABASE STATUS

**Current State:**
- ✅ Shows table: HAS DATA (Billie Eilish, Beautiful Losers, Ghibli Melodies)
- ❌ Artists table: EMPTY or NO TRENDING RANKS
- ❌ Trending Artists Query: Returns empty array
- ✅ Ticketmaster API: Working (returns 20 artists)
- ✅ Convex Backend: Deployed and running

**Expected State:**
- ✅ Shows table: 50-100 upcoming shows
- ✅ Artists table: 20-50 artists with images and trending scores
- ✅ Trending Artists Query: Returns 10-20 artists sorted by rank
- ✅ Admin page: Loads and shows stats
- ✅ Homepage: Shows trending artists with images

### 🎯 NEXT STEPS

1. **Import Trending Artists** (5 minutes)
   - Run `importTrendingFromTicketmaster` action
   - This will create 20+ artists with Ticketmaster data
   - Automatically updates trending rankings

2. **Verify Data Populated** (2 minutes)
   - Check homepage at setlists.live
   - Trending artists section should now show artist cards
   - Each card should have name, image, and genres

3. **Test Admin Dashboard** (3 minutes)
   - Sign in to app
   - Promote user to admin
   - Navigate to /admin
   - Should load without errors

4. **Test Full User Flow** (5 minutes)
   - Sign up new user
   - Browse artists and shows
   - Create a setlist prediction
   - Vote on setlists
   - Check activity feed

### 🐛 KNOWN ISSUES TO MONITOR

1. **User Dashboard Routing**
   - After sign-in, check if redirect works correctly
   - Spotify OAuth vs Email sign-in routes may differ
   - Both should redirect to appropriate dashboard

2. **Activity Page Sign-In Button**
   - After authentication, "Sign In" button may still show
   - Need to verify auth state propagation
   - Check if clicking Activity link maintains auth state

3. **Database Performance**
   - Monitor query performance as data grows
   - Trending rankings update every 4 hours via cron
   - May need optimization for large datasets
