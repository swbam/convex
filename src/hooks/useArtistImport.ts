import { useState, useCallback } from 'react';
import { useAction } from 'convex/react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { toast } from 'sonner';

/**
 * Shared hook for handling artist clicks with automatic import
 * Navigates instantly if artist is already in DB, otherwise triggers import
 */
export function useArtistImport() {
  const [importingArtist, setImportingArtist] = useState<string | null>(null);
  const triggerArtistSync = useAction(api.ticketmaster.triggerFullArtistSync);
  const navigate = useNavigate();

  const handleArtistClick = useCallback(async (
    artist: {
      _id?: Id<"artists"> | string;
      artistId?: Id<"artists">;
      ticketmasterId?: string;
      name?: string;
      slug?: string;
      genres?: string[];
      images?: string[];
      upcomingEvents?: number;
      syncStatus?: { catalogImported?: boolean };
    },
    onNavigate?: (artistKey: Id<"artists"> | string, slug?: string) => void
  ) => {
    // Check if the artist has a linked artistId from the main artists table
    // (trendingArtists records may have an artistId field pointing to the real artist)
    const linkedArtistId = artist?.artistId;
    const slug = artist?.slug;
    
    // If artist is already linked to main artists table, navigate instantly
    // Real artist IDs from the artists table start with 'j' (e.g., j97...)
    if (linkedArtistId && typeof linkedArtistId === 'string' && linkedArtistId.startsWith('j')) {
      // Navigate instantly - no loading toast needed
      if (onNavigate) {
        onNavigate(linkedArtistId as Id<"artists">, slug);
      } else {
        navigate(`/artists/${slug || linkedArtistId}`);
      }
      return;
    }
    
    // Also check if the _id itself is a real artist ID (starts with j)
    const docId = artist?._id;
    if (docId && typeof docId === 'string' && docId.startsWith('j')) {
      // This is a real artist doc, navigate instantly
      if (onNavigate) {
        onNavigate(docId as Id<"artists">, slug);
      } else {
        navigate(`/artists/${slug || docId}`);
      }
      return;
    }
    
    // Check if the artist has sync status indicating it's fully imported
    if (artist?.syncStatus?.catalogImported && slug) {
      // Already imported, navigate instantly
      navigate(`/artists/${slug}`);
      return;
    }
    
    // Artist is in cache but not in main DB - trigger import
    if (artist?.ticketmasterId && artist?.name) {
      setImportingArtist(artist.ticketmasterId);
      try {
        toast.info(`Loading ${artist.name}...`, { duration: 2000 });
        const result = await triggerArtistSync({
          ticketmasterId: artist.ticketmasterId,
          artistName: artist.name,
          genres: artist.genres || [],
          images: artist.images || [],
          upcomingEvents: artist.upcomingEvents || 0,
        });
        
        if (result.type === 'artist' && result.slug) {
          navigate(`/artists/${result.slug}`);
        } else if (result.type === 'festival' && result.slug) {
          navigate(`/festivals/${result.slug}`);
        }
      } catch (error) {
        console.error('Failed to import artist:', error);
        toast.error(`Failed to load ${artist.name}`);
        // Still try to navigate using the slug as fallback
        if (slug) {
          navigate(`/artists/${slug}`);
        }
      } finally {
        setImportingArtist(null);
      }
      return;
    }
    
    // Fallback: just navigate to slug if available
    if (slug) {
      if (onNavigate) {
        onNavigate(slug, slug);
      } else {
        navigate(`/artists/${slug}`);
      }
    }
  }, [triggerArtistSync, navigate]);

  return {
    importingArtist,
    handleArtistClick,
    isImporting: importingArtist !== null,
  };
}

/**
 * Shared hook for handling show clicks with automatic import
 */
export function useShowImport() {
  const [importingShow, setImportingShow] = useState<string | null>(null);
  const triggerArtistSync = useAction(api.ticketmaster.triggerFullArtistSync);
  const navigate = useNavigate();

  const handleShowClick = useCallback(async (
    show: {
      _id?: Id<"shows">;
      showId?: Id<"shows">;
      ticketmasterId?: string;
      slug?: string;
      showSlug?: string;
      artist?: {
        _id?: Id<"artists">;
        ticketmasterId?: string;
        name?: string;
        genres?: string[];
        images?: string[];
      };
      artistName?: string;
      artistTicketmasterId?: string;
      artistImage?: string;
      date?: string;
      venue?: { name?: string; city?: string };
      venueName?: string;
      venueCity?: string;
    },
    onNavigate?: (showKey: Id<"shows"> | string, slug?: string) => void
  ) => {
    const showId = show?.showId || show?._id;
    const showSlug = show?.slug || show?.showSlug;
    
    // If show is already in the database, just navigate
    if (showId && typeof showId === 'string' && showId.startsWith('j')) {
      if (onNavigate) {
        onNavigate(showId as Id<"shows">, showSlug);
      } else {
        navigate(`/shows/${showSlug || showId}`);
      }
      return;
    }
    
    // If show has artist ticketmaster data, we need to import the artist first
    const artistTmId = show?.artist?.ticketmasterId || show?.artistTicketmasterId;
    const artistName = show?.artist?.name || show?.artistName;
    
    if (artistTmId && artistName) {
      setImportingShow(show.ticketmasterId || artistTmId);
      try {
        toast.info(`Loading ${artistName}...`, { duration: 3000 });
        const result = await triggerArtistSync({
          ticketmasterId: artistTmId,
          artistName: artistName,
          genres: show.artist?.genres || [],
          images: show.artist?.images || (show.artistImage ? [show.artistImage] : []),
          upcomingEvents: 0,
        });
        
        if (result.type === 'artist' && result.slug) {
          toast.success(`Importing ${artistName} data...`);
          // After importing artist, the show should be created - navigate to artist page
          // The show detail page will be accessible from there
          navigate(`/artists/${result.slug}`);
        } else if (result.type === 'festival' && result.slug) {
          toast.success(`Opening ${artistName} festival...`);
          navigate(`/festivals/${result.slug}`);
        }
      } catch (error) {
        console.error('Failed to import show:', error);
        toast.error(`Failed to load ${artistName}`);
        // Try to navigate to artist page as fallback
        if (showSlug) {
          navigate(`/shows/${showSlug}`);
        }
      } finally {
        setImportingShow(null);
      }
      return;
    }
    
    // Fallback: just navigate to slug if available
    if (showSlug) {
      if (onNavigate) {
        onNavigate(showSlug, showSlug);
      } else {
        navigate(`/shows/${showSlug}`);
      }
    }
  }, [triggerArtistSync, navigate]);

  return {
    importingShow,
    handleShowClick,
    isImporting: importingShow !== null,
  };
}

