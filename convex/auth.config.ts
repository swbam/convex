const clerkIssuerDomain = process.env.CLERK_JWT_ISSUER_DOMAIN;
const clerkJwksUrl = process.env.CLERK_JWKS_URL;

if (!clerkIssuerDomain) {
  throw new Error("CLERK_JWT_ISSUER_DOMAIN environment variable is required");
}

export default {
  providers: [
    {
      domain: clerkIssuerDomain,
      applicationID: "convex",
      ...(clerkJwksUrl && { jwksUrl: clerkJwksUrl }),
    },
  ],
};
