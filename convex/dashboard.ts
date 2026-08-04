import { query } from "./_generated/server";

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    // Bounded reads: full-table .collect() exceeds Convex's document/byte read
    // limits at prod scale (shows ~45k rows; setlists is large too). Counts are
    // capped — read "5000" as "5000+".
    const COUNT_CAP = 5000;
    const [artists, shows, setlists, users] = await Promise.all([
      ctx.db.query("artists").take(3000),
      ctx.db.query("shows").withIndex("by_status", (q) => q.eq("status", "upcoming")).take(COUNT_CAP),
      ctx.db.query("setlists").take(COUNT_CAP),
      ctx.db.query("users").take(COUNT_CAP),
    ]);

    return {
      totalArtists: artists.length,
      totalShows: shows.length,
      totalSetlists: setlists.length,
      activeUsers: users.length,
    };
  },
});
