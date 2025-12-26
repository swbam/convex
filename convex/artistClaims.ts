import { mutation, query, internalAction, action } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./admin";
import { internal } from "./_generated/api";

// Workaround for deep type instantiation with scheduler
const internalRef = internal as any;

async function getCurrentAppUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q: any) => q.eq("authId", identity.subject))
    .first();
}

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ============================================================================
// STEP 1: START CLAIM
// ============================================================================

export const startClaim = mutation({
  args: { artistId: v.id("artists") },
  returns: v.object({
    success: v.boolean(),
    claimId: v.optional(v.id("artistClaims")),
    status: v.optional(v.string()),
    message: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (!user) return { success: false, message: "Must be logged in" };
    if (!user.spotifyId) return { success: false, message: "Connect Spotify first" };

    const existingMember = await ctx.db
      .query("artistMembers")
      .withIndex("by_user_artist", (q) => q.eq("userId", user._id).eq("artistId", args.artistId))
      .first();
    if (existingMember) return { success: false, status: "already_member", message: "You already have access" };

    const existingClaim = await ctx.db
      .query("artistClaims")
      .withIndex("by_user_artist", (q) => q.eq("userId", user._id).eq("artistId", args.artistId))
      .first();
    
    if (existingClaim) {
      if (existingClaim.status === "draft" || existingClaim.status === "verifying") {
        return { success: true, claimId: existingClaim._id, status: existingClaim.status };
      }
      if (existingClaim.status === "pending") return { success: false, status: "pending", message: "Claim pending review" };
      if (existingClaim.status === "approved") return { success: false, status: "approved", message: "Already approved" };
    }

    const claimId = await ctx.db.insert("artistClaims", {
      userId: user._id,
      artistId: args.artistId,
      status: "draft",
      createdAt: Date.now(),
      spotifyUserId: user.spotifyId,
    });

    return { success: true, claimId, status: "draft" };
  },
});

// ============================================================================
// STEP 2: EMAIL VERIFICATION
// ============================================================================

export const requestEmailVerification = action({
  args: { claimId: v.id("artistClaims"), email: v.string() },
  returns: v.object({ success: v.boolean(), message: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.email)) return { success: false, message: "Invalid email" };

    const code = generateVerificationCode();
    await ctx.runMutation(internalRef.artistClaims.storeVerificationCode, {
      claimId: args.claimId,
      email: args.email.toLowerCase().trim(),
      code,
    });
    await ctx.runAction(internalRef.artistClaims.sendVerificationEmail, {
      email: args.email.toLowerCase().trim(),
      code,
      claimId: args.claimId,
    });
    return { success: true, message: "Code sent" };
  },
});

export const storeVerificationCode = mutation({
  args: { claimId: v.id("artistClaims"), email: v.string(), code: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.claimId, {
      verificationEmail: args.email,
      verificationCode: args.code,
      verificationCodeSentAt: Date.now(),
      verificationCodeAttempts: 0,
      status: "verifying",
    });
    return null;
  },
});

export const sendVerificationEmail = internalAction({
  args: { email: v.string(), code: v.string(), claimId: v.id("artistClaims") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const resendApiKey = process.env.RESEND_API_KEY;
    console.log("📧 Verification code " + args.code + " for " + args.email);
    if (!resendApiKey) { console.log("⚠️ RESEND_API_KEY not set"); return null; }
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": "Bearer " + resendApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Verification <noreply@setlists.live>",
          to: args.email,
          subject: "Your verification code: " + args.code,
          html: "<div style='font-family:sans-serif;max-width:400px;margin:0 auto;padding:40px 20px;'><h1 style='font-size:24px;margin-bottom:24px;'>Verify your email</h1><p style='color:#666;margin-bottom:32px;'>Enter this code:</p><div style='background:#f4f4f5;border-radius:12px;padding:24px;text-align:center;'><span style='font-size:36px;font-weight:700;letter-spacing:8px;'>" + args.code + "</span></div><p style='color:#999;font-size:12px;margin-top:32px;'>Expires in 15 minutes.</p></div>",
        }),
      });
      console.log("✅ Sent");
    } catch (e) { console.error("❌ Error:", e); }
    return null;
  },
});

