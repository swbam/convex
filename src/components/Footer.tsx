import React from 'react'
import { Music, Heart, Github, Twitter } from 'lucide-react'

export function Footer() {
  return (
    <footer className="w-full bg-background border-t border-border mt-auto">
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center">
                <Music className="h-4 w-4 text-background" />
              </div>
              <span className="text-xl font-bold text-foreground">TheSet</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              The ultimate platform for concert setlist voting and music discovery.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Features</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Setlist Voting</li>
              <li>Artist Discovery</li>
              <li>Show Tracking</li>
              <li>Real-time Updates</li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Resources</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>About</li>
              <li>Privacy Policy</li>
              <li>Terms of Service</li>
              <li>Contact</li>
            </ul>
          </div>

          {/* Connect */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Connect</h3>
            <div className="flex items-center gap-3">
              <button className="p-2 rounded-lg bg-accent/20 hover:bg-accent/40 text-muted-foreground hover:text-foreground transition-colors">
                <Github className="h-4 w-4" />
              </button>
              <button className="p-2 rounded-lg bg-accent/20 hover:bg-accent/40 text-muted-foreground hover:text-foreground transition-colors">
                <Twitter className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            © 2024 TheSet. All rights reserved.
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            Made with <Heart className="h-3 w-3 text-red-500" /> for music fans
          </div>
        </div>
      </div>
    </footer>
  )
}
