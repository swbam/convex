import { RateLimiter, DAY } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";
import { internalMutation, internalQuery, query, mutation, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./adminHelpers";
import { LIVE_REQUEST_CAP, providerRetryAt } from "../shared/liveSetlist";

const limiter = new RateLimiter(components.rateLimiter, {
  setlistBurst: { kind: "token bucket", rate: 1, period: 1000, capacity: 1 },
});
export const reserve = internalMutation({
  args: { sessionId: v.optional(v.id("liveSetlistSessions")), generation: v.optional(v.number()) },
  returns: v.object({ ok: v.boolean(), retryAt: v.number() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const session = args.sessionId ? await ctx.db.get(args.sessionId) : null;
    if (args.sessionId && (!session || session.phase === "paused" || session.phase === "finished" ||
      session.generation !== args.generation || (session.leaseUntil ?? 0) <= now || session.requestsUsed >= LIVE_REQUEST_CAP)) {
      return { ok: false, retryAt: now + DAY };
    }
    const settings = await ctx.db.query("setlistProviderSettings").withIndex("by_key", q => q.eq("key", "global")).unique();
    if ((settings?.cooldownUntil ?? 0) > now) return { ok: false, retryAt: settings!.cooldownUntil! };
    // This is our spending ceiling, not a statement of the provider account's allowance.
    const config = { kind: "fixed window" as const, rate: settings?.dailyBudget ?? 1200, period: DAY, start: 0 };
    // Keep headroom for selected shows today, before bulk history imports consume it.
    const utcEnd = Math.floor(now / DAY) * DAY + DAY;
    const pilots = session ? [] : await ctx.db.query("liveSetlistSessions").take(3);
    const protectedRequests = pilots.filter(pilot => pilot.phase !== "paused" && pilot.phase !== "finished" &&
      pilot.startsAt - 30 * 60_000 < utcEnd && pilot.startsAt + 4 * 3600_000 > now)
      .reduce((sum, pilot) => sum + Math.max(0, LIVE_REQUEST_CAP - pilot.requestsUsed), 0);
    const daily = await limiter.check(ctx, "setlistDaily", { config, count: 1 + Math.min(protectedRequests, config.rate - 1) });
    if (!daily.ok) return { ok: false, retryAt: now + daily.retryAfter };
    const burst = await limiter.limit(ctx, "setlistBurst");
    if (!burst.ok) return { ok: false, retryAt: now + burst.retryAfter };
    await limiter.limit(ctx, "setlistDaily", { config, throws: true });
    if (session) await ctx.db.patch(session._id, { requestsUsed: session.requestsUsed + 1 });
    return { ok: true, retryAt: now };
  },
});
export const throttled = internalMutation({
  args: { retryAfter: v.union(v.string(), v.null()) }, returns: v.number(),
  handler: async (ctx, args) => {
    const settings = await ctx.db.query("setlistProviderSettings").withIndex("by_key", q => q.eq("key", "global")).unique();
    const cooldownUntil = Math.max(settings?.cooldownUntil ?? 0, providerRetryAt(Date.now(), args.retryAfter));
    if (settings) await ctx.db.patch(settings._id, { cooldownUntil });
    else await ctx.db.insert("setlistProviderSettings", { key: "global", dailyBudget: 1200, cooldownUntil });
    return cooldownUntil;
  },
});
const budgetResult = v.object({ dailyBudget: v.number(), remaining: v.number(), cooldownUntil: v.optional(v.number()) });

async function readBudget(ctx: QueryCtx) {
  const settings = await ctx.db.query("setlistProviderSettings").withIndex("by_key", q => q.eq("key", "global")).unique();
  const dailyBudget = settings?.dailyBudget ?? 1200;
  const value = await limiter.getValue(ctx, "setlistDaily", { config: { kind: "fixed window", rate: dailyBudget, period: DAY, start: 0 } });
  return { dailyBudget, remaining: Math.max(0, Math.floor(value.value)), cooldownUntil: settings?.cooldownUntil };
}

export const getWorkerBudget = internalQuery({ args: {}, returns: budgetResult, handler: readBudget });
export const getBudget = query({
  args: {}, returns: budgetResult,
  handler: async ctx => {
    await requireAdmin(ctx);
    return await readBudget(ctx);
  },
});
export const setBudget = mutation({
  args: { dailyBudget: v.number() }, returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!Number.isInteger(args.dailyBudget) || args.dailyBudget < 1 || args.dailyBudget > 100000) throw new Error("Enter a daily budget from 1 to 100,000 within your provider allowance.");
    const settings = await ctx.db.query("setlistProviderSettings").withIndex("by_key", q => q.eq("key", "global")).unique();
    if (settings) await ctx.db.patch(settings._id, args);
    else await ctx.db.insert("setlistProviderSettings", { key: "global", ...args });
    return null;
  },
});