// ============================================================================
// STEP 3: VERIFY CODE
// ============================================================================

export const verifyEmailCode = mutation({
  args: { claimId: v.id("artistClaims"), code: v.string() },
  returns: v.object({ success: v.boolean(), message: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const claim = await ctx.db.get(args.claimId);
    if (!claim) return { success: false, message: "Claim not found" };

    const attempts = (claim.verificationCodeAttempts ?? 0) + 1;
    if (attempts > 5) return { success: false, message: "Too many attempts" };

    const sentAt = claim.verificationCodeSentAt ?? 0;
    if (Date.now() - sentAt > 15 * 60 * 1000) return { success: false, message: "Code expired" };

    if (claim.verificationCode !== args.code.trim()) {
      await ctx.db.patch(args.claimId, { verificationCodeAttempts: attempts });
      return { success: false, message: "Invalid code. " + (5 - attempts) + " left" };
    }

    await ctx.db.patch(args.claimId, {
      emailVerified: true,
      emailVerifiedAt: Date.now(),
      verificationCode: undefined,
    });
    return { success: true, message: "Email verified" };
  },
});

// ============================================================================
// STEP 4: UPDATE DETAILS
// ============================================================================

export const updateClaimDetails = mutation({
  args: {
    claimId: v.id("artistClaims"),
    officialRole: v.union(v.literal("artist"), v.literal("manager"), v.literal("label"), v.literal("agent"), v.literal("publicist"), v.literal("team")),
    organizationName: v.optional(v.string()),
    officialWebsite: v.optional(v.string()),
    socialLinks: v.optional(v.array(v.string())),
    additionalContext: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), message: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const claim = await ctx.db.get(args.claimId);
    if (!claim) return { success: false, message: "Not found" };
    if (!claim.emailVerified) return { success: false, message: "Verify email first" };

    await ctx.db.patch(args.claimId, {
      officialRole: args.officialRole,
      organizationName: args.organizationName,
      officialWebsite: args.officialWebsite,
      socialLinks: args.socialLinks,
      additionalContext: args.additionalContext,
    });
    return { success: true };
  },
});

// ============================================================================
// STEP 5: SUBMIT
// ============================================================================

