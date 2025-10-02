import React, { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function SEOHead() {
  const location = useLocation();
  const params = useParams();
  const { artistSlug, showSlug } = params;

  const artist = useQuery(api.artists.getBySlug, artistSlug ? { slug: artistSlug } : "skip");
  const show = useQuery(api.shows.getBySlug, showSlug ? { slug: showSlug } : "skip");

  useEffect(() => {
    let title = "setlists.live | Crowdsourced Concert Setlists";
    let description = "Vote on setlists and predict songs for upcoming concerts.";

    if (artistSlug && artist) {
      title = `${artist.name} | setlists.live`;
      description = `Upcoming shows and setlists for ${artist.name}. Vote on songs you want to hear.`;
    } else if (showSlug && show) {
      title = `${show.artist?.name} at ${show.venue?.name} | Setlists Live`;
      description = `Setlist voting for ${show.artist?.name}'s show at ${show.venue?.name} on ${new Date(show.date).toLocaleDateString()}.`;
    }

    document.title = title;
    let metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', description);

    let ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage) ogImage.setAttribute('content', artist?.images?.[0] || '/default-og.jpg');

    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);
  }, [location.pathname, artist, show]);

  return null;
}
