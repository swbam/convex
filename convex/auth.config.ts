// Convex auth configuration to accept Clerk-issued JWTs via ConvexProviderWithClerk
// Configure the Clerk issuer domain and applicationID expected in the JWT's `aud` claim.
// In Clerk, create a JWT template with audience "convex" and add your issuer domain.

export default {
  providers: [
    {
      // Use env for production; falls back to the dev issuer if not provided
      domain:
        process.env.CLERK_JWT_ISSUER_DOMAIN ||
        "https://quiet-possum-71.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};