export const submitClaim = mutation({
  args: { claimId: v.id("artistClaims") },
  returns: v.object({ success: v.boolean(), message: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const claim = await ctx.db.get(args.claimId);
    if (!claim) return { success: false, message: "Not found" };
    if (!claim.emailVerified) return { success: false, message: "Verify email" };
    if (!claim.officialRole) return { success: false, message: "Select role" };

    const [user, artist] = await Promise.all([ctx.db.get(claim.userId), ctx.db.get(claim.artistId)]);

    await ctx.db.patch(args.claimId, { status: "pending", submittedAt: Date.now() });

    await ctx.scheduler.runAfter(0, internalRef.artistClaims.notifyOwnerOfClaim, {
      claimId: args.claimId,
      artistName: artist?.name ?? "Unknown",
      userEmail: claim.verificationEmail ?? user?.email ?? "unknown",
      userName: user?.name ?? user?.username ?? "Unknown",
      role: claim.officialRole,
      organizationName: claim.organizationName,
    });

    return { success: true, message: "Submitted" };
  },
});

// ============================================================================
// LEGACY CREATE (backwards compat)
// ============================================================================

export const create = mutation({
  args: { artistId: v.id("artists"), evidence: v.optional(v.array(v.object({ type: v.string(), value: v.string() }))) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (!user) throw new Error("Sign in");
    if (!user.spotifyId) throw new Error("Connect Spotify");

    const existingMember = await ctx.db.query("artistMembers").withIndex("by_user_artist", (q) => q.eq("userId", user._id).eq("artistId", args.artistId)).first();
    if (existingMember) return { status: "already_member", artistId: args.artistId };

    const existingClaim = await ctx.db.query("artistClaims").withIndex("by_user_artist", (q) => q.eq("userId", user._id).eq("artistId", args.artistId)).first();
    if (existingClaim) return { status: existingClaim.status, claimId: existingClaim._id };

    const spotifyRel = await ctx.db.query("userSpotifyArtists").withIndex("by_user_artist", (q) => q.eq("userId", user._id).eq("artistId", args.artistId)).first();
    if (!spotifyRel) throw new Error("Artist not in your Spotify");

    const artist = await ctx.db.get(args.artistId);
    const claimId = await ctx.db.insert("artistClaims", { userId: user._id, artistId: args.artistId, status: "pending", createdAt: Date.now(), submittedAt: Date.now(), spotifyUserId: user.spotifyId, evidence: args.evidence });

    await ctx.scheduler.runAfter(0, internalRef.artistClaims.notifyOwnerOfClaim, { claimId, artistName: artist?.name ?? "Unknown", userEmail: user.email ?? "unknown", userName: user.name ?? user.username ?? "Unknown" });

    return { status: "pending", claimId };
  },
});

// ============================================================================
// QUERIES
// ============================================================================

export const getClaim = query({
  args: { claimId: v.id("artistClaims") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (!user) return null;
    const claim = await ctx.db.get(args.claimId);
    if (!claim || claim.userId !== user._id) return null;
    const artist = await ctx.db.get(claim.artistId);
    return { ...claim, artist };
  },
});

export const getMyClaims = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    if (!user) return [];
    const claims = await ctx.db.query("artistClaims").withIndex("by_user", (q) => q.eq("userId", user._id)).order("desc").take(100);
    return Promise.all(claims.map(async (c: any) => ({ ...c, artist: await ctx.db.get(c.artistId) })));
  },
});

export const listPending = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const pending = await ctx.db.query("artistClaims").withIndex("by_status", (q) => q.eq("status", "pending")).order("desc").take(args.limit ?? 50);
    return Promise.all(pending.map(async (c: any) => ({ ...c, artist: await ctx.db.get(c.artistId), user: await ctx.db.get(c.userId) })));
  },
});

export const getPendingCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const pending = await ctx.db.query("artistClaims").withIndex("by_status", (q) => q.eq("status", "pending")).collect();
    return pending.length;
  },
});

// ============================================================================
// ADMIN
// ============================================================================

export const approve = mutation({
  args: { claimId: v.id("artistClaims"), role: v.optional(v.union(v.literal("owner"), v.literal("manager"), v.literal("viewer"))), note: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const adminUserId = await requireAdmin(ctx);
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Not found");
    if (claim.status !== "pending") return { success: true, status: claim.status };

    let memberRole: "owner" | "manager" | "viewer" = args.role ?? "owner";
    if (!args.role && claim.officialRole) {
      if (claim.officialRole === "artist") memberRole = "owner";
      else if (claim.officialRole === "manager" || claim.officialRole === "agent") memberRole = "manager";
      else memberRole = "viewer";
    }

    const existing = await ctx.db.query("artistMembers").withIndex("by_user_artist", (q) => q.eq("userId", claim.userId).eq("artistId", claim.artistId)).first();
    if (existing) await ctx.db.patch(existing._id, { role: memberRole });
    else await ctx.db.insert("artistMembers", { userId: claim.userId, artistId: claim.artistId, role: memberRole, createdAt: Date.now() });

    await ctx.db.patch(args.claimId, { status: "approved", reviewedAt: Date.now(), reviewedBy: adminUserId, reviewNote: args.note });

    const user = await ctx.db.get(claim.userId);
    const artist = await ctx.db.get(claim.artistId);
    if (claim.verificationEmail || user?.email) {
      await ctx.scheduler.runAfter(0, internalRef.artistClaims.sendApprovalEmail, { email: claim.verificationEmail ?? user?.email ?? "", artistName: artist?.name ?? "your artist" });
    }

    return { success: true };
  },
});

