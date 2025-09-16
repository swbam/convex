# Understanding Vite Environment Variables

Vite replaces environment variables **at build time**. During `npm run build` or any Vercel
build, every `import.meta.env.VITE_*` reference is swapped with the value that exists in the
process environment. Missing values become `undefined` in the generated JavaScript bundle.

## Example

```ts
// Source code
const convexUrl = import.meta.env.VITE_CONVEX_URL;

// Build output when the variable is present
const convexUrl = "https://example.convex.cloud";

// Build output when the variable is missing
const convexUrl = undefined;
```

Because the substitution happens once during the build, you must configure environment
variables **before** triggering a deployment.

## Fixing "undefined" Values

1. Set the variables locally (`.env.local`) and in Vercel (**Project → Settings → Environment Variables**).
2. Redeploy so Vite can embed the correct values.
3. For server-side secrets that should not reach the client, keep them in the Convex dashboard;
   only expose `VITE_*` variables to the frontend.

Remember that the production build is immutable. If the variables were wrong during the
build step, redeploying with the corrected values is the only way to fix the deployed bundle.
