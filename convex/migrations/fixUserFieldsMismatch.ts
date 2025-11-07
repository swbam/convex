/**
 * Migration: Fix User Fields Mismatch
 * 
 * Problem: Users created via different paths (webhook vs AuthGuard)
 * have inconsistent fields (missing preferences, avatar, spotifyId)
 * 
 * This migration ensures ALL users have consistent, complete data
 */

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const fixUserFieldsMismatch = internalMutation({
  args: {},
  returns: v.object({
    total: v.number(),
    fixed: v.number(),
    errors: v.number(),
  }),
  handler: async (ctx) => {
    console.log("🔧 Starting user fields mismatch fix migration...");
    
    const users = await ctx.db.query("users").collect();
    let fixed = 0;
    let errors = 0;
    
    for (const user of users) {
      try {
        const updates: any = {};
        let needsUpdate = false;
        
        // 1. Ensure preferences exists
        if (!user.preferences) {
          updates.preferences = {
            emailNotifications: true,
            favoriteGenres: [],
          };
          needsUpdate = true;
          console.log(`  → Adding preferences to user ${user._id}`);
        }
        
        // 2. Ensure username exists (fallback generation)
        if (!user.username) {
          const username = user.email?.split('@')[0] || 
                          user.name?.toLowerCase().replace(/\s+/g, '-') ||
                          `user-${user._id.slice(-6)}`;
          updates.username = username;
          needsUpdate = true;
          console.log(`  → Adding username to user ${user._id}: ${username}`);
        }
        
        // 3. Ensure role exists (default to user)
        if (!user.role) {
          updates.role = "user";
          needsUpdate = true;
          console.log(`  → Adding role to user ${user._id}`);
        }
        
        // 4. Apply updates if needed
        if (needsUpdate) {
          await ctx.db.patch(user._id, updates);
          fixed++;
        }
      } catch (error) {
        console.error(`❌ Failed to fix user ${user._id}:`, error);
        errors++;
      }
    }
    
    console.log(`✅ Migration complete: ${fixed} users fixed, ${errors} errors`);
    
    return {
      total: users.length,
      fixed,
      errors,
    };
  },
});

