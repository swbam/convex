import { httpAction } from "./_generated/server";
import { httpRouter } from "convex/server";
import crypto from "crypto";

const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

const http = httpRouter();

http.route({
  path: "/webhooks/clerk",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const signature = request.headers.get("svix-id") || "";
    const timestamp = request.headers.get("svix-timestamp") || "";
    const sigHeader = request.headers.get("svix-signature") || "";

    if (!CLERK_WEBHOOK_SECRET) {
      throw new Error("CLERK_WEBHOOK_SECRET not set");
    }

    // Verify signature
    const verifier = crypto.createHmac("sha256", CLERK_WEBHOOK_SECRET);
    verifier.update(timestamp + body);
    const expectedSig = verifier.digest("hex");

    const sigs = sigHeader.split(",");
    const [svixId, svixTimestamp, svixSignature] = sigs;

    const payload = { timestamp, signature: svixSignature, body };
    if (!sigs.some(sig => crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig)))) {
      throw new Error("Invalid signature");
    }

    const event = JSON.parse(body);
    if (event.type === "user.created") {
      await ctx.runMutation(internal.users.createFromClerk, { clerkUser: event.data });
    } else if (event.type === "user.updated") {
      await ctx.runMutation(internal.users.updateFromClerk, { clerkUser: event.data });
    }

    return new Response("OK", { status: 200 });
  }),
});

export default http;