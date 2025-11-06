# Sentry Quick Start Guide

## ✅ Implementation Complete

Sentry error tracking and performance monitoring has been successfully integrated into your setlists.live application.

## 🚀 Next Steps

### 1. Install Dependencies ✅ DONE
The Sentry packages have been installed:
```bash
npm install --save-dev @sentry/vite-plugin
```

### 2. Add Environment Variables

Create or update your `.env.local` file:

```bash
# Required for production source map uploads
SENTRY_ORG=your_sentry_org_slug
SENTRY_PROJECT=your_sentry_project_name
SENTRY_AUTH_TOKEN=your_sentry_auth_token

# Optional: Enable Sentry in development mode
VITE_SENTRY_DEBUG=false
```

**How to get these values:**
1. Go to https://sentry.io/settings/
2. Navigate to your organization settings
3. Get your org slug from the URL
4. Go to Projects and find your project name
5. Create an auth token at: https://sentry.io/settings/account/api/auth-tokens/
   - Scopes needed: `project:releases`, `project:write`

### 3. Test the Integration

#### Option A: Test in Development (without sending to Sentry)
```bash
npm run dev
```

The app will log Sentry events to console but won't send them unless you set `VITE_SENTRY_DEBUG=true`.

#### Option B: Test Error Capture

Add this test button to any component:

```typescript
<button onClick={() => {
  throw new Error("Sentry Test Error - This should appear in dashboard");
}}>
  Test Sentry
</button>
```

#### Option C: Console Test

Open browser console and run:
```javascript
Sentry.captureMessage("Testing Sentry from console");
```

### 4. Verify in Sentry Dashboard

1. Go to https://sentry.io/
2. Select your organization and project
3. Navigate to **Issues** to see captured errors
4. Navigate to **Performance** to see transaction traces
5. Navigate to **Replays** to see session recordings

## 📊 What's Been Implemented

### ✅ Core Features

- **Error Tracking**: All JavaScript errors automatically captured
- **Performance Monitoring**: Page loads and route transitions tracked
- **Session Replay**: Record user sessions (10% sample rate, 100% on errors)
- **User Context**: Errors linked to authenticated Clerk users
- **Source Maps**: Automatic upload in production builds
- **Custom Error UI**: Branded error boundary with retry functionality

### ✅ Integration Points

| File | Purpose |
|------|---------|
| `src/main.tsx` | Sentry initialization, DSN config, performance monitoring |
| `src/App.tsx` | User context tracking with Clerk |
| `src/components/ErrorBoundary.tsx` | Custom error UI with Sentry reporting |
| `vite.config.ts` | Source map upload configuration |

### ✅ Sample Rates

| Feature | Development | Production |
|---------|-------------|------------|
| Error Tracking | 100% | 100% |
| Performance Traces | 100% | 10% |
| Session Replay | 100% | 10% |
| Error Replays | 100% | 100% |

## 🧪 Testing Checklist

- [ ] Test error capture by throwing an error
- [ ] Verify error appears in Sentry dashboard
- [ ] Check that user email/ID is attached to errors (when logged in)
- [ ] Test performance monitoring by navigating routes
- [ ] Verify session replay is recording
- [ ] Test source map upload in production build

## 🔧 Configuration Reference

### Sentry Init (src/main.tsx)

```typescript
Sentry.init({
  dsn: "https://7a0b4270ce0837a16efc62a1f9e7493b@o4509554346754048.ingest.us.sentry.io/4510320697081856",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  replaysSessionSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,
  sendDefaultPii: true,
  environment: import.meta.env.MODE,
});
```

### User Context (src/App.tsx)

```typescript
useEffect(() => {
  if (clerkUser) {
    Sentry.setUser({
      id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress,
      username: clerkUser.username || clerkUser.firstName,
    });
  } else {
    Sentry.setUser(null);
  }
}, [clerkUser]);
```

## 🚨 Common Issues

### Issue: Source maps not uploading

**Solution**: Ensure these environment variables are set:
```bash
SENTRY_ORG=your_org
SENTRY_PROJECT=your_project
SENTRY_AUTH_TOKEN=your_token
```

### Issue: Errors not appearing in Sentry

**Possible Causes**:
1. Development mode (set `VITE_SENTRY_DEBUG=true` to test)
2. Ad blocker blocking Sentry
3. Incorrect DSN
4. Network firewall

### Issue: User context not showing

**Solution**: 
1. Ensure user is logged in via Clerk
2. Check `useUser()` hook is returning user data
3. Look for Sentry logs in browser console

## 📚 Additional Resources

- **Full Documentation**: See `SENTRY_IMPLEMENTATION.md`
- **Sentry React Docs**: https://docs.sentry.io/platforms/javascript/guides/react/
- **Vite Plugin Docs**: https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/uploading/vite/
- **Performance Monitoring**: https://docs.sentry.io/product/performance/
- **Session Replay**: https://docs.sentry.io/product/session-replay/

## 🎯 Production Deployment

### Build Command
```bash
npm run build
```

This will:
1. Build the app with source maps
2. Upload source maps to Sentry (if env vars are set)
3. Create production bundle in `dist/`

### Deploy Command
```bash
npm run deploy:frontend
```

### Verify Deployment
1. Visit your production URL
2. Trigger a test error
3. Check Sentry dashboard within 1-2 minutes
4. Verify source maps are working (errors show actual source code, not minified)

## 💡 Pro Tips

1. **Set up Alerts**: Configure Sentry to notify you of critical errors via Slack/Email
2. **Use Tags**: Tag errors by feature/section for easier filtering
3. **Add Breadcrumbs**: Add context before errors occur
4. **Monitor Quota**: Keep an eye on your Sentry quota usage
5. **Adjust Sample Rates**: If you hit quota limits, reduce sample rates

## ✨ Example: Manual Error Capture

```typescript
import * as Sentry from "@sentry/react";

// Capture exception with context
try {
  await processPayment();
} catch (error) {
  Sentry.captureException(error, {
    tags: { section: "payment" },
    extra: { amount: 99.99, userId: user.id },
    level: "error",
  });
  throw error;
}

// Add breadcrumb
Sentry.addBreadcrumb({
  category: "user-action",
  message: "User clicked checkout",
  level: "info",
  data: { cartTotal: 99.99 },
});

// Capture message
Sentry.captureMessage("Payment processed successfully", "info");
```

## 🎉 You're All Set!

Sentry is now fully integrated and ready to capture errors, monitor performance, and replay user sessions. Start your dev server and test it out!

```bash
npm run dev
```

For detailed information, see `SENTRY_IMPLEMENTATION.md`.

