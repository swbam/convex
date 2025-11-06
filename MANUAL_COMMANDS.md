# Manual Commands for Setlist Management

## 🎯 **Quick Commands You Can Run**

### 1. Import Actual Setlists from Setlist.fm
```bash
npm run import:setlists
```
**What it does:**
- Finds all completed shows (past dates)
- Calls setlist.fm API for each one
- Imports actual setlists when available
- Updates show pages with real setlists

**When to use:** After major concerts happen (give it 24-48 hours for fans to upload)

---

### 2. Import Actual Setlists (Verbose)
```bash
npm run import:past-setlists
```
**What it does:**
- Same as above but with more detailed logging
- Also syncs trending data
- Shows progress messages

**When to use:** When you want to see exactly what's happening

---

### 3. Generate Predicted Setlists (5 Random Songs)
```bash
npm run seed:setlists
```
**What it does:**
- Finds all shows without predicted setlists
- Generates 5 random songs for each
- Enables voting immediately

**When to use:** 
- After importing new artists
- After creating new shows
- To populate empty shows

---

### 4. Sync Trending Data
```bash
npm run sync:trending
```
**What it does:**
- Updates trending artist rankings
- Updates trending show rankings
- Refreshes homepage marquees

**When to use:** To refresh homepage data

---

### 5. Full Catalog Import (All Artists)
```bash
npx convex run bulkCatalogSync:syncAllMissingCatalogs '{"limit":50}'
```
**What it does:**
- Finds artists with no songs
- Imports their full Spotify catalog
- Filters out live/remix versions
- Typically 100-300 songs per artist

**When to use:**
- After adding new trending artists
- When shows have 0 songs available

---

## 📋 **Complete Workflow for New Shows**

### Scenario: You just imported a new artist from search

```bash
# Step 1: Import artist's song catalog
npx convex run bulkCatalogSync:syncAllMissingCatalogs '{"limit":10}'

# Step 2: Generate predicted setlists for their shows
npm run seed:setlists

# Step 3: Refresh trending data
npm run sync:trending

# Done! Shows now have:
# ✅ Predicted setlists (5 songs)
# ✅ Full song catalog in dropdown
# ✅ Ready for voting
```

---

## 🎸 **For Past Concerts (Import Actual Setlists)**

### Scenario: A major concert just happened

```bash
# Wait 24-48 hours after concert for fans to upload to setlist.fm

# Then run:
npm run import:setlists

# Or for more detail:
npm run import:past-setlists

# Check results:
# ✅ Actual setlist imported
# ✅ Comparison shows accuracy
# ✅ Users can see what was really played
```

---

## 🔍 **Debugging Commands**

### Check if artist has songs:
```bash
npx convex run songs:getByArtist '{"artistId":"ARTIST_ID","limit":5}'
```

### Check if show has setlist:
```bash
npx convex run setlists:getByShow '{"showId":"SHOW_ID"}'
```

### Get artist ID by name:
```bash
npx convex run artists:getByName '{"name":"Billie Eilish"}'
```

### Get show ID by slug:
```bash
npx convex run shows:getBySlug '{"slug":"billie-eilish-smoothie-king-center-new-orleans-2025-11-08-19-00"}'
```

### Manually import catalog for specific artist:
```bash
npx convex run spotify:syncArtistCatalog '{"artistId":"ARTIST_ID","artistName":"Artist Name"}'
```

### Manually generate setlist for specific show:
```bash
npx convex run setlists:autoGenerateSetlist '{"showId":"SHOW_ID","artistId":"ARTIST_ID"}'
```

---

## 📊 **What The Cron Jobs Do Automatically**

You don't need to run these manually - they run automatically:

| Cron Job | Frequency | What It Does |
|----------|-----------|--------------|
| check-completed-shows | Every 2 hours | Imports actual setlists from setlist.fm |
| setlistfm-scan | Every 30 minutes | Retries failed setlist imports |
| refresh-auto-setlists | Every 6 hours | Generates predicted setlists for new shows |
| update-trending | Every 4 hours | Updates trending artists/shows |
| auto-transition-shows | Every 2 hours | Marks past shows as "completed" |

---

## ✅ **Best Practices**

### After deploying new code:
```bash
npm run all
```

### After importing new artists:
```bash
npm run seed:setlists && npm run sync:trending
```

### After a major concert:
```bash
# Wait 24-48 hours, then:
npm run import:setlists
```

### Weekly maintenance:
```bash
npm run import:past-setlists
# This catches any shows that were missed
```

---

## 🎯 **Current Production Commands**

```json
{
  "import:setlists": "Import actual setlists from setlist.fm",
  "import:past-setlists": "Import with verbose logging",
  "seed:setlists": "Generate 5-song predicted setlists",
  "sync:trending": "Update trending rankings",
  "all": "Full deployment (backend + frontend + trending)"
}
```

---

## 💡 **Quick Reference**

**Just ran a new deployment?**
```bash
npm run all
```

**New artist added?**
```bash
npm run seed:setlists
```

**Major concert yesterday?**
```bash
npm run import:setlists
```

**Everything seems empty?**
```bash
# Import catalogs
npx convex run bulkCatalogSync:syncAllMissingCatalogs '{"limit":50}'
# Generate setlists
npm run seed:setlists
# Sync trending
npm run sync:trending
```

Done! 🎉

