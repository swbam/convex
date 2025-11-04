const clerkIssuerUrl = process.env.CLERK_ISSUER_URL!;

export default {
  providers: [
    {
      domain: clerkIssuerUrl,
      applicationID: "convex",
    },
  ],
};
