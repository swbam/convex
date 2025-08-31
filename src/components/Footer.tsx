import React from 'react'
import { Music, Heart, Github, Twitter, Instagram, Mail } from 'lucide-react'

export function Footer() {
  return (
    <footer className="w-full bg-transparent border-t border-white/10 mt-auto">
      <div className="mx-auto max-w-page-full px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12 py-8 sm:py-12 lg:py-16">
        {/* Main Footer Content */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1 space-y-4 sm:space-y-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-primary to-primary/80 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg">
                <Music className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
              </div>
              <span className="text-responsive-xl sm:text-responsive-2xl font-bold text-foreground">TheSet</span>
            </div>
            <p className="text-responsive-xs sm:text-responsive-sm text-muted-foreground max-w-xs leading-relaxed hidden sm:block">
              The ultimate platform for concert setlist voting and music discovery. Join thousands of fans predicting their favorite shows.
            </p>
            <div className="flex items-center gap-1 sm:gap-2">
              <a href="https://github.com/swbam" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors p-1.5 sm:p-2 hover:bg-accent rounded-md sm:rounded-lg touch-target">
                <Github className="h-4 w-4 sm:h-5 sm:w-5" />
              </a>
              <a href="https://twitter.com/theset" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors p-1.5 sm:p-2 hover:bg-accent rounded-md sm:rounded-lg touch-target">
                <Twitter className="h-4 w-4 sm:h-5 sm:w-5" />
              </a>
              <a href="https://instagram.com/theset" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors p-1.5 sm:p-2 hover:bg-accent rounded-md sm:rounded-lg touch-target">
                <Instagram className="h-4 w-4 sm:h-5 sm:w-5" />
              </a>
              <a href="mailto:hello@theset.app" className="text-muted-foreground hover:text-foreground transition-colors p-1.5 sm:p-2 hover:bg-accent rounded-md sm:rounded-lg touch-target">
                <Mail className="h-4 w-4 sm:h-5 sm:w-5" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div className="space-y-3 sm:space-y-4 lg:space-y-6">
            <h3 className="font-semibold text-foreground text-responsive-base sm:text-responsive-lg">Product</h3>
            <nav className="space-y-2 sm:space-y-3">
              <a href="/artists" className="block text-responsive-xs sm:text-responsive-sm text-muted-foreground hover:text-foreground transition-colors hover:translate-x-1 transform duration-200">
                Browse Artists
              </a>
              <a href="/shows" className="block text-responsive-xs sm:text-responsive-sm text-muted-foreground hover:text-foreground transition-colors hover:translate-x-1 transform duration-200">
                Upcoming Shows
              </a>
              <a href="/trending" className="hidden sm:block text-responsive-xs sm:text-responsive-sm text-muted-foreground hover:text-foreground transition-colors hover:translate-x-1 transform duration-200">
                Trending Now
              </a>
              <a href="/profile" className="hidden sm:block text-responsive-xs sm:text-responsive-sm text-muted-foreground hover:text-foreground transition-colors hover:translate-x-1 transform duration-200">
                My Dashboard
              </a>
            </nav>
          </div>

          {/* Support */}
          <div className="space-y-3 sm:space-y-4 lg:space-y-6 hidden sm:block">
            <h3 className="font-semibold text-foreground text-responsive-base sm:text-responsive-lg">Support</h3>
            <nav className="space-y-2 sm:space-y-3">
              <a href="/help" className="block text-responsive-xs sm:text-responsive-sm text-muted-foreground hover:text-foreground transition-colors hover:translate-x-1 transform duration-200">
                Help Center
              </a>
              <a href="/contact" className="block text-responsive-xs sm:text-responsive-sm text-muted-foreground hover:text-foreground transition-colors hover:translate-x-1 transform duration-200">
                Contact Us
              </a>
              <a href="/feedback" className="block text-responsive-xs sm:text-responsive-sm text-muted-foreground hover:text-foreground transition-colors hover:translate-x-1 transform duration-200">
                Send Feedback
              </a>
            </nav>
          </div>

          {/* Legal */}
          <div className="space-y-3 sm:space-y-4 lg:space-y-6">
            <h3 className="font-semibold text-foreground text-responsive-base sm:text-responsive-lg">Legal</h3>
            <nav className="space-y-2 sm:space-y-3">
              <a href="/privacy" className="block text-responsive-xs sm:text-responsive-sm text-muted-foreground hover:text-foreground transition-colors hover:translate-x-1 transform duration-200">
                Privacy Policy
              </a>
              <a href="/terms" className="block text-responsive-xs sm:text-responsive-sm text-muted-foreground hover:text-foreground transition-colors hover:translate-x-1 transform duration-200">
                Terms of Service
              </a>
            </nav>
          </div>
        </div>

        {/* Bottom Bar - Enhanced */}
        <div className="border-t border-white/10 mt-8 sm:mt-12 pt-6 sm:pt-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
            {/* Copyright */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 text-responsive-xs sm:text-responsive-sm text-muted-foreground">
              <span>© 2024 TheSet</span>
              <span className="hidden sm:inline w-1 h-1 bg-muted-foreground rounded-full"></span>
              <span className="hidden sm:inline">All rights reserved</span>
              <span className="hidden lg:inline w-1 h-1 bg-muted-foreground rounded-full"></span>
              <span className="hidden lg:flex items-center gap-1">
                Made with <Heart className="h-3 w-3 text-red-400 fill-current animate-pulse" /> for music fans
              </span>
            </div>
            
            {/* Simple Brand */}
            <div className="flex items-center gap-1.5 sm:gap-2 text-responsive-xs sm:text-responsive-sm text-muted-foreground">
              <Music className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">TheSet - Concert Setlist Platform</span>
              <span className="sm:hidden">TheSet</span>
            </div>
          </div>
          

        </div>
      </div>
    </footer>
  )
}