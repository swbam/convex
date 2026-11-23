import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internalRef } from "../adminHelpers";

// All provider paths share one transactional budget. No browser performs provider polling.
export async function setlistProviderFetch(ctx: ActionCtx, url: string, init: RequestInit = {},
  reservation: { sessionId?: Id<"liveSetlistSessions">; generation?: number } = {}): Promise<Response> {
  let permit = await ctx.runMutation(internalRef.setlistProvider.reserve, reservation);
  if (!permit.ok && permit.retryAt - Date.now() <= 1500) {
    await new Promise(resolve => setTimeout(resolve, Math.max(0, permit.retryAt - Date.now()) + 25));
    permit = await ctx.runMutation(internalRef.setlistProvider.reserve, reservation);
  }
  if (!permit.ok) return new Response(null, { status: 429,
    headers: { "Retry-After": String(Math.max(1, Math.ceil((permit.retryAt - Date.now()) / 1000))), "X-Setlists-Deferred": "1" } });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (response.status === 429) await ctx.runMutation(internalRef.setlistProvider.throttled, { retryAfter: response.headers.get("Retry-After") });
    return response;
  } finally { clearTimeout(timeout); }
}
