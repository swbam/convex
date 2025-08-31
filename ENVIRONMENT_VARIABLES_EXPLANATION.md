# Understanding Vite Environment Variables

## The Key Concept

**Vite environment variables are replaced at BUILD TIME, not RUNTIME.**

## What This Means

When you run `npm run build`:
- Vite scans your code for `import.meta.env.VITE_*` references
- It replaces them with the actual values from environment variables
- The final JavaScript bundle contains the hardcoded values

Example:
```javascript
// Your source code:
const url = import.meta.env.VITE_CONVEX_URL;

// After build (if env var is set):
const url = "https://necessary-mosquito-453.convex.cloud";

// After build (if env var is NOT set):
const url = undefined;
```

## Why Your Deployment Failed

1. Vercel runs `npm run build` on their servers
2. During that build, if environment variables aren't available, Vite replaces them with `undefined`
3. Your built app tries to use `undefined` as the Convex URL
4. The app shows an error

## The Fix

Environment variables MUST be set in Vercel BEFORE the build happens:
1. Set them in Vercel Dashboard
2. Trigger a new build
3. Vite will now have access to the values during build
4. Your app will work correctly

## Common Mistakes

❌ **Wrong**: Thinking environment variables are read at runtime
✅ **Right**: Understanding they're embedded during build

❌ **Wrong**: Setting variables after deployment
✅ **Right**: Setting variables before triggering a build

❌ **Wrong**: Using cached builds after adding variables
✅ **Right**: Forcing a fresh build without cache

## Testing Locally

To simulate what happens on Vercel:
```bash
# Build without env vars (simulates your current problem)
npm run build
# Result: undefined values in built files

# Build with env vars (simulates the fix)
export VITE_CONVEX_URL=https://necessary-mosquito-453.convex.cloud
export VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
npm run build
# Result: actual values in built files
```