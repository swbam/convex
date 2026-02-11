import React from 'react';
import { createBrowserRouter, Navigate, useRouteError, Outlet } from 'react-router-dom';
import { App } from './App';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { UserProfilePage } from './pages/UserProfilePage';
import { SSOCallback } from './pages/SSOCallback';
import { SpotifyConnectPage } from './pages/SpotifyConnectPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { AboutPage } from './pages/AboutPage';
import { BlogPage } from './pages/BlogPage';
import { BlogPostPage } from './pages/BlogPostPage';
import { ArtistNotFound } from './components/ArtistNotFound';
import { ShowNotFound } from './components/ShowNotFound'; // Assume similar for shows
import { ForArtistsPage } from './pages/ForArtistsPage';
import { ForArtistsDashboardPage } from './pages/ForArtistsDashboardPage';
import { ForArtistsShowDemandPage } from './pages/ForArtistsShowDemandPage';
import { ForArtistsTeamPage } from './pages/ForArtistsTeamPage';
import { ArtistClaimPage } from './pages/ArtistClaimPage';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { ProtectedLayout } from './components/ProtectedLayout';

// Error boundary component for 404
function Error404({ resetErrorBoundary }: { resetErrorBoundary: () => void }) {
  const error = useRouteError() as Error;
  return <ArtistNotFound error={error.message} resetErrorBoundary={resetErrorBoundary} />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
  },
  {
    path: '/signin',
    element: <SignInPage />,
  },
  {
    path: '/signup',
    element: <SignUpPage />,
  },
  {
    path: '/sso-callback',
    element: <ProtectedLayout><SSOCallback /></ProtectedLayout>,
  },
  {
    path: '/profile',
    element: <ProtectedLayout><UserProfilePage /></ProtectedLayout>,
  },
  {
    path: '/spotify-connect',
    element: <ProtectedLayout><SpotifyConnectPage /></ProtectedLayout>,
  },
  // Artist portal routes (for-artists) - all protected with AuthGuard
  {
    path: '/for-artists',
    element: <ProtectedLayout><ForArtistsPage /></ProtectedLayout>,
  },
  {
    path: '/for-artists/:artistId',
    element: <ProtectedLayout><ForArtistsDashboardPage /></ProtectedLayout>,
  },
  {
    path: '/for-artists/:artistId/shows/:showId',
    element: <ProtectedLayout><ForArtistsShowDemandPage /></ProtectedLayout>,
  },
  {
    path: '/for-artists/:artistId/team',
    element: <ProtectedLayout><ForArtistsTeamPage /></ProtectedLayout>,
  },
  {
    path: '/for-artists/claim/:artistId',
    element: <ProtectedLayout><ArtistClaimPage /></ProtectedLayout>,
  },
  {
    path: '/for-artists/invite/:token',
    element: <ProtectedLayout><AcceptInvitePage /></ProtectedLayout>,
  },
  // Legacy redirects from /studio to /for-artists
  {
    path: '/studio',
    element: <Navigate to="/for-artists" replace />,
  },
  {
    path: '/studio/:artistId',
    element: <Navigate to="/for-artists" replace />,
  },
  {
    path: '/studio/:artistId/shows/:showId',
    element: <Navigate to="/for-artists" replace />,
  },
  {
    path: '/dashboard',
    element: <App />,
  },
  {
    path: '/activity',
    element: <App />,
  },
  {
    path: '/admin',
    element: <App />,
  },
  {
    path: '/docs',
    element: <App />,
  },
  // Enhanced artist route with error handling
  {
    path: '/artists/:artistSlug',
    element: <App />,
    errorElement: <Error404 />,
  },
  // Enhanced show route
  {
    path: '/shows/:showSlug',
    element: <App />,
    errorElement: <ShowNotFound />, // Or generic 404
  },
  {
    path: '/artists',
    element: <App />,
  },
  {
    path: '/shows',
    element: <App />,
  },
  {
    path: '/trending',
    element: <App />,
  },
  {
    path: '/search',
    element: <App />,
  },
  {
    path: '/festivals',
    element: <App />,
  },
  {
    path: '/festivals/:festivalSlug',
    element: <App />,
  },
  {
    path: '/about',
    element: <AboutPage />,
  },
  {
    path: '/privacy',
    element: <PrivacyPage />,
  },
  {
    path: '/terms',
    element: <TermsPage />,
  },
  // Blog routes
  {
    path: '/blog',
    element: <BlogPage />,
  },
  {
    path: '/blog/:slug',
    element: <BlogPostPage />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
