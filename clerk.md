# Clerk Configuration

⚠️ **IMPORTANT**: These are TEST keys. For production, use production keys from Clerk dashboard.

## Test Environment Keys

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_cXVpZXQtcG9zc3VtLTcxLmNsZXJrLmFjY291bnRzLmRldiQ
CLERK_SECRET_KEY=sk_test_Lpv2rBqUhSOlGs6unmAIgFq4sO2ZzwzzjLduPpRbrv
```

## Additional Info

- **JWKS URL**: https://quiet-possum-71.clerk.accounts.dev/.well-known/jwks.json
- **Frontend API URL**: https://quiet-possum-71.clerk.accounts.dev
- **Domain**: quiet-possum-71.clerk.accounts.dev

## Production Setup

1. Create production application in Clerk dashboard
2. Add your production domain to allowed origins
3. Replace test keys with production keys in Vercel environment variables
