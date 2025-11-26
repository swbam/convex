// Notifications - DISABLED
// Email notifications were partially implemented but are not being used.
// These functions are kept as no-ops to prevent breaking any scheduler calls.

import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// No-op query - returns empty recipients
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
  handler: async () => {
    // Notifications disabled
      return { setlist: null, show: null, artist: null, venue: null, recipients: [] };
  },
});

// No-op mutation
export const markSetlistNotificationSent = internalMutation({
  args: { setlistId: v.id("setlists"), timestamp: v.number() },
  returns: v.null(),
  handler: async () => {
    // Notifications disabled - no-op
    return null;
  },
});

// No-op action - immediately returns success without sending anything
export const sendSetlistNotifications = internalAction({
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
  handler: async () => {
    // Notifications disabled - no-op
    return { success: true, sent: 0, skipped: 0, reason: "Notifications disabled" };
  },
});
