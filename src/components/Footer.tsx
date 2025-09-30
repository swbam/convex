import React from 'react'
import { Heart, Github, Twitter, Instagram, Mail } from 'lucide-react'

export function Footer() {
  return (
    <footer className="w-full bg-transparent border-t border-white/10 mt-auto">
      <div className="mx-auto max-w-page-full px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12 py-8 sm:py-12 lg:py-16">
        {/* Main Footer Content */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1 space-y-4 sm:space-y-6">
            <div className="flex items-center">
              <span className="text-2xl sm:text-3xl font-bold text-foreground" style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>setlists.live</span>
            </div>
            <p className="text-responsive-xs sm:text-responsive-sm text-muted-foreground max-w-xs leading-relaxed hidden sm:block">
              The ultimate platform for concert setlist voting and music discovery. Join thousands of fans predicting their favorite shows.
            </p>
         
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
              <span>© 2024 setlists.live</span>
              <span className="hidden sm:inline w-1 h-1 bg-muted-foreground rounded-full"></span>
              <span className="hidden sm:inline">All rights reserved</span>
              <span className="hidden lg:inline w-1 h-1 bg-muted-foreground rounded-full"></span>
             
            </div>
            
            {/* Simple Brand */}
            <div className="text-responsive-xs sm:text-responsive-sm text-muted-foreground">
              <span className="hidden sm:inline">setlists.live - Concert Setlist Platform</span>
              <span className="sm:hidden">setlists.live</span>
            </div>
          </div>
          

        </div>
      </div>
    </footer>
  )
}