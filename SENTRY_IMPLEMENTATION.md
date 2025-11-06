# Sentry Implementation Guide

This document outlines the Sentry error tracking and performance monitoring implementation for the setlists.live web application.

## Overview

Sentry has been fully integrated into the application to provide:
- **Error Tracking**: Automatic capture and reporting of JavaScript errors
- **Performance Monitoring**: Track page load times, API calls, and user interactions
- **Session Replay**: Record user sessions to understand error context
- **User Context**: Associate errors with authenticated users via Clerk

## Configuration

### Environment Variables

Add the following to your `.env.local` file (see `.env.example` for reference):

```bash
# Sentry Configuration (Production)
SENTRY_ORG=your_sentry_org_slug
SENTRY_PROJECT=your_sentry_project_name
SENTRY_AUTH_TOKEN=your_sentry_auth_token

# Optional: Enable Sentry in development
VITE_SENTRY_DEBUG=true
```

### Sentry Settings

The DSN (Data Source Name) is configured directly in `src/main.tsx`:
```
dsn: "https://7a0b4270ce0837a16efc62a1f9e7493b@o4509554346754048.ingest.us.sentry.io/4510320697081856"
```

## Features Implemented

### 1. Error Tracking

**Location**: `src/main.tsx`, `src/components/ErrorBoundary.tsx`

- Automatic error capture for all JavaScript errors
- Custom ErrorBoundary component with Sentry integration
- User-friendly error fallback UI
- Automatic error reporting to Sentry dashboard

**Error Boundary Features**:
- Displays clean error UI to users
- "Try Again" and "Go Home" buttons
- Notifies users that errors are automatically reported
- Captures component stack traces

### 2. Performance Monitoring

**Location**: `src/main.tsx`

**Configured with**:
- `browserTracingIntegration()`: Tracks page load and navigation performance
- `tracesSampleRate`: 10% in production, 100% in development
- React Router integration via `withSentryRouting`

**Tracks**:
- Page load times
- Route transitions
- API call performance
- User interactions

### 3. Session Replay

**Location**: `src/main.tsx`

**Configuration**:
```javascript
replayIntegration({
  maskAllText: false,
  blockAllMedia: false,
})
```

**Sampling Rates**:
- `replaysSessionSampleRate`: 10% of normal sessions
- `replaysOnErrorSampleRate`: 100% of error sessions

### 4. User Context Tracking

**Location**: `src/App.tsx`

Automatically associates errors with authenticated users:
```javascript
useEffect(() => {
  if (clerkUser) {
    Sentry.setUser({
      id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress,
      username: clerkUser.username || clerkUser.firstName || undefined,
    });
  } else {
    Sentry.setUser(null);
  }
}, [clerkUser]);
```

### 5. Source Maps Upload

**Location**: `vite.config.ts`

**Configured with**:
- Sentry Vite Plugin for automatic source map upload
- Only enabled in production builds
- Requires `SENTRY_AUTH_TOKEN` environment variable

**Build Configuration**:
```javascript
sentryVitePlugin({
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: {
    assets: "./dist/**",
  },
  telemetry: false,
})
```

## Ignored Errors

The following errors are ignored to reduce noise:

```javascript
ignoreErrors: [
  'ResizeObserver loop limit exceeded', // Browser extension noise
  'Non-Error promise rejection captured', // Promise rejections
  'NetworkError', // Network failures
  'Failed to fetch', // API timeouts
]
```

## Development vs Production

### Development Mode
- Events are logged to console but NOT sent to Sentry (unless `VITE_SENTRY_DEBUG=true`)
- 100% trace sampling for easier debugging
- Full session replay enabled

### Production Mode
- All errors sent to Sentry
- 10% trace sampling to control quota
- 10% session replay sampling (100% on errors)

## Testing Sentry Integration

### Manual Error Test

Add this button anywhere in your app to test error capture:

```javascript
<button onClick={() => {
  throw new Error("Test Sentry Error");
}}>
  Trigger Test Error
</button>
```

### Console Test

```javascript
Sentry.captureMessage("Test message from console");
Sentry.captureException(new Error("Test exception"));
```

### Performance Test

Navigate between routes to see performance tracking in Sentry's Performance tab.

## Deployment Checklist

Before deploying to production:

1. ✅ Set `SENTRY_ORG` environment variable
2. ✅ Set `SENTRY_PROJECT` environment variable
3. ✅ Set `SENTRY_AUTH_TOKEN` environment variable
4. ✅ Verify source maps are being uploaded
5. ✅ Test error capture in production
6. ✅ Verify user context is being set correctly
7. ✅ Check Sentry dashboard for incoming events

## Package Dependencies

Required packages (already installed):

```json
{
  "@sentry/react": "^10.23.0",
  "@sentry/vite-plugin": "^x.x.x" // Note: Add this to package.json
}
```

## Additional Features

### Manual Error Capture

Capture errors manually anywhere in your code:

```javascript
import * as Sentry from "@sentry/react";

try {
  // Your code
} catch (error) {
  Sentry.captureException(error, {
    level: "error",
    tags: { section: "payment" },
    extra: { userId: user.id },
  });
}
```

### Add Context

Add breadcrumbs for debugging:

```javascript
Sentry.addBreadcrumb({
  category: "user-action",
  message: "User clicked submit button",
  level: "info",
});
```

### Performance Spans

Track custom performance spans:

```javascript
const transaction = Sentry.startTransaction({
  name: "Load Artist Data",
  op: "data.fetch",
});

// Your code

transaction.finish();
```

## Sentry Dashboard

Access your Sentry dashboard:
- Organization: `o4509554346754048`
- Project: `4510320697081856`
- URL: https://sentry.io/organizations/[your-org]/projects/[your-project]/

## Support

For issues or questions:
1. Check Sentry documentation: https://docs.sentry.io/platforms/javascript/guides/react/
2. Review implementation in:
   - `src/main.tsx`
   - `src/App.tsx`
   - `src/components/ErrorBoundary.tsx`
   - `vite.config.ts`

## Next Steps

1. **Install Sentry Vite Plugin**:
   ```bash
   npm install --save-dev @sentry/vite-plugin
   ```

2. **Add Environment Variables**:
   - Add the required Sentry environment variables to your `.env.local` file
   - Get your auth token from: https://sentry.io/settings/account/api/auth-tokens/

3. **Test in Development**:
   ```bash
   npm run dev
   ```

4. **Build for Production**:
   ```bash
   npm run build
   ```

5. **Monitor Errors**:
   - Visit your Sentry dashboard to see captured errors
   - Review performance metrics
   - Watch session replays

## Best Practices

1. **Don't expose sensitive data**: The `sendDefaultPii: true` setting sends user IP and email. Review Sentry's data scrubbing settings.
2. **Monitor quota**: Sentry has event/replay quotas. Adjust sample rates if needed.
3. **Review errors regularly**: Set up alerts in Sentry for critical errors.
4. **Use breadcrumbs**: Add context to help debug issues.
5. **Tag errors**: Use tags to categorize and filter errors.

## Troubleshooting

### Source Maps Not Uploading

Ensure:
- `SENTRY_AUTH_TOKEN` is set correctly
- Build runs with `mode=production`
- Source maps are generated (`sourcemap: true` in vite.config.ts)

### Errors Not Appearing in Sentry

Check:
- DSN is correct in `main.tsx`
- Not in development mode (unless `VITE_SENTRY_DEBUG=true`)
- Network tab shows requests to `sentry.io`
- No ad blockers blocking Sentry

### User Context Not Set

Verify:
- Clerk user is authenticated
- `useEffect` in `App.tsx` is running
- Check browser console for Sentry logs

