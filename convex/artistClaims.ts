import { mutation, query, internalAction, action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./admin";
import { internalRef } from "./adminHelpers";

// Workaround for deep type instantiation with scheduler


// Rate limiting constants
const MAX_EMAIL_SENDS_PER_HOUR = 5;
const MAX_VERIFICATION_ATTEMPTS = 5;
const EMAIL_COOLDOWN_MS = 60_000; // 1 minute between email sends

async function getCurrentAppUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q: any) => q.eq("authId", identity.subject))
    .first();
}

async function requireClaimOwnership(ctx: any, claimId: any) {
  const user = await getCurrentAppUser(ctx);
  if (!user) throw new Error("Must be logged in");
  const claim = await ctx.db.get(claimId);
  if (!claim) throw new Error("Claim not found");
  if (claim.userId !== user._id) throw new Error("Not authorized to modify this claim");
  return { user, claim };
}

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate a unique website/social verification code like SETLISTS-A7X9K2B1
function generateWebsiteVerificationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars like 0/O, 1/I
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `SETLISTS-${code}`;
}

// Extract domain from a URL
function extractDomain(url: string | undefined): string | null {
  if (!url) return null;
  try {
    // Handle URLs with or without protocol
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`;
    const parsed = new URL(urlWithProtocol);
    // Remove www. prefix for comparison
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

// Check if email domain matches website domain
function doDomainsMatch(emailDomain: string, websiteDomain: string): boolean {
  // Normalize both
  const email = emailDomain.toLowerCase();
  const website = websiteDomain.toLowerCase();

  // Direct match
  if (email === website) return true;

  // Handle subdomains (e.g., booking@theband.com matches www.theband.com)
  if (website.endsWith(`.${email}`) || email.endsWith(`.${website}`)) return true;

  return false;
}

// ============================================================================
// STEP 1: START CLAIM
// ============================================================================

export const startClaim = mutation({
  args: {
    artistId: v.id("artists"),
    // Allow bypassing Spotify eligibility check for users who have other proof
    bypassSpotifyCheck: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    claimId: v.optional(v.id("artistClaims")),
    status: v.optional(v.string()),
    message: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (!user) return { success: false, message: "Must be logged in" };

    // Check if user is admin - admins can claim any artist
    const isAdmin = user.role === "admin";

    // Only require Spotify for non-admins
    if (!isAdmin && !user.spotifyId) return { success: false, message: "Connect Spotify first" };

    // Validate artist exists
    const artist = await ctx.db.get(args.artistId);
    if (!artist) return { success: false, message: "Artist not found" };

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
      // If rejected, allow starting a new claim
    }

    // Enforce claim eligibility: artist must be in user's Spotify imports (followed or top artists)
    // BYPASS for admins - they can claim any artist for testing
    // Also bypass if explicitly requested (for users with other proof like email domain verification)
    const shouldBypass = isAdmin || args.bypassSpotifyCheck;

    if (!shouldBypass) {
      const spotifyRelation = await ctx.db
        .query("userSpotifyArtists")
        .withIndex("by_user_artist", (q) => q.eq("userId", user._id).eq("artistId", args.artistId))
        .first();

      if (!spotifyRelation) {
        return {
          success: false,
          status: "not_eligible",
          message: "This artist isn't in your Spotify library. Follow or listen to them on Spotify, then re-sync your account."
        };
      }
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

/**
 * Admin-only: Instantly claim an artist and grant full access.
 * This bypasses all verification steps for testing/demo purposes.
 * Uses real artist data - no fake data is created.
 */
export const adminQuickClaim = mutation({
  args: {
    artistId: v.id("artists"),
    role: v.optional(v.union(v.literal("owner"), v.literal("manager"), v.literal("viewer"))),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    artistId: v.optional(v.id("artists")),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (!user) return { success: false, message: "Must be logged in" };
    if (user.role !== "admin") return { success: false, message: "Admin access required" };

    const artist = await ctx.db.get(args.artistId);
    if (!artist) return { success: false, message: "Artist not found" };

    // Check if already a member
    const existingMember = await ctx.db
      .query("artistMembers")
      .withIndex("by_user_artist", (q) => q.eq("userId", user._id).eq("artistId", args.artistId))
      .first();

    if (existingMember) {
      return { success: true, message: `Already have ${existingMember.role} access`, artistId: args.artistId };
    }

    // Create or update any existing claim to approved
    const existingClaim = await ctx.db
      .query("artistClaims")
      .withIndex("by_user_artist", (q) => q.eq("userId", user._id).eq("artistId", args.artistId))
      .first();

    if (existingClaim) {
      await ctx.db.patch(existingClaim._id, {
        status: "approved",
        verificationMethod: "manual_review",
        verifiedAt: Date.now(),
        verificationProof: "Admin quick-claim bypass",
        reviewedAt: Date.now(),
        reviewNote: "Admin self-approved for testing",
      });
    } else {
      await ctx.db.insert("artistClaims", {
        userId: user._id,
        artistId: args.artistId,
        status: "approved",
        createdAt: Date.now(),
        spotifyUserId: user.spotifyId,
        verificationMethod: "manual_review",
        verifiedAt: Date.now(),
        verificationProof: "Admin quick-claim bypass",
        officialRole: "artist",
        emailVerified: true,
        reviewedAt: Date.now(),
        reviewNote: "Admin self-approved for testing",
      });
    }

    // Grant membership
    const memberRole = args.role ?? "owner";
    await ctx.db.insert("artistMembers", {
      userId: user._id,
      artistId: args.artistId,
      role: memberRole,
      createdAt: Date.now(),
    });

    return {
      success: true,
      message: `Granted ${memberRole} access to ${artist.name}`,
      artistId: args.artistId,
    };
  },
});

// ============================================================================
// STEP 2: EMAIL VERIFICATION
// ============================================================================

export const requestEmailVerification = action({
  args: { claimId: v.id("artistClaims"), email: v.string() },
  returns: v.object({ success: v.boolean(), message: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.email)) return { success: false, message: "Invalid email" };

    // Check auth and ownership + rate limits via mutation
    const checkResult = await ctx.runMutation(internalRef.artistClaims.checkEmailRateLimit, {
      claimId: args.claimId,
    });

    if (!checkResult.allowed) {
      return { success: false, message: checkResult.message };
    }

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

// Internal mutation to check rate limits and ownership before sending email
export const checkEmailRateLimit = internalMutation({
  args: { claimId: v.id("artistClaims") },
  returns: v.object({ allowed: v.boolean(), message: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    // Auth check
    const user = await getCurrentAppUser(ctx);
    if (!user) return { allowed: false, message: "Must be logged in" };

    // Claim ownership check
    const claim = await ctx.db.get(args.claimId);
    if (!claim) return { allowed: false, message: "Claim not found" };
    if (claim.userId !== user._id) return { allowed: false, message: "Not authorized" };

    // Artist exists check
    const artist = await ctx.db.get(claim.artistId);
    if (!artist) return { allowed: false, message: "Artist not found" };

    // Rate limit: cooldown between sends
    const lastSent = claim.verificationCodeSentAt ?? 0;
    if (Date.now() - lastSent < EMAIL_COOLDOWN_MS) {
      const waitSecs = Math.ceil((EMAIL_COOLDOWN_MS - (Date.now() - lastSent)) / 1000);
      return { allowed: false, message: `Please wait ${waitSecs}s before resending` };
    }

    // Rate limit: max sends per hour
    const emailSendCount = claim.emailSendCount ?? 0;
    const emailSendWindowStart = claim.emailSendWindowStart ?? 0;
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    if (emailSendWindowStart > oneHourAgo) {
      // Within the same hour window
      if (emailSendCount >= MAX_EMAIL_SENDS_PER_HOUR) {
        return { allowed: false, message: "Too many emails sent. Try again later." };
      }
      // Increment count
      await ctx.db.patch(args.claimId, { emailSendCount: emailSendCount + 1 });
    } else {
      // Reset window
      await ctx.db.patch(args.claimId, { emailSendCount: 1, emailSendWindowStart: Date.now() });
    }

    return { allowed: true };
  },
});

export const storeVerificationCode = internalMutation({
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
    // Auth + ownership check
    const { claim } = await requireClaimOwnership(ctx, args.claimId);

    const attempts = (claim.verificationCodeAttempts ?? 0) + 1;
    if (attempts > MAX_VERIFICATION_ATTEMPTS) {
      return { success: false, message: "Too many attempts. Request a new code." };
    }

    const sentAt = claim.verificationCodeSentAt ?? 0;
    if (Date.now() - sentAt > 15 * 60 * 1000) {
      return { success: false, message: "Code expired. Request a new code." };
    }

    if (claim.verificationCode !== args.code.trim()) {
      await ctx.db.patch(args.claimId, { verificationCodeAttempts: attempts });
      const remaining = MAX_VERIFICATION_ATTEMPTS - attempts;
      return { success: false, message: `Invalid code. ${remaining} attempt${remaining !== 1 ? 's' : ''} left.` };
    }

    await ctx.db.patch(args.claimId, {
      emailVerified: true,
      emailVerifiedAt: Date.now(),
      verificationCode: undefined,
      verificationCodeAttempts: 0,
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
    // Auth + ownership check
    const { claim } = await requireClaimOwnership(ctx, args.claimId);

    // Validate artist still exists
    const artist = await ctx.db.get(claim.artistId);
    if (!artist) return { success: false, message: "Artist not found" };

    if (!claim.emailVerified) return { success: false, message: "Verify email first" };

    // Don't allow updates to already-submitted claims
    if (claim.status === "pending" || claim.status === "approved" || claim.status === "rejected") {
      return { success: false, message: "Cannot update a submitted claim" };
    }

    // Generate website verification code if website is provided
    let websiteVerificationCode = claim.websiteVerificationCode;
    if (args.officialWebsite && !websiteVerificationCode) {
      websiteVerificationCode = generateWebsiteVerificationCode();
    }

    await ctx.db.patch(args.claimId, {
      officialRole: args.officialRole,
      organizationName: args.organizationName,
      officialWebsite: args.officialWebsite,
      socialLinks: args.socialLinks,
      additionalContext: args.additionalContext,
      websiteVerificationCode,
      websiteVerificationCodeGeneratedAt: websiteVerificationCode ? Date.now() : undefined,
    });
    return { success: true };
  },
});

// ============================================================================
// STEP 4.5: ENHANCED VERIFICATION METHODS
// ============================================================================

/**
 * Get the website verification code for a claim.
 * This code should be added to the artist's website as:
 *   <meta name="setlists-verify" content="SETLISTS-XXXXXXXX">
 * or as visible text on the page.
 */
export const getWebsiteVerificationCode = query({
  args: { claimId: v.id("artistClaims") },
  returns: v.object({
    code: v.optional(v.string()),
    website: v.optional(v.string()),
    instructions: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (!user) throw new Error("Must be logged in");

    const claim = await ctx.db.get(args.claimId);
    if (!claim || claim.userId !== user._id) throw new Error("Claim not found");

    if (!claim.websiteVerificationCode) {
      return {
        code: undefined,
        website: claim.officialWebsite,
        instructions: "Add a website in your claim details to get a verification code.",
      };
    }

    return {
      code: claim.websiteVerificationCode,
      website: claim.officialWebsite,
      instructions: `Add this code to your website in one of these ways:\n\n` +
        `1. Meta tag: <meta name="setlists-verify" content="${claim.websiteVerificationCode}">\n\n` +
        `2. Or add the text "${claim.websiteVerificationCode}" anywhere on your homepage.\n\n` +
        `Then click "Verify Website" to check.`,
    };
  },
});

/**
 * Check if the user's email domain matches the artist's official website domain.
 * This provides automatic verification for users with official email addresses.
 */
export const checkDomainMatch = mutation({
  args: { claimId: v.id("artistClaims") },
  returns: v.object({
    matched: v.boolean(),
    autoApproved: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const { user, claim } = await requireClaimOwnership(ctx, args.claimId);

    if (!claim.officialWebsite) {
      await ctx.db.patch(args.claimId, {
        domainVerificationStatus: "no_domain",
      });
      return { matched: false, autoApproved: false, message: "No website provided" };
    }

    if (!claim.verificationEmail) {
      return { matched: false, autoApproved: false, message: "Verify your email first" };
    }

    const websiteDomain = extractDomain(claim.officialWebsite);
    const emailDomain = claim.verificationEmail.split('@')[1]?.toLowerCase();

    if (!websiteDomain || !emailDomain) {
      await ctx.db.patch(args.claimId, {
        domainVerificationStatus: "no_domain",
      });
      return { matched: false, autoApproved: false, message: "Could not extract domains" };
    }

    const matched = doDomainsMatch(emailDomain, websiteDomain);

    if (matched) {
      // Auto-approve if domains match!
      await ctx.db.patch(args.claimId, {
        domainVerificationStatus: "matched",
        domainVerificationDetails: `${emailDomain} matches ${websiteDomain}`,
        status: "approved",
        verificationMethod: "email_domain",
        verifiedAt: Date.now(),
        verificationProof: `Email ${claim.verificationEmail} matches website ${claim.officialWebsite}`,
      });

      // Create artist membership
      const existingMember = await ctx.db
        .query("artistMembers")
        .withIndex("by_user_artist", (q) => q.eq("userId", user._id).eq("artistId", claim.artistId))
        .first();

      if (!existingMember) {
        let memberRole: "owner" | "manager" | "viewer" = "owner";
        if (claim.officialRole === "manager" || claim.officialRole === "agent") {
          memberRole = "manager";
        } else if (claim.officialRole !== "artist") {
          memberRole = "viewer";
        }

        await ctx.db.insert("artistMembers", {
          userId: user._id,
          artistId: claim.artistId,
          role: memberRole,
          createdAt: Date.now(),
        });
      }

      // Send approval email
      const artist = await ctx.db.get(claim.artistId);
      await ctx.scheduler.runAfter(0, internalRef.artistClaims.sendApprovalEmail, {
        email: claim.verificationEmail,
        artistName: artist?.name ?? "your artist",
      });

      return {
        matched: true,
        autoApproved: true,
        message: `Verified! Your email domain (${emailDomain}) matches the artist website (${websiteDomain}). Access granted!`
      };
    }

    await ctx.db.patch(args.claimId, {
      domainVerificationStatus: "no_match",
      domainVerificationDetails: `${emailDomain} does not match ${websiteDomain}`,
    });

    return {
      matched: false,
      autoApproved: false,
      message: `Email domain (${emailDomain}) doesn't match website domain (${websiteDomain}). Try website code verification or submit for manual review.`
    };
  },
});

