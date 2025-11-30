import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { 
  Calendar, MapPin, Music, Users, Sparkles, 
  ExternalLink, ChevronLeft, Clock, Vote
} from 'lucide-react';
import { motion } from 'framer-motion';
import { MagicCard } from './ui/magic-card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { useNavigate } from 'react-router-dom';

interface FestivalDetailProps {
  festivalSlug: string;
  onBack: () => void;
  onShowClick: (showId: Id<'shows'>, slug?: string) => void;
  onArtistClick: (artistId: Id<'artists'>, slug?: string) => void;
}

export function FestivalDetail({ 
  festivalSlug, 
  onBack, 
  onShowClick,
  onArtistClick 
}: FestivalDetailProps) {
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState<number>(1);
  
  // Fetch festival schedule with all artists
  const scheduleData = useQuery(api.festivals.getSchedule, { festivalSlug });
  
  const festival = scheduleData?.festival;
  const days = scheduleData?.days || [];
  const totalArtists = scheduleData?.totalArtists || 0;
  
  const isLoading = scheduleData === undefined;

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

  const getDayDate = (dayNumber: number) => {
    if (!festival?.startDate) return '';
    const start = new Date(festival.startDate);
    start.setDate(start.getDate() + dayNumber - 1);
    return start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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
        
        {/* Content Skeleton */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 bg-secondary rounded-xl animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!festival) {
    return (
      <div className="container mx-auto px-4 py-12">
        <MagicCard className="p-8 rounded-2xl text-center max-w-lg mx-auto">
          <div className="w-20 h-20 mx-auto bg-red-500/10 rounded-full flex items-center justify-center mb-6">
            <Sparkles className="h-10 w-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">Festival Not Found</h2>
          <p className="text-muted-foreground mb-6">
            We couldn't find this festival. It may not exist yet.
          </p>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-colors font-medium"
          >
            Back to Festivals
          </button>
        </MagicCard>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative z-10">
      {/* ===== FULL-WIDTH HERO HEADER ===== */}
      <div className="relative w-full overflow-hidden">
        {/* Hero Container */}
        <div className="relative w-full h-[400px] sm:h-[450px] md:h-[500px] lg:h-[550px]">
          {/* Background Image */}
          <div className="absolute inset-0">
            {festival.imageUrl ? (
              <img 
                src={festival.imageUrl} 
                alt={festival.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/30 via-primary/20 to-secondary/30 flex items-center justify-center">
                <Sparkles className="h-24 w-24 text-primary/30" />
              </div>
            )}
            {/* Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60" />
          </div>
          
          {/* Back Button - Top Left */}
          <div className="absolute top-6 left-4 sm:left-6 lg:left-8 z-20">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm border border-white/10 text-white transition-all duration-200 hover:scale-105"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="text-sm font-medium">Back to Festivals</span>
            </button>
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
                <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-white/90">
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
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    <span className="text-sm sm:text-base font-medium">
                      {totalArtists} artists
                    </span>
                  </div>
                </div>
                
                {/* Website Link */}
                {festival.websiteUrl && (
                  <div className="mt-6">
                    <a
                      href={festival.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white transition-all duration-200 hover:scale-105"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span className="text-sm font-medium">Official Website</span>
                    </a>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== LINEUP SECTION ===== */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="space-y-6">
          {/* Section Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Music className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              Lineup
            </h2>
            <p className="text-sm text-muted-foreground hidden sm:block">
              Click any artist to vote on their setlist
            </p>
          </div>

          {/* Day Tabs */}
          {days.length > 1 ? (
            <Tabs value={String(selectedDay)} onValueChange={(v) => setSelectedDay(Number(v))}>
              <TabsList className="mb-4">
                {days.map((day) => (
                  <TabsTrigger key={day.dayNumber} value={String(day.dayNumber)}>
                    Day {day.dayNumber}
                    <span className="ml-1 text-xs text-muted-foreground hidden sm:inline">
                      ({getDayDate(day.dayNumber)})
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {days.map((day) => (
                <TabsContent key={day.dayNumber} value={String(day.dayNumber)}>
                  <ArtistGrid 
                    shows={day.shows} 
                    onShowClick={onShowClick}
                    onArtistClick={onArtistClick}
                  />
                </TabsContent>
              ))}
            </Tabs>
          ) : days.length === 1 ? (
            <ArtistGrid 
              shows={days[0].shows} 
              onShowClick={onShowClick}
              onArtistClick={onArtistClick}
            />
          ) : (
            <MagicCard className="p-8 text-center rounded-xl">
              <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Music className="h-8 w-8 text-primary" />
              </div>
              <p className="text-muted-foreground">
                Lineup hasn't been announced yet. Check back later!
              </p>
            </MagicCard>
          )}
        </div>
      </div>
    </div>
  );
}

// Artist Grid Component
interface ArtistGridProps {
  shows: Array<{
    showId: Id<'shows'>;
    slug?: string;
    artist: {
      _id: Id<'artists'>;
      name: string;
      slug: string;
      images?: string[];
      genres?: string[];
    } | null;
    stageName?: string;
    setTime?: string;
    voteCount: number;
    hasSetlist: boolean;
  }>;
  onShowClick: (showId: Id<'shows'>, slug?: string) => void;
  onArtistClick: (artistId: Id<'artists'>, slug?: string) => void;
}

function ArtistGrid({ shows, onShowClick, onArtistClick }: ArtistGridProps) {
  // Group by stage if available
  const stages = React.useMemo(() => {
    const stageMap = new Map<string, typeof shows>();
    
    shows.forEach((show) => {
      const stage = show.stageName || 'Main Stage';
      if (!stageMap.has(stage)) {
        stageMap.set(stage, []);
      }
      stageMap.get(stage)!.push(show);
    });
    
    // Sort each stage's shows by time
    stageMap.forEach((stageShows) => {
      stageShows.sort((a, b) => {
        if (a.setTime && b.setTime) {
          return a.setTime.localeCompare(b.setTime);
        }
        return 0;
      });
    });
    
    return Array.from(stageMap.entries());
  }, [shows]);

  // If only one stage or no stage info, show flat grid
  const showStages = stages.length > 1;

  return (
    <div className="space-y-6">
      {showStages ? (
        stages.map(([stageName, stageShows]) => (
          <div key={stageName} className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <div className="w-1 h-5 bg-primary rounded-full" />
              {stageName}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {stageShows.map((show, index) => (
                <ArtistCard 
                  key={show.showId} 
                  show={show} 
                  index={index}
                  onShowClick={onShowClick}
                  onArtistClick={onArtistClick}
                />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {shows.map((show, index) => (
            <ArtistCard 
              key={show.showId} 
              show={show} 
              index={index}
              onShowClick={onShowClick}
              onArtistClick={onArtistClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Individual Artist Card
interface ArtistCardProps {
  show: {
    showId: Id<'shows'>;
    slug?: string;
    artist: {
      _id: Id<'artists'>;
      name: string;
      slug: string;
      images?: string[];
      genres?: string[];
    } | null;
    stageName?: string;
    setTime?: string;
    voteCount: number;
    hasSetlist: boolean;
  };
  index: number;
  onShowClick: (showId: Id<'shows'>, slug?: string) => void;
  onArtistClick: (artistId: Id<'artists'>, slug?: string) => void;
}

function ArtistCard({ show, index, onShowClick, onArtistClick }: ArtistCardProps) {
  if (!show.artist) return null;
  
  const artistImage = show.artist.images?.[0];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.3) }}
    >
      <MagicCard
        className="group cursor-pointer rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.03] hover:shadow-xl"
        onClick={() => onShowClick(show.showId, show.slug)}
      >
        {/* Artist Image */}
        <div className="relative aspect-square bg-gradient-to-br from-secondary to-secondary/50">
          {artistImage ? (
            <img 
              src={artistImage} 
              alt={show.artist.name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music className="h-8 w-8 text-muted-foreground/50" />
            </div>
          )}
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          {/* Set Time Badge */}
          {show.setTime && (
            <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/70 backdrop-blur-sm rounded text-xs text-white flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {show.setTime}
            </div>
          )}
          
          {/* Vote Count */}
          {show.voteCount > 0 && (
            <div className="absolute top-2 left-2 px-2 py-0.5 bg-primary/90 backdrop-blur-sm rounded text-xs text-primary-foreground flex items-center gap-1">
              <Vote className="h-3 w-3" />
              {show.voteCount}
            </div>
          )}
          
          {/* Artist Name */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <h4 className="text-sm font-semibold text-white line-clamp-2 group-hover:text-primary transition-colors">
              {show.artist.name}
            </h4>
            {show.hasSetlist && (
              <p className="text-xs text-white/70 mt-0.5">
                View setlist →
              </p>
            )}
          </div>
        </div>
      </MagicCard>
    </motion.div>
  );
}
