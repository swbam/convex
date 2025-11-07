// CRITICAL: For custom Clerk domains, use the JWT issuer domain
// Your Clerk setup:
// - Issuer: https://clerk.setlists.live
// - JWKS: https://clerk.setlists.live/.well-known/jwks.json
const clerkIssuerUrl = process.env.CLERK_JWT_ISSUER_DOMAIN || process.env.CLERK_ISSUER_URL!;

export default {
  providers: [
    {
      domain: clerkIssuerUrl,
      applicationID: "convex",
    },
  ],
};
