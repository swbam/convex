import { v } from "convex/values";

export const appearanceValidator = v.object({
  accentColor: v.string(),
  logoStartColor: v.string(),
  logoEndColor: v.string(),
  logoGradient: v.boolean(),
  gradientAngle: v.number(),
  buttonStyle: v.union(v.literal("solid"), v.literal("outline")),
});
