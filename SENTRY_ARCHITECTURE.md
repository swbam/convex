# Sentry Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         setlists.live Application                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        src/main.tsx                              │   │
│  │  ┌────────────────────────────────────────────────────────┐     │   │
│  │  │  Sentry.init({                                         │     │   │
│  │  │    dsn: "https://...",                                 │     │   │
│  │  │    integrations: [                                     │     │   │
│  │  │      browserTracingIntegration(),  ← Performance       │     │   │
│  │  │      replayIntegration(),         ← Session Replay     │     │   │
│  │  │    ],                                                  │     │   │
│  │  │    tracesSampleRate: 0.1,         ← 10% in prod        │     │   │
│  │  │    replaysSessionSampleRate: 0.1, ← 10% in prod        │     │   │
│  │  │    sendDefaultPii: true,          ← User tracking      │     │   │
│  │  │  })                                                     │     │   │
│  │  └────────────────────────────────────────────────────────┘     │   │
│  │                              │                                   │   │
│  │                              ▼                                   │   │
│  │  ┌────────────────────────────────────────────────────────┐     │   │
│  │  │  withSentryRouting(RouterProvider)                      │     │   │
│  │  │    └─ Tracks route changes and navigation              │     │   │
│  │  └────────────────────────────────────────────────────────┘     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                          src/App.tsx                             │   │
│  │  ┌────────────────────────────────────────────────────────┐     │   │
│  │  │  useEffect(() => {                                     │     │   │
│  │  │    if (clerkUser) {                                    │     │   │
│  │  │      Sentry.setUser({                                  │     │   │
│  │  │        id: clerkUser.id,            ← User Context     │     │   │
│  │  │        email: clerkUser.email,                         │     │   │
│  │  │        username: clerkUser.username                    │     │   │
│  │  │      });                                               │     │   │
│  │  │    }                                                   │     │   │
│  │  │  }, [clerkUser]);                                      │     │   │
│  │  └────────────────────────────────────────────────────────┘     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              src/components/ErrorBoundary.tsx                    │   │
│  │  ┌────────────────────────────────────────────────────────┐     │   │
│  │  │  Sentry.withErrorBoundary(Component, {                 │     │   │
│  │  │    fallback: ErrorFallback,         ← Custom UI        │     │   │
│  │  │    beforeCapture: (scope, error) => {                  │     │   │
│  │  │      scope.setContext("errorInfo", ...)                │     │   │
│  │  │    }                                                   │     │   │
│  │  │  })                                                     │     │   │
│  │  └────────────────────────────────────────────────────────┘     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Events sent via HTTPS
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Sentry Cloud                                    │
│  https://o4509554346754048.ingest.us.sentry.io                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │  Error Events   │  │  Performance    │  │  Session        │         │
│  │  ─────────────  │  │  ──────────────  │  │  ──────────     │         │
│  │  • Exceptions   │  │  • Page loads   │  │  • Recordings   │         │
│  │  • Stack traces │  │  • API calls    │  │  • User actions │         │
│  │  • User context │  │  • Route timing │  │  • Screenshots  │         │
│  │  • Breadcrumbs  │  │  • Transactions │  │  • DOM replay   │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Sentry Dashboard                                  │
│  https://sentry.io/organizations/[org]/projects/[project]               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  • Issues: View and triage errors                                       │
│  • Performance: Analyze slow transactions                               │
│  • Replays: Watch user sessions                                         │
│  • Releases: Track deployments                                          │
│  • Alerts: Get notified of critical issues                              │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Error Capture Flow
```
User Action → Error Occurs → ErrorBoundary Catches
      ↓
Sentry.captureException()
      ↓
Add context (user, breadcrumbs, tags)
      ↓
Send to Sentry API
      ↓
Appears in Sentry Dashboard
```

### 2. Performance Tracking Flow
```
Route Change → browserTracingIntegration() detects
      ↓
Create transaction span
      ↓
Track navigation timing
      ↓
Sample decision (10% in prod)
      ↓
Send performance data to Sentry
      ↓
Appears in Performance tab
```

### 3. Session Replay Flow
```
User Session Starts → replayIntegration() records
      ↓
Capture DOM changes, clicks, scrolls
      ↓
Sample decision:
  • 10% normal sessions
  • 100% sessions with errors
      ↓
Compress and send replay data
      ↓
Available in Replays tab
```

### 4. User Context Flow
```
Clerk Login → useUser() hook updates
      ↓
useEffect detects change
      ↓
Sentry.setUser({ id, email, username })
      ↓
All future events tagged with user
      ↓
Errors associated with specific users
```

