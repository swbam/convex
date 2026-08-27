import { internalAction } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

/**
 * Deliver authoritative backend lifecycle events to PostHog.
 *
 * This action intentionally never throws: analytics must not make a catalog
 * warmup, claim approval, cron, or setlist import fail. The browser project
 * token is a write-only ingestion token, so using the same token here does not
 * expose administrative access to the PostHog project.
 */
export const capture = internalAction({
  args: {
    event: v.string(),
    distinctId: v.string(),
    properties: v.optional(v.any()),
    insertId: v.optional(v.string()),
  },
  returns: v.object({
    captured: v.boolean(),
    status: v.optional(v.number()),
    reason: v.optional(v.string()),
  }),
  handler: async (_ctx, args) => {
    const projectToken =
      process.env.POSTHOG_PROJECT_TOKEN?.trim() ||
      process.env.VITE_POSTHOG_KEY?.trim();

    if (!projectToken) {
      return { captured: false, reason: "not_configured" };
    }

    const configuredHost =
      process.env.POSTHOG_HOST?.trim() ||
      process.env.VITE_POSTHOG_HOST?.trim() ||
      DEFAULT_POSTHOG_HOST;
    const host = configuredHost.replace(/\/$/, "");
    const deployment = process.env.CONVEX_DEPLOYMENT || "convex";
    const appEnvironment = deployment.startsWith("prod:")
      ? "production"
      : deployment.startsWith("dev:")
        ? "development"
        : deployment;

    try {
      const response = await fetch(`${host}/i/v0/e/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: projectToken,
          event: args.event,
          properties: {
            distinct_id: args.distinctId,
            ...(args.insertId ? { $insert_id: args.insertId } : {}),
            $process_person_profile: false,
            analytics_schema_version: 1,
            app_name: "setlists.live",
            app_environment: appEnvironment,
            event_source: "convex_backend",
            ...(args.properties ?? {}),
          },
        }),
      });

      if (!response.ok) {
        console.warn(`PostHog capture failed with status ${response.status}`);
        return { captured: false, status: response.status, reason: "http_error" };
      }

      return { captured: true, status: response.status };
    } catch (error) {
      console.warn(
        "PostHog capture failed",
        error instanceof Error ? error.name : "unknown_error",
      );
      return { captured: false, reason: "network_error" };
    }
  },
});
