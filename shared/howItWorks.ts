// Used by both the public page and its readable initial HTML.
export const HOW_IT_WORKS = {
  title: "How it works",
  intro: "Find your show. Pick your songs. See what was played.",
  description: "A setlist is more than a list of songs. It’s the deep cut you’ve waited years to hear, the opener that gets everyone moving, and the encore you take home.",
  steps: [
    { title: "Find your show", description: "Search for an artist, explore their tour dates, and open the show you’re going to. Every show has its own setlist and fan requests.", link: "Explore shows", href: "/shows" },
    { title: "Request a song. Cast your vote.", description: "Browse the artist’s available song catalog, add a favorite, or upvote a song already on the list. Share the voting link with friends going to the same show.", link: "Find an artist", href: "/artists" },
    { title: "See what made the setlist", description: "After the show, explore the confirmed setlist when it’s available. See which fan requests were played and discover what you missed at other stops on the tour.", link: "Browse artists and setlists", href: "/artists" },
  ],
  questions: [
    { title: "Do I need an account?", answer: "You can try two votes and two song requests per show without an account. Sign in to keep participating." },
    { title: "When does voting close?", answer: "Voting closes when the show starts. If the start time is unknown, it closes at the beginning of the show’s local date." },
    { title: "Will the artist play my request?", answer: "Fan votes show what the crowd wants to hear. They don’t guarantee a song will be played or that the artist is using setlists.live." },
    { title: "Where does the setlist come from?", answer: "Confirmed setlists are imported from setlist.fm when available. Upcoming suggestions and fan requests are kept separate from songs actually played." },
  ],
  artistsTitle: "Know what your crowd wants.",
  artistsDescription: "Claim your artist profile to explore song demand by show and share voting links with your fans. Claims are reviewed before team access is granted.",
  sources: "Concert dates from Ticketmaster. Song catalogs from Spotify. Confirmed setlists from setlist.fm when available.",
};
