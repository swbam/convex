import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { 
  Calendar, MapPin, Music, Users, Sparkles, 
  ExternalLink, ChevronLeft, Clock, Vote
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MagicCard } from './ui/magic-card';
import { Badge } from './ui/badge';
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

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
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      announced: { label: 'Announced', variant: 'secondary' },
      lineup: { label: 'Lineup Available', variant: 'default' },
      scheduled: { label: 'Schedule Out', variant: 'default' },
      ongoing: { label: 'Happening Now!', variant: 'destructive' },
      completed: { label: 'Completed', variant: 'outline' },
    };
    
    const config = statusConfig[status] || statusConfig.announced;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-secondary rounded w-1/3"></div>
          <div className="h-48 bg-secondary rounded-2xl"></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 bg-secondary rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!festival) {
    return (
      <div className="container mx-auto px-4 py-6">
        <MagicCard className="p-8 rounded-2xl text-center">
          <div className="w-16 h-16 mx-auto bg-red-500/10 rounded-full flex items-center justify-center mb-4">
            <Sparkles className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Festival Not Found</h2>
          <p className="text-muted-foreground mb-4">
            We couldn't find this festival. It may not exist yet.
          </p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-colors"
          >
            Back to Festivals
          </button>
        </MagicCard>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        <span>Back to Festivals</span>
      </button>

      {/* Festival Header */}
      <MagicCard className="overflow-hidden rounded-2xl">
        <div className="relative">
          {/* Hero Background */}
          <div className="h-48 sm:h-64 bg-gradient-to-br from-primary/40 via-primary/20 to-secondary/30 flex items-center justify-center">
            {festival.imageUrl ? (
              <img 
                src={festival.imageUrl} 
                alt={festival.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Sparkles className="h-20 w-20 text-primary/30" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
          </div>

          {/* Festival Info Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {getStatusBadge(festival.status)}
              {festival.genres?.slice(0, 3).map((genre: string) => (
                <Badge key={genre} variant="outline" className="bg-background/50 backdrop-blur-sm">
                  {genre}
                </Badge>
              ))}
            </div>
            
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-2">
              {festival.name}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                <span>{formatDateRange(festival.startDate, festival.endDate)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                <span>{festival.location}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                <span>{totalArtists} artists</span>
              </div>
            </div>
          </div>
        </div>

        {/* Links */}
        {festival.websiteUrl && (
          <div className="p-4 border-t border-border">
            <a
              href={festival.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Official Website
            </a>
          </div>
        )}
      </MagicCard>

      {/* Lineup Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            Lineup
          </h2>
          <p className="text-sm text-muted-foreground">
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
                  <span className="ml-1 text-xs text-muted-foreground">
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
            <p className="text-muted-foreground">
              Lineup hasn't been announced yet. Check back later!
            </p>
          </MagicCard>
        )}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
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
      transition={{ duration: 0.3, delay: index * 0.02 }}
    >
      <MagicCard
        className="group cursor-pointer rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-lg"
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
                View setlist predictions →
              </p>
            )}
          </div>
        </div>
      </MagicCard>
    </motion.div>
  );
}

