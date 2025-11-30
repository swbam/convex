import { Link } from "react-router-dom";
import { Music, Vote, CheckCircle, Sparkles, Users, Zap } from "lucide-react";
import { MagicCard } from "../components/ui/magic-card";
import { motion } from "framer-motion";
import { AppLayout } from "../components/AppLayout";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export function AboutPage() {
  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-16"
        >
          {/* Hero Section */}
          <motion.section variants={itemVariants} className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">
              How It Works
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              setlists.live connects fans and artists through the setlist — before, during, and after the show.
            </p>
          </motion.section>

          {/* 3-Step Process */}
          <motion.section variants={itemVariants}>
            <div className="grid md:grid-cols-3 gap-6">
              {/* Step 1 */}
              <MagicCard className="p-6 text-center">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Music className="h-7 w-7 text-primary" />
                </div>
                <div className="text-sm font-medium text-primary mb-2">Step 1</div>
                <h3 className="text-xl font-bold mb-2">Find Shows</h3>
                <p className="text-muted-foreground text-sm">
                  Connect Spotify to instantly see upcoming concerts from artists you love. Or search any artist.
                </p>
              </MagicCard>

              {/* Step 2 */}
              <MagicCard className="p-6 text-center">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Vote className="h-7 w-7 text-primary" />
                </div>
                <div className="text-sm font-medium text-primary mb-2">Step 2</div>
                <h3 className="text-xl font-bold mb-2">Vote on Songs</h3>
                <p className="text-muted-foreground text-sm">
                  Request songs from the artist's catalog. Upvote what you want to hear. See what other fans are voting for.
                </p>
              </MagicCard>

              {/* Step 3 */}
              <MagicCard className="p-6 text-center">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-7 w-7 text-primary" />
                </div>
                <div className="text-sm font-medium text-primary mb-2">Step 3</div>
                <h3 className="text-xl font-bold mb-2">See the Results</h3>
                <p className="text-muted-foreground text-sm">
                  After the show, we sync the real setlist. See which predictions matched — and which songs fans missed.
                </p>
              </MagicCard>
            </div>
          </motion.section>

          {/* The Gap Section */}
          <motion.section variants={itemVariants} className="py-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-4">Why We Built This</h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
                    <Users className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1">The Fan Problem</h3>
                    <p className="text-muted-foreground">
                      You buy tickets, wait months for the show, and hope they play the songs you came to hear. But you have no way to tell the artist what you want — except yelling from the crowd.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
                    <Sparkles className="h-5 w-5 text-orange-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1">The Artist Problem</h3>
                    <p className="text-muted-foreground">
                      Artists have no way of knowing what fans in each city want to hear. They're playing to thousands of people with zero feedback until the first chord hits.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 text-center">
              <div className="inline-flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-2xl px-6 py-4">
                <Zap className="h-6 w-6 text-green-400" />
                <p className="text-green-400 font-medium">
                  setlists.live closes the gap. Fans vote. Artists get the signal.
                </p>
              </div>
            </div>
          </motion.section>

          {/* For Fans Section */}
          <motion.section variants={itemVariants}>
            <MagicCard className="p-8">
              <h2 className="text-2xl font-bold mb-6">For Fans</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                    <span className="text-muted-foreground">Connect Spotify to see your artists' upcoming shows instantly</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                    <span className="text-muted-foreground">Vote on songs before the concert — no signup required for your first vote</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                    <span className="text-muted-foreground">Request deep cuts or fan favorites from the full catalog</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                    <span className="text-muted-foreground">See what other fans in your city are voting for</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                    <span className="text-muted-foreground">Compare predictions to the real setlist after the show</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                    <span className="text-muted-foreground">Track your accuracy and see how well you know your favorite artists</span>
                  </div>
                </div>
              </div>
            </MagicCard>
          </motion.section>

          {/* For Artists Section */}
          <motion.section variants={itemVariants}>
            <MagicCard className="p-8 border-primary/20">
              <h2 className="text-2xl font-bold mb-4">For Artists</h2>
              <p className="text-lg text-muted-foreground mb-6">
                You don't have to do anything. Seriously.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">Shows imported automatically</strong> — we pull from Ticketmaster so you never have to add your own tour dates
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">Song catalog synced from Spotify</strong> — fans vote on real tracks from your discography
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">Free crowd-sourced feedback</strong> — see what fans in Dallas, Denver, or Detroit want to hear before you get there
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">Use it or don't</strong> — the data is public if you want it, but there's no obligation
                  </span>
                </div>
              </div>
            </MagicCard>
          </motion.section>

          {/* Automation Section */}
          <motion.section variants={itemVariants} className="text-center py-8">
            <h2 className="text-2xl font-bold mb-4">Fully Automated</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
              We handle everything behind the scenes so fans can focus on voting and artists can focus on playing.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="p-4 bg-secondary/50 rounded-xl">
                <div className="font-bold text-foreground">Shows</div>
                <div className="text-muted-foreground">From Ticketmaster</div>
              </div>
              <div className="p-4 bg-secondary/50 rounded-xl">
                <div className="font-bold text-foreground">Songs</div>
                <div className="text-muted-foreground">From Spotify</div>
              </div>
              <div className="p-4 bg-secondary/50 rounded-xl">
                <div className="font-bold text-foreground">Setlists</div>
                <div className="text-muted-foreground">From Setlist.fm</div>
              </div>
              <div className="p-4 bg-secondary/50 rounded-xl">
                <div className="font-bold text-foreground">Artists</div>
                <div className="text-muted-foreground">Zero effort</div>
              </div>
            </div>
          </motion.section>

          {/* CTA Section */}
          <motion.section variants={itemVariants} className="text-center py-8">
            <h2 className="text-2xl font-bold mb-4">Ready to vote?</h2>
            <p className="text-muted-foreground mb-6">
              Find your favorite artist and start shaping the setlist.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl transition-colors"
            >
              <Music className="h-5 w-5" />
              Explore Shows
            </Link>
          </motion.section>
        </motion.div>

      </div>
    </AppLayout>
  );
}