## Build-Time Integration

### Source Map Upload Flow
```
npm run build
      ↓
Vite builds app with sourcemaps
      ↓
sentryVitePlugin() activates
      ↓
Upload sourcemaps to Sentry
      ↓
Create release in Sentry
      ↓
Link sourcemaps to release
      ↓
Production errors show original code
```

## Integration Points

### With Clerk (Authentication)
```typescript
┌──────────────┐         ┌──────────────┐
│   Clerk      │ ──────→ │   Sentry     │
│   useUser()  │  User   │   setUser()  │
│              │  Info   │              │
└──────────────┘         └──────────────┘
```

### With Convex (Backend)
```typescript
┌──────────────┐         ┌──────────────┐
│   Convex     │         │   Sentry     │
│   Queries    │ ──────→ │   Errors if  │
│   Mutations  │  Errors │   failed     │
└──────────────┘         └──────────────┘
```

### With React Router
```typescript
┌──────────────┐         ┌──────────────┐
│ React Router │ ──────→ │   Sentry     │
│ Navigation   │ Route   │ Performance  │
│              │ Changes │ Tracking     │
└──────────────┘         └──────────────┘
```

## Environment Configuration

### Development Mode
```
VITE_SENTRY_DEBUG=false (default)
↓
Events logged to console
↓
Not sent to Sentry
↓
100% sampling for testing
```

### Production Mode
```
NODE_ENV=production
↓
All events sent to Sentry
↓
10% performance sampling
↓
10% session replay sampling
↓
100% error sampling
```

## Security Model

```
┌─────────────────────────────────────────┐
│  Public (Safe to Commit)                │
├─────────────────────────────────────────┤
│  • DSN (in src/main.tsx)                │
│  • Sentry configuration                 │
│  • Integration code                     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Private (Keep in .env.local)           │
├─────────────────────────────────────────┤
│  • SENTRY_AUTH_TOKEN                    │
│  • SENTRY_ORG                           │
│  • SENTRY_PROJECT                       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Uploaded to Sentry (Not Public)        │
├─────────────────────────────────────────┤
│  • Source maps                          │
│  • Release information                  │
│  • Debug symbols                        │
└─────────────────────────────────────────┘
```

## Event Types

### Error Events
- Type: `error`, `warning`, `info`
- Contains: Stack trace, user context, breadcrumbs
- Sample Rate: 100%
- Retention: Based on Sentry plan

### Performance Events
- Type: `transaction`
- Contains: Timing data, spans, tags
- Sample Rate: 10% in production
- Retention: Based on Sentry plan

### Replay Events
- Type: `session`
- Contains: DOM snapshot, user interactions
- Sample Rate: 10% normal, 100% with errors
- Retention: Based on Sentry plan

## File Structure

```
convex-app/
├── src/
│   ├── main.tsx                    ← Sentry initialization
│   ├── App.tsx                     ← User context tracking
│   └── components/
│       └── ErrorBoundary.tsx       ← Error boundary
├── vite.config.ts                  ← Source map upload
├── package.json                    ← Dependencies
├── .env.local                      ← Sentry secrets (gitignored)
├── SENTRY_IMPLEMENTATION.md        ← Full documentation
├── SENTRY_QUICK_START.md           ← Quick reference
├── SENTRY_SUMMARY.md               ← Summary
└── SENTRY_ARCHITECTURE.md          ← This file
```

## Monitoring Workflow

```
1. Development
   └─→ Code changes
       └─→ Test locally
           └─→ Errors logged to console

2. Build
   └─→ npm run build
       └─→ Source maps generated
           └─→ Maps uploaded to Sentry

3. Deploy
   └─→ npm run deploy:frontend
       └─→ Release created in Sentry
           └─→ Events tagged with release

4. Production
   └─→ Users encounter errors
       └─→ Errors sent to Sentry
           └─→ Team notified via alerts
               └─→ Debug with source maps
                   └─→ Watch session replays
                       └─→ Fix and deploy
```

## Key Metrics Tracked

1. **Error Rate**: Errors per user session
2. **Performance**: P50, P75, P95, P99 load times
3. **User Impact**: Number of users affected by errors
4. **Session Quality**: Crash-free sessions percentage
5. **Release Health**: Errors per release version

## Best Practices Implemented

✅ Environment-aware configuration
✅ Smart sampling to control costs
✅ User privacy considerations
✅ Source map security (not public)
✅ Breadcrumb trail for context
✅ Tagged errors for filtering
✅ Custom error UI for better UX
✅ Integration with auth system
✅ Performance monitoring
✅ Session replay for debugging

