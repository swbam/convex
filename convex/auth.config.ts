export default {
  providers: [
    {
      domain: process.env.CLERK_ISSUER_URL || "https://quiet-possum-71.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};