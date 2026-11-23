import { v } from "convex/values";
export const performanceValidator = v.object({
  title: v.string(), setNumber: v.number(), encore: v.boolean(),
  guest: v.optional(v.string()), cover: v.optional(v.string()), notes: v.optional(v.string()),
});
export const requestValidator = v.object({ songTitle: v.string(), upvotes: v.number() });
export const livePhase = v.union(v.literal("scheduled"), v.literal("monitoring"), v.literal("followup"), v.literal("finished"), v.literal("paused"));
