"use node";

import { createHash, randomBytes } from "node:crypto";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { internalRef } from "./adminHelpers";

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const hashToken = (token: string) =>
  createHash("sha256").update(token, "utf8").digest("hex");

const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (character) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return replacements[character];
  });

const siteUrl = () =>
  (process.env.SITE_URL || "https://www.setlists.live").replace(/\/$/, "");

const emailHeader = (value: string) => value.replace(/[\r\n]+/g, " ").trim();

async function sendInviteEmail(args: {
  to: string;
  artistName: string;
  invitedByName: string;
  role: "manager" | "viewer";
  inviteUrl: string;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return "not_configured" as const;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "setlists.live <noreply@setlists.live>",
      to: args.to,
      subject: emailHeader(`Join ${args.artistName} on setlists.live`).slice(0, 180),
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:36px 20px;color:#111827">
          <p style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">Artist team invitation</p>
          <h1 style="font-size:28px;line-height:1.15;margin:12px 0 16px">Join ${escapeHtml(args.artistName)} on setlists.live</h1>
          <p style="font-size:16px;line-height:1.6;color:#4b5563">${escapeHtml(args.invitedByName)} invited you to view tour demand as a ${escapeHtml(args.role)}.</p>
          <p style="margin:28px 0"><a href="${escapeHtml(args.inviteUrl)}" style="display:inline-block;background:#111827;color:#fff;padding:13px 20px;border-radius:10px;text-decoration:none;font-weight:600">Accept invitation</a></p>
          <p style="font-size:13px;line-height:1.5;color:#6b7280">This private link expires in 7 days and only works for the email address that received it.</p>
        </div>`,
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Resend rejected the invitation (${response.status}): ${detail}`);
  }
  return "sent" as const;
}

export const createInvite = action({
  args: {
    artistId: v.id("artists"),
    email: v.string(),
    role: v.union(v.literal("manager"), v.literal("viewer")),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.optional(v.string()),
    inviteUrl: v.optional(v.string()),
    emailSent: v.optional(v.boolean()),
  }),
  handler: async (ctx, args) => {
    const token = randomBytes(32).toString("base64url");
    const now = Date.now();
    const prepared = await ctx.runMutation(internalRef.artistAccess.prepareInvite, {
      artistId: args.artistId,
      email: args.email,
      role: args.role,
      tokenHash: hashToken(token),
      now,
      expiresAt: now + INVITE_EXPIRY_MS,
    });

    if (!prepared.success || !prepared.inviteId || !prepared.artistName) {
      return { success: false, message: prepared.message || "Could not create invitation" };
    }

    const inviteUrl = `${siteUrl()}/for-artists/invite/${token}`;
    let deliveryStatus: "sent" | "not_configured" | "failed" = "failed";
    try {
      deliveryStatus = await sendInviteEmail({
        to: args.email.trim().toLowerCase(),
        artistName: prepared.artistName,
        invitedByName: prepared.invitedByName || "An artist team owner",
        role: args.role,
        inviteUrl,
      });
    } catch (error) {
      console.error("Artist invitation email failed", {
        inviteId: prepared.inviteId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    await ctx.runMutation(internalRef.artistAccess.recordInviteDelivery, {
      inviteId: prepared.inviteId,
      deliveryStatus,
    });

    return {
      success: true,
      inviteUrl,
      emailSent: deliveryStatus === "sent",
      message:
        deliveryStatus === "sent"
          ? "Invitation emailed"
          : "Invitation created. Copy the secure link to send it manually.",
    };
  },
});

export const getInvitePreview = action({
  args: { token: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    if (args.token.length < 32 || args.token.length > 128) return null;
    return await ctx.runQuery(internalRef.artistAccess.getInvitePreviewByHash, {
      tokenHash: hashToken(args.token),
    });
  },
});

export const acceptInvite = action({
  args: { token: v.string() },
  returns: v.object({
    success: v.boolean(),
    message: v.optional(v.string()),
    artistId: v.optional(v.id("artists")),
    artistName: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    if (args.token.length < 32 || args.token.length > 128) {
      return { success: false, message: "Invalid invitation link" };
    }
    return await ctx.runMutation(internalRef.artistAccess.acceptInviteByHash, {
      tokenHash: hashToken(args.token),
    });
  },
});
