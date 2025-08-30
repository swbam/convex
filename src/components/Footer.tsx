import React from 'react'
import { Music, Heart, Github, Twitter, Instagram, Mail } from 'lucide-react'

export function Footer() {
  return (
    <footer className="w-full bg-background border-t border-white/10 mt-auto">
      <div className="container mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg">
                <Music className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-2xl font-bold text-foreground">TheSet</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              The ultimate platform for concert setlist voting and music discovery. Join thousands of fans predicting their favorite shows.
            </p>
            <div className="flex items-center gap-2">
              <a href="https://github.com/swbam" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-accent rounded-lg">
                <Github className="h-5 w-5" />
              </a>
              <a href="https://twitter.com/theset" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-accent rounded-lg">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="https://instagram.com/theset" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-accent rounded-lg">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="mailto:hello@theset.app" className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-accent rounded-lg">
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div className="space-y-6">
            <h3 className="font-semibold text-foreground text-lg">Product</h3>
            <nav className="space-y-3">
              <a href="/artists" className="block text-sm text-muted-foreground hover:text-foreground transition-colors hover:translate-x-1 transform duration-200">
                Browse Artists
              </a>
              <a href="/shows" className="block text-sm text-muted-foreground hover:text-foreground transition-colors hover:translate-x-1 transform duration-200">
                Upcoming Shows
              </a>
              <a href="/trending" className="block text-sm text-muted-foreground hover:text-foreground transition-colors hover:translate-x-1 transform duration-200">
                Trending Now
              </a>
              <a href="/profile" className="block text-sm text-muted-foreground hover:text-foreground transition-colors hover:translate-x-1 transform duration-200">
                My Dashboard
              </a>
            </nav>
          </div>

          {/* Community */}
          <div className="space-y-6">
            <h3 className="font-semibold text-foreground text-lg">Community</h3>
            <nav className="space-y-3">
              <a href="/leaderboard" className="block text-sm text-muted-foreground hover:text-foreground transition-colors hover:translate-x-1 transform duration-200">
                Leaderboard
              </a>
              <a href="/about" className="block text-sm text-muted-foreground hover:text-foreground transition-colors hover:translate-x-1 transform duration-200">
                About Us
              </a>
              <a href="/blog" className="block text-sm text-muted-foreground hover:text-foreground transition-colors hover:translate-x-1 transform duration-200">
                Blog
              </a>
              <a href="/contact" className="block text-sm text-muted-foreground hover:text-foreground transition-colors hover:translate-x-1 transform duration-200">
                Contact
              </a>
            </nav>
          </div>

          {/* Legal */}
          <div className="space-y-6">
            <h3 className="font-semibold text-foreground text-lg">Legal</h3>
            <nav className="space-y-3">
              <a href="/privacy" className="block text-sm text-muted-foreground hover:text-foreground transition-colors hover:translate-x-1 transform duration-200">
                Privacy Policy
              </a>
              <a href="/terms" className="block text-sm text-muted-foreground hover:text-foreground transition-colors hover:translate-x-1 transform duration-200">
                Terms of Service
              </a>
              <a href="/cookies" className="block text-sm text-muted-foreground hover:text-foreground transition-colors hover:translate-x-1 transform duration-200">
                Cookie Policy
              </a>
              <a href="/api" className="block text-sm text-muted-foreground hover:text-foreground transition-colors hover:translate-x-1 transform duration-200">
                API Documentation
              </a>
            </nav>
          </div>
        </div>

        {/* Bottom Bar - Enhanced */}
        <div className="border-t border-white/10 mt-12 pt-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            {/* Copyright */}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>© 2024 TheSet</span>
              <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
              <span>All rights reserved</span>
              <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
              <span className="flex items-center gap-1">
                Made with <Heart className="h-3 w-3 text-red-400 fill-current animate-pulse" /> for music fans
              </span>
            </div>
            
            {/* Tech Stack */}
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span>Powered by</span>
              <a href="https://convex.dev" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors font-medium">
                Convex
              </a>
              <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
              <a href="https://clerk.dev" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors font-medium">
                Clerk
              </a>
              <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
              <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors font-medium">
                Vercel
              </a>
            </div>
          </div>
          
          {/* Additional Links */}
          <div className="mt-6 pt-6 border-t border-white/5 text-center">
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
              <a href="/sitemap" className="hover:text-foreground transition-colors">Sitemap</a>
              <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
              <a href="/accessibility" className="hover:text-foreground transition-colors">Accessibility</a>
              <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
              <a href="/security" className="hover:text-foreground transition-colors">Security</a>
              <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
              <a href="/status" className="hover:text-foreground transition-colors">System Status</a>
              <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
              <span>v1.0.0</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}