/**
 * Verify the website contains the verification code.
 * This fetches the website and checks for the code in meta tags or page content.
 */
export const verifyWebsiteCode = action({
  args: { claimId: v.id("artistClaims") },
  returns: v.object({
    verified: v.boolean(),
    autoApproved: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // Check ownership and get claim data via internal mutation
    const checkResult = await ctx.runMutation(internalRef.artistClaims.checkWebsiteVerificationEligibility, {
      claimId: args.claimId,
    });

    if (!checkResult.eligible) {
      return { verified: false, autoApproved: false, message: checkResult.message };
    }

    const { websiteUrl, verificationCode } = checkResult;

    try {
      // Fetch the website
      const response = await fetch(websiteUrl, {
        headers: {
          'User-Agent': 'SetlistsVerificationBot/1.0 (+https://setlists.live)',
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        await ctx.runMutation(internalRef.artistClaims.recordWebsiteVerificationAttempt, {
          claimId: args.claimId,
          success: false,
        });
        return {
          verified: false,
          autoApproved: false,
          message: `Could not access website (${response.status}). Make sure it's publicly accessible.`
        };
      }

      const html = await response.text();

      // Check for the verification code in various places
      const codeFound =
        // Check meta tag
        html.includes(`content="${verificationCode}"`) ||
        html.includes(`content='${verificationCode}'`) ||
        // Check as plain text
        html.includes(verificationCode);

      if (codeFound) {
        // Auto-approve!
        await ctx.runMutation(internalRef.artistClaims.completeWebsiteVerification, {
          claimId: args.claimId,
          proofUrl: websiteUrl,
        });

        return {
          verified: true,
          autoApproved: true,
          message: `Verified! Found ${verificationCode} on ${websiteUrl}. Access granted!`
        };
      }

      await ctx.runMutation(internalRef.artistClaims.recordWebsiteVerificationAttempt, {
        claimId: args.claimId,
        success: false,
      });

      return {
        verified: false,
        autoApproved: false,
        message: `Code not found on ${websiteUrl}. Make sure you added "${verificationCode}" to your website.`
      };

    } catch (error) {
      await ctx.runMutation(internalRef.artistClaims.recordWebsiteVerificationAttempt, {
        claimId: args.claimId,
        success: false,
      });
      return {
        verified: false,
        autoApproved: false,
        message: `Could not access website: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },
});

// Internal mutation to check eligibility for website verification
export const checkWebsiteVerificationEligibility = internalMutation({
  args: { claimId: v.id("artistClaims") },
  returns: v.object({
    eligible: v.boolean(),
    message: v.string(),
    websiteUrl: v.optional(v.string()),
    verificationCode: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (!user) return { eligible: false, message: "Must be logged in" };

    const claim = await ctx.db.get(args.claimId);
    if (!claim) return { eligible: false, message: "Claim not found" };
    if (claim.userId !== user._id) return { eligible: false, message: "Not authorized" };

    if (claim.status === "approved") {
      return { eligible: false, message: "Claim already approved" };
    }

    if (!claim.officialWebsite) {
      return { eligible: false, message: "No website provided in claim" };
    }

    if (!claim.websiteVerificationCode) {
      return { eligible: false, message: "No verification code generated. Update your claim details first." };
    }

    // Rate limit: max 10 attempts, 1-minute cooldown
    const attempts = claim.websiteVerificationAttempts ?? 0;
    const lastAttempt = claim.websiteVerificationLastAttempt ?? 0;

    if (attempts >= 10) {
      return { eligible: false, message: "Too many verification attempts. Contact support." };
    }

    if (Date.now() - lastAttempt < 60_000) {
      const waitSecs = Math.ceil((60_000 - (Date.now() - lastAttempt)) / 1000);
      return { eligible: false, message: `Please wait ${waitSecs}s before trying again.` };
    }

    // Normalize URL
    let websiteUrl = claim.officialWebsite;
    if (!websiteUrl.startsWith('http')) {
      websiteUrl = `https://${websiteUrl}`;
    }

    return {
      eligible: true,
      message: "Ready to verify",
      websiteUrl,
      verificationCode: claim.websiteVerificationCode,
    };
  },
});

// Internal mutation to record verification attempt
export const recordWebsiteVerificationAttempt = internalMutation({
  args: { claimId: v.id("artistClaims"), success: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claim = await ctx.db.get(args.claimId);
    if (!claim) return null;

    await ctx.db.patch(args.claimId, {
      websiteVerificationAttempts: (claim.websiteVerificationAttempts ?? 0) + 1,
      websiteVerificationLastAttempt: Date.now(),
    });

    return null;
  },
});

// Internal mutation to complete website verification and grant access
export const completeWebsiteVerification = internalMutation({
  args: { claimId: v.id("artistClaims"), proofUrl: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claim = await ctx.db.get(args.claimId);
    if (!claim) return null;

    const user = await ctx.db.get(claim.userId);
    if (!user) return null;

    // Approve the claim
    await ctx.db.patch(args.claimId, {
      status: "approved",
      verificationMethod: "website_code",
      verifiedAt: Date.now(),
      verificationProof: args.proofUrl,
      websiteVerificationAttempts: (claim.websiteVerificationAttempts ?? 0) + 1,
      websiteVerificationLastAttempt: Date.now(),
    });

    // Create artist membership
    const existingMember = await ctx.db
      .query("artistMembers")
      .withIndex("by_user_artist", (q) => q.eq("userId", claim.userId).eq("artistId", claim.artistId))
      .first();

    if (!existingMember) {
      let memberRole: "owner" | "manager" | "viewer" = "owner";
      if (claim.officialRole === "manager" || claim.officialRole === "agent") {
        memberRole = "manager";
      } else if (claim.officialRole !== "artist") {
        memberRole = "viewer";
      }

      await ctx.db.insert("artistMembers", {
        userId: claim.userId,
        artistId: claim.artistId,
        role: memberRole,
        createdAt: Date.now(),
      });
    }

    // Send approval email
    const artist = await ctx.db.get(claim.artistId);
    if (claim.verificationEmail || user.email) {
      await ctx.scheduler.runAfter(0, internalRef.artistClaims.sendApprovalEmail, {
        email: claim.verificationEmail ?? user.email ?? "",
        artistName: artist?.name ?? "your artist",
      });
    }

    return null;
  },
});

/**
 * Get available verification methods and their status for a claim.
 */
export const getVerificationStatus = query({
  args: { claimId: v.id("artistClaims") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (!user) return null;

    const claim = await ctx.db.get(args.claimId);
    if (!claim || claim.userId !== user._id) return null;

    const artist = await ctx.db.get(claim.artistId);

    // Check domain match possibility
    let domainMatchPossible = false;
    let emailDomain = null;
    let websiteDomain = null;

    if (claim.verificationEmail && claim.officialWebsite) {
      emailDomain = claim.verificationEmail.split('@')[1]?.toLowerCase();
      websiteDomain = extractDomain(claim.officialWebsite);
      if (emailDomain && websiteDomain) {
        domainMatchPossible = doDomainsMatch(emailDomain, websiteDomain);
      }
    }

    return {
      claimId: claim._id,
      artistName: artist?.name,
      status: claim.status,

      // Email verification
      emailVerified: claim.emailVerified ?? false,
      verificationEmail: claim.verificationEmail,

      // Domain verification
      domainVerification: {
        available: !!claim.verificationEmail && !!claim.officialWebsite,
        status: claim.domainVerificationStatus,
        wouldMatch: domainMatchPossible,
        emailDomain,
        websiteDomain,
      },

      // Website code verification
      websiteVerification: {
        available: !!claim.officialWebsite && !!claim.websiteVerificationCode,
        code: claim.websiteVerificationCode,
        attempts: claim.websiteVerificationAttempts ?? 0,
        maxAttempts: 10,
      },

      // Final verification status
      verificationMethod: claim.verificationMethod,
      verifiedAt: claim.verifiedAt,

      // What's needed to proceed
      canSubmitForReview: claim.emailVerified && claim.officialRole && claim.status !== "pending" && claim.status !== "approved",
    };
  },
});

// ============================================================================
// STEP 5: SUBMIT
// ============================================================================

export const submitClaim = mutation({
  args: { claimId: v.id("artistClaims") },
  returns: v.object({ success: v.boolean(), message: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    // Auth + ownership check
    const { user, claim } = await requireClaimOwnership(ctx, args.claimId);

    // Validate artist exists
    const artist = await ctx.db.get(claim.artistId);
    if (!artist) return { success: false, message: "Artist not found" };

    // Check claim is in valid state for submission
    if (claim.status === "pending") {
      return { success: false, message: "Claim already submitted and pending review" };
    }
    if (claim.status === "approved") {
      return { success: false, message: "Claim already approved" };
    }
    if (claim.status === "rejected") {
      return { success: false, message: "This claim was rejected. Start a new claim." };
    }

    if (!claim.emailVerified) return { success: false, message: "Verify email first" };
    if (!claim.officialRole) return { success: false, message: "Select your role first" };

    await ctx.db.patch(args.claimId, { status: "pending", submittedAt: Date.now() });

    await ctx.scheduler.runAfter(0, internalRef.artistClaims.notifyOwnerOfClaim, {
      claimId: args.claimId,
      artistName: artist.name ?? "Unknown",
      userEmail: claim.verificationEmail ?? user?.email ?? "unknown",
      userName: user?.name ?? user?.username ?? "Unknown",
      role: claim.officialRole,
      organizationName: claim.organizationName,
    });

    return { success: true, message: "Submitted for review" };
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
