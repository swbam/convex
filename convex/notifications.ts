'use node';

import { action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const EMAIL_FROM = process.env.EMAIL_FROM || "Setlists Live <no-reply@setlists.live>";

type Recipient = { email: string; name?: string | null };

async function sendViaResend(to: Recipient, subject: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [to.email],
      subject,
      text,
    }),
  });

  return res.ok;
}

async function sendViaSendGrid(to: Recipient, subject: string, text: string) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return false;

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to.email, name: to.name || undefined }] }],
      from: { email: EMAIL_FROM },
      subject,
      content: [{ type: "text/plain", value: text }],
    }),
  });

  return res.ok;
}

async function dispatchEmail(to: Recipient, subject: string, text: string) {
  if (process.env.RESEND_API_KEY) {
    return await sendViaResend(to, subject, text);
  }
  if (process.env.SENDGRID_API_KEY) {
    return await sendViaSendGrid(to, subject, text);
  }
  console.warn("🚫 No email provider configured (RESEND_API_KEY or SENDGRID_API_KEY)");
  return false;
}

export const getRecipientsForSetlist = internalQuery({
  args: {
    setlistId: v.id("setlists"),
    showId: v.id("shows"),
  },
  returns: v.object({
    setlist: v.union(v.any(), v.null()),
    show: v.union(v.any(), v.null()),
    artist: v.union(v.any(), v.null()),
    venue: v.union(v.any(), v.null()),
    recipients: v.array(v.object({ email: v.string(), name: v.optional(v.string()) })),
  }),
  handler: async (ctx, args) => {
    const setlist = await ctx.db.get(args.setlistId);
    const show = await ctx.db.get(args.showId);
    if (!setlist || !show) {
      return { setlist: null, show: null, artist: null, venue: null, recipients: [] };
    }

    const [artist, venue] = await Promise.all([
      ctx.db.get(show.artistId as Id<"artists">),
      ctx.db.get(show.venueId as Id<"venues">),
    ]);

    const votes = await ctx.db
      .query("votes")
      .withIndex("by_setlist", (q) => q.eq("setlistId", args.setlistId))
      .collect();

    const uniqueUserIds = Array.from(new Set(votes.map((v) => v.userId)));
    const recipients: Recipient[] = [];

    for (const userId of uniqueUserIds) {
      const user = await ctx.db.get(userId as Id<"users">);
      const wantsEmail = user?.preferences?.emailNotifications ?? false;
      if (user?.email && wantsEmail) {
        recipients.push({ email: user.email, name: user.name ?? user.username });
      }
    }

    return { setlist, show, artist, venue, recipients };
  },
});

export const markSetlistNotificationSent = internalMutation({
  args: { setlistId: v.id("setlists"), timestamp: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.setlistId, {
      notificationSentAt: args.timestamp,
      notificationScheduledAt: args.timestamp,
    });
    return null;
  },
});

export const sendSetlistNotifications = action({
  args: {
    setlistId: v.id("setlists"),
    showId: v.id("shows"),
  },
  returns: v.object({
    success: v.boolean(),
    sent: v.number(),
    skipped: v.number(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const { setlist, show, artist, venue, recipients } = await ctx.runQuery(
      internal.notifications.getRecipientsForSetlist,
      args,
    );

    if (!setlist || !show) {
      return { success: false, sent: 0, skipped: 0, reason: "Setlist or show missing" };
    }

    if (!process.env.RESEND_API_KEY && !process.env.SENDGRID_API_KEY) {
      return {
        success: false,
        sent: 0,
        skipped: recipients.length,
        reason: "No email provider configured",
      };
    }

    if (recipients.length === 0) {
      await ctx.runMutation(internal.notifications.markSetlistNotificationSent, {
        setlistId: args.setlistId,
        timestamp: Date.now(),
      });
      return { success: true, sent: 0, skipped: 0 };
    }

    const subject = `${artist?.name || "An artist"} setlist is verified`;
    const text = `A setlist you voted on is now verified/completed:\n\nArtist: ${
      artist?.name || "Unknown"
    }\nDate: ${show?.date || "Unknown"}\nVenue: ${
      venue?.name || show?.venueId || "Unknown venue"
    }\n\nThanks for participating!`;

    let sent = 0;
    for (const recipient of recipients) {
      const ok = await dispatchEmail(recipient, subject, text);
      if (ok) sent += 1;
    }

    await ctx.runMutation(internal.notifications.markSetlistNotificationSent, {
      setlistId: args.setlistId,
      timestamp: Date.now(),
    });

    return {
      success: true,
      sent,
      skipped: recipients.length - sent,
    };
  },
});
