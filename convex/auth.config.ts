export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN || "https://quiet-possum-71.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};