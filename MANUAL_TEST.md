# 🧪 MANUAL TEST PROTOCOL - Treaty Oak Revival

## Step-by-Step Test Instructions:

### **1. Open App**
- Navigate to: http://localhost:5173
- Verify app loads without errors
- Check browser console for any errors

### **2. Search for Artist**
- Click in search bar
- Type: "treaty oak revival"
- Verify search results appear
- Click on "Treaty Oak Revival" result

### **3. Verify Artist Creation**
- Check browser console for: "🚀 Starting full sync for artist: Treaty Oak Revival"
- Check browser console for: "✅ Artist Treaty Oak Revival created with ID: [ID]"
- Verify you're redirected to artist page

### **4. Verify Shows Import**
- On artist page, check if upcoming shows appear
- Check browser console for: "📅 Found X shows for artist"
- Check browser console for: "✅ Synced X shows for artist"

### **5. Verify Song Catalog Import**
- Check browser console for: "✅ Catalog sync completed for Treaty Oak Revival: X songs imported"
- Wait for catalog import to complete (may take 30-60 seconds)

### **6. Test Show Page**
- Click on any upcoming show
- Verify show page loads with venue information
- Check if initial 5 songs appear in setlist

### **7. Test Song Dropdown**
- Verify dropdown shows "Choose a song to add..."
- Click dropdown - should show artist's song catalog
- Verify songs are filtered (no duplicates from setlist)

### **8. Test Adding Song**
- Select a song from dropdown
- Verify song appears in setlist immediately (no save button)
- Check browser console for successful addition

### **9. Test Voting**
- Click upvote button on any song
- Verify vote count increases immediately
- Check that vote count persists on page refresh

### **10. Verify Database (Convex Dashboard)**
- Open: https://dashboard.convex.dev
- Check `artists` table - should have Treaty Oak Revival
- Check `shows` table - should have their shows
- Check `venues` table - should have venue records
- Check `songs` table - should have their studio songs
- Check `setlists` table - should have setlist with added song
- Check `songVotes` table - should have vote record

## 🚨 **EXPECTED RESULTS:**
- ✅ Artist created in database
- ✅ Shows imported from Ticketmaster
- ✅ Venues created for each show
- ✅ Song catalog imported from Spotify (studio songs only)
- ✅ Initial 5 songs in setlist
- ✅ Song dropdown populated with full catalog
- ✅ Song addition works instantly
- ✅ Voting works with real-time updates
- ✅ All data persists in Convex database

### **11. Verify Official Setlist Import**
- Run the completed shows check from the admin tools or `npx convex run setlistfm:triggerCompletedShowsCheck`.
- Refresh the show page once the job finishes.
- Confirm the header changes to “Official Setlist” and the songs match the setlist.fm entry.
- Ensure the accuracy summary is populated and the fan-request table highlights which predicted songs were actually played.
