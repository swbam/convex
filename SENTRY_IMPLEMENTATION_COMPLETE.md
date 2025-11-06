# ✅ Sentry Implementation Complete

## Summary

Sentry error tracking and performance monitoring has been **fully implemented** for both frontend and backend operations in your setlists.live application.

## What Was Implemented

### 1. Frontend Error Tracking ✅
- **Location**: `src/main.tsx`, `src/App.tsx`, `src/components/ErrorBoundary.tsx`
- **Features**:
  - Automatic JavaScript error capture
  - Performance monitoring (page loads, route transitions)
  - Session replay (10% normal sessions, 100% error sessions)
  - User context tracking via Clerk authentication
  - Custom error boundary with branded UI
  - Source map upload for production debugging

### 2. Backend Error Tracking ✅ NEW!
- **Location**: `convex/errorTracking.ts`, `convex/admin/errorMonitoring.ts`
- **Features**:
  - Centralized error logging for all Convex operations
  - Database table (`errorLogs`) to store backend errors
  - Automatic forwarding of backend errors to Sentry
  - Error categorization by operation and severity

### 3. Monitored Operations

#### Artist & Catalog Import Errors
- **File**: `convex/spotify.ts`
- **Operations Tracked**:
  - `spotify_catalog_sync` - Full catalog sync failures
  - `spotify_song_import` - Individual song import failures
  - `spotify_auto_setlist_generation` - Auto-setlist creation errors
  
#### Show & Venue Import Errors  
- **File**: `convex/setlistfm.ts`
- **Operations Tracked**:
  - `setlistfm_import` - Setlist.fm API failures and import errors

#### Setlist Operations
- **File**: `convex/setlists.ts`
- **Operations Tracked**:
  - `add_song_to_setlist` - Song addition failures
  - User-submitted setlist errors

#### Voting Errors
- **File**: `convex/songVotes.ts`
- **Operations Tracked**:
  - `song_vote` - Vote submission failures
  - Anonymous vs authenticated voting issues

### 4. Error Monitoring UI

#### Backend Error Monitor
- **Component**: `src/components/BackendErrorMonitor.tsx`
- **Function**: Automatically polls for backend errors and sends them to Sentry
- **Integration**: Runs silently in background of App component

#### Admin Dashboard Integration
- **File**: `src/components/AdminDashboard.tsx`
- **Features**:
  - Sentry test buttons for verification
  - "Send Test to Sentry" - Captures test error
  - "Break the world" - Throws test error
  
#### Error Statistics (Future)
- **File**: `convex/admin/errorMonitoring.ts`
- **Available Queries**:
  - `getRecentErrors` - View recent backend errors
  - `getErrorStats` - Error statistics and trends
  - `markResolved` - Mark errors as resolved

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Browser)                        │
├─────────────────────────────────────────────────────────────┤
│  • JavaScript errors          → Sentry (direct)             │
│  • Performance traces         → Sentry (direct)             │
│  • Session replays            → Sentry (direct)             │
│  • User context (from Clerk)  → Sentry (direct)             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                Backend (Convex Functions)                    │
├─────────────────────────────────────────────────────────────┤
│  • Spotify catalog errors     → errorLogs table             │
│  • Setlist.fm import errors   → errorLogs table             │
│  • Voting errors              → errorLogs table             │
│  • Setlist creation errors    → errorLogs table             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              BackendErrorMonitor Component                   │
├─────────────────────────────────────────────────────────────┤
│  • Polls errorLogs table every 30s                          │
│  • Sends unsent errors to Sentry                            │
│  • Marks errors as sent                                     │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    Sentry Dashboard                          │
├─────────────────────────────────────────────────────────────┤
│  • All errors in one place                                  │
│  • Tagged by source (frontend vs backend)                   │
│  • Categorized by operation                                 │
│  • Linked to user context                                   │
└─────────────────────────────────────────────────────────────┘
```

## Error Categories

### Critical Errors (severity: "error")
- Spotify catalog sync complete failures
- Setlist.fm import failures
- Database operation failures
- Authentication errors

### Warnings (severity: "warning")
- Individual song import failures
- Partial sync failures
- Voting validation errors
- Auto-setlist generation issues

### Info (severity: "info")
- Successful operations with notes
- Rate limit notifications
- Cache misses

## Testing Sentry

### Frontend Testing
1. Navigate to `/admin` (requires admin access)
2. Click "Send Test to Sentry" - sends captured error
3. Click "Break the world" - throws actual error
4. Check Sentry dashboard for events

### Backend Testing
1. Trigger any monitored operation (e.g., import artist catalog)
2. If error occurs, it's logged to `errorLogs` table
3. BackendErrorMonitor sends it to Sentry within 30 seconds
4. Check Sentry dashboard under "backend-error" tag

### Manual Error Check
```javascript
// In browser console
Sentry.captureMessage("Test from console");

