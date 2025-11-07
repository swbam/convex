"use node";

import { internalAction, internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const forward = internalAction({
  args: {
    operation: v.string(),
    error: v.string(),
    context: v.optional(v.any()),
    severity: v.optional(v.union(v.literal("error"), v.literal("warning"), v.literal("info"))),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
      return { success: false };
    }

    try {
      // Minimal DSN parsing to compute store endpoint and auth headers
      const url = new URL(dsn);
      const publicKey = url.username;
      const projectId = url.pathname.replace(/\//g, "");
      const origin = `${url.protocol}//${url.host}`;
      const storeUrl = `${origin}/api/${projectId}/store/`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=convex/1.0, sentry_key=${publicKey}`,
      };

      const level = (args.severity || "error") as "error" | "warning" | "info";
      const event = {
        message: args.operation,
        level,
        timestamp: Date.now() / 1000,
        extra: args.context || {},
      };

      const res = await fetch(storeUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(event),
      } as RequestInit);

      if (!res.ok) {
        console.warn("Sentry forward failed:", res.status, await res.text());
        return { success: false };
      }
      return { success: true };
    } catch (e) {
      console.warn("Sentry forward exception:", e);
      return { success: false };
    }
  },
});

export const markSent = internalMutation({
  args: { errorId: v.id("errorLogs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.errorId, { sentToSentry: true });
    return null;
  },
});


