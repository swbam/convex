import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Calendar, MapPin, Music, Users, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MagicCard } from './ui/magic-card';

interface FestivalsProps {
  onFestivalClick: (slug: string) => void;
}

export function Festivals({ onFestivalClick }: FestivalsProps) {
  const currentYear = new Date().getFullYear();
  const upcomingFestivals = useQuery(api.festivals.getUpcoming, { 
    limit: 50, 
    year: currentYear 
  });
  const nextYearFestivals = useQuery(api.festivals.getUpcoming, { 
    limit: 50, 
    year: currentYear + 1 
  });
  
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  
  const isLoading = upcomingFestivals === undefined;
  
  // Combine and sort all festivals
  const allFestivals = React.useMemo(() => {
    const combined = [
      ...(upcomingFestivals || []),
      ...(nextYearFestivals || []),
    ];
    
    // Sort by start date
    return combined.sort((a, b) => 
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
  }, [upcomingFestivals, nextYearFestivals]);

  // Featured festivals (first 5 with images) for the hero slider
  const featuredFestivals = React.useMemo(() => {
    return allFestivals.filter(f => f.imageUrl).slice(0, 5);
  }, [allFestivals]);

  // Remaining festivals for the grid
  const gridFestivals = React.useMemo(() => {
    const featuredIds = new Set(featuredFestivals.map(f => f._id));
    return allFestivals.filter(f => !featuredIds.has(f._id));
  }, [allFestivals, featuredFestivals]);

  // Auto-advance slider
  useEffect(() => {
    if (!isAutoPlaying || featuredFestivals.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % featuredFestivals.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isAutoPlaying, featuredFestivals.length]);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
    // Resume auto-play after 10 seconds of inactivity
    setTimeout(() => setIsAutoPlaying(true), 10000);
  }, []);

  const nextSlide = useCallback(() => {
    goToSlide((currentSlide + 1) % featuredFestivals.length);
  }, [currentSlide, featuredFestivals.length, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide((currentSlide - 1 + featuredFestivals.length) % featuredFestivals.length);
  }, [currentSlide, featuredFestivals.length, goToSlide]);

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
    const startDay = start.getDate();
    const endDay = end.getDate();
    const year = start.getFullYear();
    
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay}-${endDay}, ${year}`;
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string }> = {
      announced: { label: 'Announced', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      lineup: { label: 'Lineup Out', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
      scheduled: { label: 'Schedule Out', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
      ongoing: { label: 'Happening Now', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30 animate-pulse' },
      completed: { label: 'Completed', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
    };
    
    const config = statusConfig[status] || statusConfig.announced;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${config.color}`}>
        {config.label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        {/* Hero Skeleton */}
        <div className="w-full h-[400px] sm:h-[450px] md:h-[500px] bg-gradient-to-r from-secondary/50 via-secondary/30 to-secondary/50 animate-pulse" />
        
        {/* Grid Skeleton */}
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-card rounded-2xl overflow-hidden">
                  <div className="h-40 bg-secondary/50" />
                  <div className="p-4 space-y-3">
                    <div className="h-5 bg-secondary rounded w-3/4"></div>
                    <div className="h-4 bg-secondary rounded w-1/2"></div>
                    <div className="h-4 bg-secondary rounded w-2/3"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (allFestivals.length === 0) {
    return (
      <div className="container mx-auto px-4 py-12">
        <MagicCard className="p-8 rounded-2xl text-center max-w-lg mx-auto">
          <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Sparkles className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">No Festivals Yet</h2>
          <p className="text-muted-foreground">
            Festival lineups for {currentYear + 1} haven't been announced yet. 
            Check back in January when major festivals reveal their lineups!
          </p>
        </MagicCard>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative z-10">
      {/* ===== HERO SLIDER SECTION ===== */}
      {featuredFestivals.length > 0 && (
        <div className="relative w-full overflow-hidden">
          {/* Slider Container */}
          <div 
            className="relative w-full h-[400px] sm:h-[450px] md:h-[500px] lg:h-[550px]"
            onMouseEnter={() => setIsAutoPlaying(false)}
            onMouseLeave={() => setIsAutoPlaying(true)}
          >
            <AnimatePresence mode="wait">
              {featuredFestivals.map((festival, index) => (
                index === currentSlide && (
                  <motion.div
                    key={festival._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-0 cursor-pointer"
                    onClick={() => onFestivalClick(festival.slug)}
                  >
                    {/* Background Image */}
                    <div className="absolute inset-0">
                      <img 
                        src={festival.imageUrl} 
                        alt={festival.name}
                        className="w-full h-full object-cover"
                      />
                      {/* Gradient Overlays */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60" />
                    </div>
                    
                    {/* Content */}
                    <div className="absolute inset-0 flex items-end">
                      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20 md:pb-24">
                        <motion.div
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.2 }}
                          className="max-w-3xl"
                        >
                          {/* Status Badge */}
                          <div className="mb-4">
                            {getStatusBadge(festival.status)}
                          </div>
                          
                          {/* Festival Name */}
                          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
                            {festival.name}
                          </h1>
                          
                          {/* Details */}
                          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-white/90 mb-6">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-5 w-5" />
                              <span className="text-sm sm:text-base font-medium">
                                {formatDateRange(festival.startDate, festival.endDate)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-5 w-5" />
                              <span className="text-sm sm:text-base font-medium">{festival.location}</span>
                            </div>
                            {festival.artistCount && festival.artistCount > 0 && (
                              <div className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                <span className="text-sm sm:text-base font-medium">
                                  {festival.artistCount} artists
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {/* Genres */}
                          {festival.genres && festival.genres.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {festival.genres.slice(0, 4).map((genre, i) => (
                                <span 
                                  key={i}
                                  className="px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full text-xs sm:text-sm text-white/90 border border-white/20"
                                >
                                  {genre}
                                </span>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                )
              ))}
            </AnimatePresence>
            
            {/* Navigation Arrows */}
            {featuredFestivals.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); prevSlide(); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-3 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm border border-white/10 text-white transition-all duration-200 hover:scale-110"
                  aria-label="Previous festival"
                >
                  <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); nextSlide(); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-3 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm border border-white/10 text-white transition-all duration-200 hover:scale-110"
                  aria-label="Next festival"
                >
                  <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
              </>
            )}
            
            {/* Slide Indicators */}
            {featuredFestivals.length > 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
                {featuredFestivals.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => { e.stopPropagation(); goToSlide(index); }}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      index === currentSlide 
                        ? 'w-8 bg-white' 
                        : 'w-2 bg-white/40 hover:bg-white/60'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== GRID SECTION ===== */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {/* Section Header */}
        {gridFestivals.length > 0 && (
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">More Festivals</h2>
              <p className="text-sm text-muted-foreground">
                {gridFestivals.length} more upcoming festivals
              </p>
            </div>
          </div>
        )}

        {/* Festival Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {gridFestivals.map((festival, index) => (
            <motion.div
              key={festival._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.5) }}
            >
              <MagicCard
                className="group cursor-pointer rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl h-full"
                onClick={() => onFestivalClick(festival.slug)}
              >
                {/* Festival Image/Header */}
                <div className="relative h-36 sm:h-40 bg-gradient-to-br from-primary/30 via-primary/20 to-secondary/30 flex items-center justify-center overflow-hidden">
                  {festival.imageUrl ? (
                    <img 
                      src={festival.imageUrl} 
                      alt={festival.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="h-12 w-12 text-primary/40" />
                    </div>
                  )}
                  
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  
                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    {getStatusBadge(festival.status)}
                  </div>
                </div>

                {/* Festival Info */}
                <div className="p-4 space-y-2.5">
                  <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {festival.name}
                  </h3>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 shrink-0 text-primary/70" />
                    <span className="truncate">{formatDateRange(festival.startDate, festival.endDate)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0 text-primary/70" />
                    <span className="truncate">{festival.location}</span>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                    {festival.artistCount && festival.artistCount > 0 && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        <span className="font-medium text-foreground">{festival.artistCount}</span>
                      </div>
                    )}
                    
                    {festival.genres && festival.genres.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                        <Music className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate">{festival.genres.slice(0, 2).join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </MagicCard>
            </motion.div>
          ))}
        </div>

        {/* Show empty state if only featured festivals exist */}
        {gridFestivals.length === 0 && featuredFestivals.length > 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>All festivals are featured above</p>
          </div>
        )}
      </div>
    </div>
  );
}
