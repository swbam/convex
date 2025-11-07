// CRITICAL: For custom Clerk domains, use the JWT issuer domain
// Your Clerk setup:
// - Issuer: https://clerk.setlists.live
// - JWKS: https://clerk.setlists.live/.well-known/jwks.json

// Validate required environment variables
const clerkIssuerUrl = process.env.CLERK_JWT_ISSUER_DOMAIN || process.env.CLERK_ISSUER_URL;

if (!clerkIssuerUrl) {
  throw new Error(
    "Missing CLERK_JWT_ISSUER_DOMAIN or CLERK_ISSUER_URL environment variable. " +
    "Set this in your Convex dashboard to enable authentication."
  );
}

export default {
  providers: [
    {
      domain: clerkIssuerUrl,
      applicationID: "convex",
    },
  ],
};
