import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Calendar, MapPin, Music, Users, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
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
      announced: { label: 'Announced', color: 'bg-blue-500/20 text-blue-400' },
      lineup: { label: 'Lineup Out', color: 'bg-green-500/20 text-green-400' },
      scheduled: { label: 'Schedule Out', color: 'bg-purple-500/20 text-purple-400' },
      ongoing: { label: 'Happening Now', color: 'bg-orange-500/20 text-orange-400 animate-pulse' },
      completed: { label: 'Completed', color: 'bg-gray-500/20 text-gray-400' },
    };
    
    const config = statusConfig[status] || statusConfig.announced;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">Music Festivals</h1>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-card rounded-2xl p-6 space-y-4">
                <div className="h-6 bg-secondary rounded w-2/3"></div>
                <div className="h-4 bg-secondary rounded w-1/2"></div>
                <div className="h-4 bg-secondary rounded w-1/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (allFestivals.length === 0) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">Music Festivals</h1>
        </div>
        
        <MagicCard className="p-8 rounded-2xl text-center">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">No Festivals Yet</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Festival lineups for {currentYear + 1} haven't been announced yet. 
            Check back in January when major festivals reveal their lineups!
          </p>
        </MagicCard>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 relative z-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-xl">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">Music Festivals</h1>
          <p className="text-sm text-muted-foreground">
            {allFestivals.length} festivals • Vote on setlists for each artist
          </p>
        </div>
      </div>

      {/* Festival Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {allFestivals.map((festival, index) => (
          <motion.div
            key={festival._id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <MagicCard
              className="group cursor-pointer rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
              onClick={() => onFestivalClick(festival.slug)}
            >
              {/* Festival Image/Header */}
              <div className="relative h-32 bg-gradient-to-br from-primary/30 via-primary/20 to-secondary/30 flex items-center justify-center">
                {festival.imageUrl ? (
                  <img 
                    src={festival.imageUrl} 
                    alt={festival.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Sparkles className="h-12 w-12 text-primary/50" />
                )}
                
                {/* Status Badge */}
                <div className="absolute top-3 right-3">
                  {getStatusBadge(festival.status)}
                </div>
              </div>

              {/* Festival Info */}
              <div className="p-4 space-y-3">
                <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                  {festival.name}
                </h3>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>{formatDateRange(festival.startDate, festival.endDate)}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span className="line-clamp-1">{festival.location}</span>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 pt-2 border-t border-border">
                  {festival.artistCount && festival.artistCount > 0 && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="font-medium text-foreground">{festival.artistCount}</span>
                      <span className="text-muted-foreground">artists</span>
                    </div>
                  )}
                  
                  {festival.genres && festival.genres.length > 0 && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <Music className="h-4 w-4 text-primary" />
                      <span className="text-muted-foreground line-clamp-1">
                        {festival.genres.slice(0, 2).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </MagicCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