export const reject = mutation({
  args: { claimId: v.id("artistClaims"), note: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const adminUserId = await requireAdmin(ctx);
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Not found");
    if (claim.status !== "pending") return { success: true, status: claim.status };

    await ctx.db.patch(args.claimId, { status: "rejected", reviewedAt: Date.now(), reviewedBy: adminUserId, reviewNote: args.note });

    const user = await ctx.db.get(claim.userId);
    const artist = await ctx.db.get(claim.artistId);
    if (claim.verificationEmail || user?.email) {
      await ctx.scheduler.runAfter(0, internalRef.artistClaims.sendRejectionEmail, { email: claim.verificationEmail ?? user?.email ?? "", artistName: artist?.name ?? "your artist", reason: args.note });
    }

    return { success: true };
  },
});

// ============================================================================
// EMAILS
// ============================================================================

export const notifyOwnerOfClaim = internalAction({
  args: { claimId: v.id("artistClaims"), artistName: v.string(), userEmail: v.string(), userName: v.string(), role: v.optional(v.string()), organizationName: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const adminUrl = (process.env.SITE_URL || "https://setlists.live") + "/admin";
    console.log("\n🎸 NEW CLAIM: " + args.artistName + " by " + args.userName + " <" + args.userEmail + "> " + (args.role || "") + "\nReview: " + adminUrl + "\n");

    const resendApiKey = process.env.RESEND_API_KEY;
    const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;
    if (resendApiKey && ownerEmail) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": "Bearer " + resendApiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Claims <noreply@setlists.live>",
            to: ownerEmail,
            subject: "🎸 New Claim: " + args.artistName,
            html: "<h2>New Artist Claim</h2><p><strong>" + args.artistName + "</strong></p><p>" + args.userName + " &lt;" + args.userEmail + "&gt;</p><p>Role: " + (args.role || "N/A") + "</p><p>Org: " + (args.organizationName || "N/A") + "</p><p><a href='" + adminUrl + "' style='background:#7c3aed;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;'>Review →</a></p>",
          }),
        });
      } catch (e) { console.error(e); }
    }
    return null;
  },
});

export const sendApprovalEmail = internalAction({
  args: { email: v.string(), artistName: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.email) return null;
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) { console.log("Would send approval to " + args.email); return null; }
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": "Bearer " + resendApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Verification <noreply@setlists.live>",
          to: args.email,
          subject: "✅ Approved: " + args.artistName,
          html: "<h1>You're in! 🎉</h1><p>Your claim for <strong>" + args.artistName + "</strong> was approved.</p><p><a href='" + (process.env.SITE_URL || "https://setlists.live") + "/for-artists' style='background:#7c3aed;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;'>Open Dashboard →</a></p>",
        }),
      });
    } catch (e) { console.error(e); }
    return null;
  },
});

export const sendRejectionEmail = internalAction({
  args: { email: v.string(), artistName: v.string(), reason: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.email) return null;
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) { console.log("Would send rejection to " + args.email); return null; }
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": "Bearer " + resendApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Verification <noreply@setlists.live>",
          to: args.email,
          subject: "Update on " + args.artistName + " claim",
          html: "<h1>Claim not approved</h1><p>We couldn't verify your claim for <strong>" + args.artistName + "</strong>.</p>" + (args.reason ? "<p><strong>Reason:</strong> " + args.reason + "</p>" : "") + "<p>Reply to this email with more info if you think this is an error.</p>",
        }),
      });
    } catch (e) { console.error(e); }
    return null;
  },
});