// In Convex function (via dashboard)
npx convex run errorTracking:logError '{
  "operation": "test_error",
  "error": "This is a test error",
  "severity": "info"
}'
```

## Database Schema

### errorLogs Table
```typescript
{
  operation: string,           // e.g., "spotify_catalog_sync"
  error: string,               // Error message
  context: {
    artistId?: Id<"artists">,
    showId?: Id<"shows">,
    setlistId?: Id<"setlists">,
    userId?: Id<"users">,
    artistName?: string,
    showDate?: string,
    additionalData?: any,
  },
  severity: "error" | "warning" | "info",
  timestamp: number,
  resolved: boolean,
  sentToSentry?: boolean,
}
```

### Indexes
- `by_operation` - Query errors by operation type
- `by_severity` - Query by severity level
- `by_timestamp` - Query by time
- `by_resolved` - Filter resolved/unresolved
- `by_sentry_status` - Find unsent errors

## Configuration

### Environment Variables
```bash
# Frontend Sentry (already configured in src/main.tsx)
DSN=https://7a0b4270ce0837a16efc62a1f9e7493b@o4509554346754048.ingest.us.sentry.io/4510320697081856

# Source map upload (for production builds)
SENTRY_ORG=your_org
SENTRY_PROJECT=your_project
SENTRY_AUTH_TOKEN=your_token
```

### Sample Rates
| Feature | Development | Production |
|---------|-------------|------------|
| Frontend Errors | 100% | 100% |
| Performance Traces | 100% | 10% |
| Session Replays | 100% | 10% |
| Error Replays | 100% | 100% |
| Backend Errors | 100% | 100% |

## Key Files Modified

### Backend Files
- `convex/schema.ts` - Added errorLogs table
- `convex/errorTracking.ts` - Error logging functions (NEW)
- `convex/admin/errorMonitoring.ts` - Admin error queries (NEW)
- `convex/spotify.ts` - Added error tracking
- `convex/setlistfm.ts` - Added error tracking  
- `convex/setlists.ts` - Added error tracking
- `convex/songVotes.ts` - Added error tracking

### Frontend Files
- `src/components/BackendErrorMonitor.tsx` - Error forwarding (NEW)
- `src/components/SentryTestButton.tsx` - Test buttons (NEW)
- `src/components/AdminDashboard.tsx` - Added test buttons
- `src/App.tsx` - Added BackendErrorMonitor
- `src/main.tsx` - Sentry initialization
- `src/components/ErrorBoundary.tsx` - Sentry integration

## Next Steps

1. **Deploy the changes**:
   ```bash
   npm run build
   npm run deploy:backend
   npm run deploy:frontend
   ```

2. **Test in production**:
   - Trigger an artist import
   - Add a song to setlist
   - Vote on a song
   - Check Sentry for any errors

3. **Monitor the dashboard**:
   - Review error patterns
   - Set up alerts for critical errors
   - Track error resolution

4. **Optional enhancements**:
   - Add error notification UI in admin dashboard
   - Create error reporting widget for users
   - Implement automatic retry logic based on error type
   - Add error trending analysis

## Benefits

✅ **Complete Visibility**: See all errors (frontend + backend) in one place
✅ **Context Rich**: Every error includes user, operation, and relevant data
✅ **Proactive Monitoring**: Know about errors before users report them
✅ **Debugging Power**: Source maps + session replay = easy debugging
✅ **Performance Insights**: Track slow operations and optimize
✅ **User Impact**: See which users are affected by errors

## Support

- Frontend Errors: Check `src/main.tsx` configuration
- Backend Errors: Check `convex/errorTracking.ts`
- Error Monitor: Check `src/components/BackendErrorMonitor.tsx`
- Sentry Dashboard: https://sentry.io/organizations/[your-org]/issues/

---

**Implementation Status**: ✅ COMPLETE  
**Last Updated**: November 6, 2025  
**Ready for Production**: YES
