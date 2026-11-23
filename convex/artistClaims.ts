import { mutation, query, internalAction, action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./adminHelpers";
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
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return (100000 + (values[0] % 900000)).toString();
}

// This is a public proof marker rather than a secret. Deriving it from the
// unguessable Convex claim id keeps mutations deterministic and the code stable.
function generateWebsiteVerificationCode(claimId: string): string {
  const compact = claimId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `SETLISTS-${compact.slice(-12)}`;
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

function normalizeOfficialWebsite(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const parsed = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return undefined;
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function canEditClaim(claim: any): boolean {
  return claim.status === "draft" || claim.status === "verifying";
}

function hasVerifiedEmail(claim: any): boolean {
  return claim.emailVerified === true && !!claim.emailVerifiedAt &&
    !!claim.verificationEmail && !claim.verificationCode;
}

function publicClaim(claim: any) {
  // An applicant must prove receipt of the email, never read its code via a query.
  const { verificationCode: _code, ...safe } = claim;
  return safe;
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
    // Deprecated compatibility argument. Spotify never determines claim eligibility.
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
      .order("desc").first();

    if (existingClaim) {
      if (existingClaim.status === "draft" || existingClaim.status === "verifying") {
        return { success: true, claimId: existingClaim._id, status: existingClaim.status };
      }
      if (existingClaim.status === "pending") return { success: false, status: "pending", message: "Claim pending review" };
      if (existingClaim.status === "approved") return { success: false, status: "approved", message: "Already approved" };
      // If rejected, allow starting a new claim
    }

    // OAuth identifies a user, not an authorized artist representative.
    // Every applicant can submit evidence; only an admin can grant claim access.

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
      await ctx.runMutation(internalRef.artists.syncArtistPortalState, {
        artistId: args.artistId,
      });
      await ctx.scheduler.runAfter(0, internalRef.artistAutomation.runManagedArtistWarmup, {
        artistId: args.artistId,
        reason: "admin_quick_claim_existing_member",
        force: true,
      });
      return { success: true, message: `Already have ${existingMember.role} access`, artistId: args.artistId };
    }

    // Create or update any existing claim to approved
    const existingClaim = await ctx.db
      .query("artistClaims")
      .withIndex("by_user_artist", (q) => q.eq("userId", user._id).eq("artistId", args.artistId))
      .order("desc").first();

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
    await ctx.runMutation(internalRef.artists.syncArtistPortalState, {
      artistId: args.artistId,
    });
    await ctx.scheduler.runAfter(0, internalRef.artistAutomation.runManagedArtistWarmup, {
      artistId: args.artistId,
      reason: "admin_quick_claim",
      force: true,
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
    if (!emailRegex.test(args.email) || args.email.length > 320) {
      return { success: false, message: "Invalid email" };
    }

    const code = generateVerificationCode();
    const normalizedEmail = args.email.toLowerCase().trim();
    // Reserve the attempt, invalidate old evidence, and store the code atomically
    // before network I/O. Concurrent resends cannot overwrite a newer verification.
    await ctx.runMutation(internalRef.artistClaims.storeVerificationCode, {
      claimId: args.claimId, email: normalizedEmail, code,
    });
    const delivery = await ctx.runAction(internalRef.artistClaims.sendVerificationEmail, {
      email: normalizedEmail, code, claimId: args.claimId,
    });
    if (!delivery.sent) {
      await ctx.runMutation(internalRef.artistClaims.clearFailedVerificationCode, {
        claimId: args.claimId, code,
      });
      return { success: false, message: delivery.message || "Verification email could not be sent" };
    }

    return { success: true, message: "Code sent" };
  },
});

export const storeVerificationCode = internalMutation({
  args: { claimId: v.id("artistClaims"), email: v.string(), code: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { claim } = await requireClaimOwnership(ctx, args.claimId);
    if (!canEditClaim(claim)) throw new Error("Cannot change a submitted claim");
    const now = Date.now();
    if (now - (claim.verificationCodeSentAt ?? 0) < EMAIL_COOLDOWN_MS) {
      throw new Error("Please wait one minute before requesting another code");
    }
    const sameWindow = now - (claim.emailSendWindowStart ?? 0) < 60 * 60 * 1000;
    const sends = sameWindow ? claim.emailSendCount ?? 0 : 0;
    if (sends >= MAX_EMAIL_SENDS_PER_HOUR) throw new Error("Too many emails sent. Try again later.");
    await ctx.db.patch(args.claimId, {
      verificationEmail: args.email,
      verificationCode: args.code,
      verificationCodeSentAt: now,
      verificationCodeAttempts: 0,
      emailSendCount: sends + 1,
      emailSendWindowStart: sameWindow ? claim.emailSendWindowStart : now,
      emailVerified: false,
      emailVerifiedAt: undefined,
      domainVerificationStatus: undefined,
      domainVerificationDetails: undefined,
      trustedDomainMatched: false,
      verificationMethod: undefined,
      verificationProof: undefined,
      verifiedAt: undefined,
      websiteVerificationStatus: undefined,
      verificationRevision: (claim.verificationRevision ?? 0) + 1,
      status: "verifying",
    });
    return null;
  },
});

export const clearFailedVerificationCode = internalMutation({
  args: { claimId: v.id("artistClaims"), code: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claim = await ctx.db.get(args.claimId);
    if (claim && canEditClaim(claim) && claim.verificationCode === args.code) {
      await ctx.db.patch(args.claimId, { verificationCode: undefined });
    }
    return null;
  },
});

export const sendVerificationEmail = internalAction({
  args: { email: v.string(), code: v.string(), claimId: v.id("artistClaims") },
  returns: v.object({ sent: v.boolean(), message: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) return { sent: false, message: "Email delivery is not configured" };
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(20_000),
        headers: { "Authorization": "Bearer " + resendApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Verification <noreply@setlists.live>",
          to: args.email,
          subject: "Your verification code: " + args.code,
          html: "<div style='font-family:sans-serif;max-width:400px;margin:0 auto;padding:40px 20px;'><h1 style='font-size:24px;margin-bottom:24px;'>Verify your email</h1><p style='color:#666;margin-bottom:32px;'>Enter this code:</p><div style='background:#f4f4f5;border-radius:12px;padding:24px;text-align:center;'><span style='font-size:36px;font-weight:700;letter-spacing:8px;'>" + args.code + "</span></div><p style='color:#999;font-size:12px;margin-top:32px;'>Expires in 15 minutes.</p></div>",
        }),
      });
      if (!response.ok) {
        console.error("Verification email rejected", { status: response.status, claimId: args.claimId });
        return { sent: false, message: "Email provider rejected the request" };
      }
      return { sent: true };
    } catch (error) {
      console.error("Verification email failed", {
        claimId: args.claimId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return { sent: false, message: "Email provider is temporarily unavailable" };
    }
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

    if (!canEditClaim(claim) || !claim.verificationCode || !/^\d{6}$/.test(args.code.trim())) {
      return { success: false, message: "Request a verification code first" };
    }

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

    if (!hasVerifiedEmail(claim)) return { success: false, message: "Verify email first" };

    if ((args.organizationName?.length ?? 0) > 160) {
      return { success: false, message: "Organization name is too long" };
    }
    if ((args.officialWebsite?.length ?? 0) > 500) {
      return { success: false, message: "Official website URL is too long" };
    }
    if ((args.socialLinks?.length ?? 0) > 10 || args.socialLinks?.some((link) => link.length > 500)) {
      return { success: false, message: "Add no more than 10 valid social links" };
    }
    if ((args.additionalContext?.length ?? 0) > 4_000) {
      return { success: false, message: "Additional context must be under 4,000 characters" };
    }

    // Don't allow updates to already-submitted claims
    if (claim.status === "pending" || claim.status === "approved" || claim.status === "rejected") {
      return { success: false, message: "Cannot update a submitted claim" };
    }

    const officialWebsite = normalizeOfficialWebsite(args.officialWebsite);
    if (args.officialWebsite && !officialWebsite) {
      return { success: false, message: "Official website must be a valid HTTPS URL" };
    }

    const socialLinks = args.socialLinks?.map((link) => link.trim()).filter(Boolean);
    if (socialLinks?.some((link) => {
      try {
        return new URL(link).protocol !== "https:";
      } catch {
        return true;
      }
    })) {
      return { success: false, message: "Social links must be valid HTTPS URLs" };
    }

    // Generate a stable website proof marker if a website is provided.
    let websiteVerificationCode = claim.websiteVerificationCode;
    if (officialWebsite && !websiteVerificationCode) {
      websiteVerificationCode = generateWebsiteVerificationCode(String(args.claimId));
    }

    await ctx.db.patch(args.claimId, {
      officialRole: args.officialRole,
      organizationName: args.organizationName,
      officialWebsite,
      socialLinks,
      additionalContext: args.additionalContext,
      websiteVerificationCode,
      websiteVerificationCodeGeneratedAt: websiteVerificationCode ? Date.now() : undefined,
      websiteVerificationStatus: websiteVerificationCode ? "pending" : undefined,
      verificationRevision: (claim.verificationRevision ?? 0) + 1,
      domainVerificationStatus: undefined,
      domainVerificationDetails: undefined,
      trustedDomainMatched: false,
      verificationMethod: undefined,
      verificationProof: undefined,
      verifiedAt: undefined,
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
  returns: v.object({ matched: v.boolean(), autoApproved: v.boolean(), message: v.string() }),
  handler: async (ctx, args) => {
    const { claim } = await requireClaimOwnership(ctx, args.claimId);
    if (!canEditClaim(claim)) throw new Error("Cannot change a submitted claim");
    if (!hasVerifiedEmail(claim)) throw new Error("Verify your current email first");
    const websiteDomain = extractDomain(claim.officialWebsite);
    const emailDomain = claim.verificationEmail.split("@")[1]?.toLowerCase();
    const matched = !!websiteDomain && !!emailDomain && doDomainsMatch(emailDomain, websiteDomain);
    await ctx.db.patch(args.claimId, {
      domainVerificationStatus: matched ? "matched" : websiteDomain ? "no_match" : "no_domain",
      domainVerificationDetails: matched ? "Verified email matches submitted website" : "Domains do not match",
      trustedDomainMatched: false,
    });
    return {
      matched, autoApproved: false,
      message: matched
        ? "Email and website domains match. This evidence supports your manual review; it does not grant access."
        : "No domain match. You can still submit other evidence for manual review.",
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

    const { websiteUrl, verificationCode, revision } = checkResult;
    if (!websiteUrl || !verificationCode || revision === undefined) throw new Error("Verification is not ready");

    try {
      // The Node action pins a public DNS result, blocks private/reserved
      // networks, limits redirects/size/time, and accepts HTTPS HTML only.
      const response = await ctx.runAction(internalRef.artistWebsiteVerification.fetchPage, {
        websiteUrl,
      });

      if (!response.ok || !response.html) {
        await ctx.runMutation(internalRef.artistClaims.recordWebsiteVerificationAttempt, {
          claimId: args.claimId,
          success: false,
          status: "error",
          expectedRevision: revision,
        });
        return {
          verified: false,
          autoApproved: false,
          message: response.status
            ? `Could not access the website (${response.status}). Make sure it is publicly accessible.`
            : response.error || "Could not safely access the website.",
        };
      }

      const html = response.html;

      // Check for the verification code in various places
      const codeFound =
        // Check meta tag
        html.includes(`content="${verificationCode}"`) ||
        html.includes(`content='${verificationCode}'`) ||
        // Check as plain text
        html.includes(verificationCode);

      if (codeFound) {
        const completion = await ctx.runMutation(internalRef.artistClaims.completeWebsiteVerification, {
          claimId: args.claimId,
          proofUrl: response.finalUrl || websiteUrl,
          expectedWebsite: websiteUrl,
          expectedRevision: revision,
        });

        return {
          verified: completion.verified,
          autoApproved: false,
          message: completion.verified
            ? "Website control verified and added to your evidence. Submit the claim for review."
            : "The claim changed while checking the website. Please verify again."
        };
      }

      await ctx.runMutation(internalRef.artistClaims.recordWebsiteVerificationAttempt, {
        claimId: args.claimId,
        success: false,
        status: "not_found",
        expectedRevision: revision,
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
        status: "error",
        expectedRevision: revision,
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
    revision: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (!user) return { eligible: false, message: "Must be logged in" };

    const claim = await ctx.db.get(args.claimId);
    if (!claim) return { eligible: false, message: "Claim not found" };
    if (claim.userId !== user._id) return { eligible: false, message: "Not authorized" };

    if (!canEditClaim(claim) || !hasVerifiedEmail(claim)) {
      return { eligible: false, message: "Verify your email and use an editable claim" };
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

    // Reserve rate-limit capacity before the external request.
    await ctx.db.patch(args.claimId, {
      websiteVerificationAttempts: attempts + 1,
      websiteVerificationLastAttempt: Date.now(),
    });
    return {
      eligible: true,
      message: "Ready to verify",
      websiteUrl,
      verificationCode: claim.websiteVerificationCode,
      revision: claim.verificationRevision ?? 0,
    };
  },
});

// Internal mutation to record verification attempt
export const recordWebsiteVerificationAttempt = internalMutation({
  args: {
    claimId: v.id("artistClaims"),
    success: v.boolean(),
    expectedRevision: v.number(),
    status: v.optional(v.union(v.literal("matched"), v.literal("not_found"), v.literal("error"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claim = await ctx.db.get(args.claimId);
    if (!claim || !canEditClaim(claim) || (claim.verificationRevision ?? 0) !== args.expectedRevision) return null;

    await ctx.db.patch(args.claimId, {
      websiteVerificationStatus: args.status ?? (args.success ? "matched" : "not_found"),
    });

    return null;
  },
});

// Record evidence only. Approval is exclusively an admin decision.
export const completeWebsiteVerification = internalMutation({
  args: {
    claimId: v.id("artistClaims"), proofUrl: v.string(),
    expectedWebsite: v.string(), expectedRevision: v.number(),
  },
  returns: v.object({ verified: v.boolean(), autoApproved: v.boolean() }),
  handler: async (ctx, args) => {
    const claim = await ctx.db.get(args.claimId);
    if (!claim || !canEditClaim(claim) || !hasVerifiedEmail(claim) ||
      (claim.verificationRevision ?? 0) !== args.expectedRevision ||
      claim.officialWebsite !== args.expectedWebsite ||
      extractDomain(args.proofUrl) !== extractDomain(claim.officialWebsite)) {
      return { verified: false, autoApproved: false };
    }
    await ctx.db.patch(args.claimId, {
      verificationMethod: "website_code",
      verifiedAt: Date.now(),
      verificationProof: args.proofUrl,
      websiteVerificationStatus: "matched",
      trustedDomainMatched: false,
    });
    return { verified: true, autoApproved: false };
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

    const trustedDomain = websiteDomain
      ? await ctx.db
          .query("artistTrustedDomains")
          .withIndex("by_artist_domain", (q) =>
            q.eq("artistId", claim.artistId).eq("domain", websiteDomain as string),
          )
          .first()
      : null;

    return {
      claimId: claim._id,
      artistName: artist?.name,
      status: claim.status,

      // Email verification
      emailVerified: hasVerifiedEmail(claim),
      verificationEmail: claim.verificationEmail,

      // Domain verification
      domainVerification: {
        available: !!claim.verificationEmail && !!claim.officialWebsite,
        status: claim.domainVerificationStatus,
        wouldMatch: domainMatchPossible,
        trustedForArtist: trustedDomain?.status === "active",
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
      canSubmitForReview: hasVerifiedEmail(claim) && !!claim.officialRole && canEditClaim(claim),
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

    if (!hasVerifiedEmail(claim)) return { success: false, message: "Verify email first" };
    if (!claim.officialRole) return { success: false, message: "Select your role first" };

    await ctx.db.patch(args.claimId, { status: "pending", submittedAt: Date.now() });

    await ctx.runMutation(internalRef.artistNotifications.enqueue, { claimId: args.claimId, kind: "review_needed" });
    await ctx.runMutation(internalRef.artistNotifications.enqueue, { claimId: args.claimId, kind: "submitted" });

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

    const existingMember = await ctx.db.query("artistMembers").withIndex("by_user_artist", (q) => q.eq("userId", user._id).eq("artistId", args.artistId)).first();
    if (existingMember) return { status: "already_member", artistId: args.artistId };

    const existingClaim = await ctx.db.query("artistClaims").withIndex("by_user_artist", (q) => q.eq("userId", user._id).eq("artistId", args.artistId)).order("desc").first();
    if (existingClaim && existingClaim.status !== "rejected") return { status: existingClaim.status, claimId: existingClaim._id };

    const artist = await ctx.db.get(args.artistId);
    if (!artist) throw new Error("Artist not found");
    const claimId = await ctx.db.insert("artistClaims", {
      userId: user._id, artistId: args.artistId, status: "draft",
      createdAt: Date.now(), spotifyUserId: user.spotifyId,
      evidence: args.evidence?.slice(0, 10).map((item) => ({
        type: item.type.slice(0, 80), value: item.value.slice(0, 2000),
      })),
    });

    return { status: "draft", claimId };
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
    return { ...publicClaim(claim), artist };
  },
});

export const getMyClaims = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    if (!user) return [];
    const claims = await ctx.db.query("artistClaims").withIndex("by_user", (q) => q.eq("userId", user._id)).order("desc").take(100);
    return Promise.all(claims.map(async (c: any) => ({ ...publicClaim(c), artist: await ctx.db.get(c.artistId) })));
  },
});

export const listPending = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const pending = await ctx.db.query("artistClaims").withIndex("by_status", (q) => q.eq("status", "pending")).order("desc").take(args.limit ?? 50);
    return Promise.all(pending.map(async (c: any) => ({ ...publicClaim(c), artist: await ctx.db.get(c.artistId), user: await ctx.db.get(c.userId) })));
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
  args: {
    claimId: v.id("artistClaims"),
    role: v.optional(v.union(v.literal("owner"), v.literal("manager"), v.literal("viewer"))),
    note: v.optional(v.string()),
    trustWebsiteDomain: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const adminUserId = await requireAdmin(ctx);
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Not found");
    if (claim.status !== "pending") return { success: true, status: claim.status };

    if (!args.role) throw new Error("Select an access role explicitly");
    if (!hasVerifiedEmail(claim) || !claim.officialRole) {
      throw new Error("The applicant must verify their email and complete their claim details");
    }
    if (!await ctx.db.get(claim.artistId) || !await ctx.db.get(claim.userId)) {
      throw new Error("Artist or applicant no longer exists");
    }
    const memberRole = args.role;

    const existing = await ctx.db.query("artistMembers").withIndex("by_user_artist", (q) => q.eq("userId", claim.userId).eq("artistId", claim.artistId)).first();
    if (existing) await ctx.db.patch(existing._id, { role: memberRole });
    else await ctx.db.insert("artistMembers", { userId: claim.userId, artistId: claim.artistId, role: memberRole, createdAt: Date.now() });
    await ctx.runMutation(internalRef.artists.syncArtistPortalState, {
      artistId: claim.artistId,
    });

    let trustedDomainMatched = claim.trustedDomainMatched ?? false;
    if (args.trustWebsiteDomain && claim.officialWebsite) {
      const domain = extractDomain(claim.officialWebsite);
      if (!domain) throw new Error("The claim does not contain a valid website domain");
      const existingDomain = await ctx.db
        .query("artistTrustedDomains")
        .withIndex("by_artist_domain", (q) =>
          q.eq("artistId", claim.artistId).eq("domain", domain),
        )
        .first();
      const trustedDomainData = {
        websiteUrl: claim.officialWebsite,
        status: "active" as const,
        source: "manual_admin" as const,
        verifiedAt: Date.now(),
        verifiedBy: adminUserId,
      };
      if (existingDomain) await ctx.db.patch(existingDomain._id, trustedDomainData);
      else {
        await ctx.db.insert("artistTrustedDomains", {
          artistId: claim.artistId,
          domain,
          ...trustedDomainData,
        });
      }
      trustedDomainMatched = true;
    }

    await ctx.db.patch(args.claimId, {
      status: "approved",
      verificationMethod: "manual_review",
      verifiedAt: Date.now(),
      trustedDomainMatched,
      reviewedAt: Date.now(),
      reviewedBy: adminUserId,
      reviewNote: args.note,
    });

    const user = await ctx.db.get(claim.userId);
    const artist = await ctx.db.get(claim.artistId);
    if (claim.verificationEmail || user?.email) {
      await ctx.runMutation(internalRef.artistNotifications.enqueue, { claimId: args.claimId, kind: "approved" });
    }
    await ctx.scheduler.runAfter(0, internalRef.artistAutomation.runManagedArtistWarmup, {
      artistId: claim.artistId,
      reason: "manual_approval",
      force: true,
      ...(user?.authId ? { analyticsDistinctId: user.authId } : {}),
    });
    if (user) {
      await ctx.scheduler.runAfter(0, internalRef.analytics.capture, {
        event: "artist_claim_approved",
        distinctId: user.authId,
        insertId: `artist_claim_approved:${args.claimId}:manual_review`,
        properties: {
          artist_id: claim.artistId,
          claim_id: args.claimId,
          verification_method: "manual_review",
          approval_type: "manual",
          approved_role: memberRole,
        },
      });
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
      await ctx.runMutation(internalRef.artistNotifications.enqueue, { claimId: args.claimId, kind: "rejected" });
    }

    return { success: true };
  },
});

// ============================================================================
// LEGACY EMAIL HANDLERS — retained for already-scheduled jobs. New transitions use artistNotifications.
// ============================================================================

export const notifyOwnerOfClaim = internalAction({
  args: { claimId: v.id("artistClaims"), artistName: v.string(), userEmail: v.string(), userName: v.string(), role: v.optional(v.string()), organizationName: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const adminUrl = (process.env.SITE_URL || "https://setlists.live") + "/admin";

    const resendApiKey = process.env.RESEND_API_KEY;
    const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;
    if (resendApiKey && ownerEmail) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": "Bearer " + resendApiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Claims <noreply@setlists.live>",
            to: ownerEmail,
            subject: "New artist claim: " + args.artistName,
            html: "<h2>New Artist Claim</h2><p><strong>" + escapeHtml(args.artistName) + "</strong></p><p>" + escapeHtml(args.userName) + " &lt;" + escapeHtml(args.userEmail) + "&gt;</p><p>Role: " + escapeHtml(args.role || "N/A") + "</p><p>Org: " + escapeHtml(args.organizationName || "N/A") + "</p><p><a href='" + escapeHtml(adminUrl) + "' style='background:#111827;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;'>Review claim</a></p>",
          }),
        });
        if (!response.ok) console.error("Claim notification email rejected", { status: response.status, claimId: args.claimId });
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
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(20_000),
        headers: { "Authorization": "Bearer " + resendApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Verification <noreply@setlists.live>",
          to: args.email,
          subject: "Approved: " + args.artistName,
          html: "<h1>Your artist access is ready</h1><p>Your claim for <strong>" + escapeHtml(args.artistName) + "</strong> was approved.</p><p><a href='" + escapeHtml(process.env.SITE_URL || "https://www.setlists.live") + "/for-artists' style='background:#111827;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;'>Open dashboard</a></p>",
        }),
      });
      if (!response.ok) console.error("Approval email rejected", { status: response.status });
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
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(20_000),
        headers: { "Authorization": "Bearer " + resendApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Verification <noreply@setlists.live>",
          to: args.email,
          subject: "Update on " + args.artistName + " claim",
          html: "<h1>Claim not approved</h1><p>We couldn't verify your claim for <strong>" + escapeHtml(args.artistName) + "</strong>.</p>" + (args.reason ? "<p><strong>Reason:</strong> " + escapeHtml(args.reason) + "</p>" : "") + "<p>Reply to this email with more information if you think this is an error.</p>",
        }),
      });
      if (!response.ok) console.error("Claim decision email rejected", { status: response.status });
    } catch (e) { console.error(e); }
    return null;
  },
});
