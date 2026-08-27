import React from 'react';
import { createBrowserRouter, Navigate, useRouteError } from 'react-router-dom';
import { App } from './App';
import { ArtistNotFound } from './components/ArtistNotFound';
import { ShowNotFound } from './components/ShowNotFound'; // Assume similar for shows
import { ProtectedLayout } from './components/ProtectedLayout';
import { SEOHead } from './components/SEOHead';
import { AnalyticsLifecycle } from './components/AnalyticsLifecycle';

// Keep the fan-facing shell lean. Auth, studio, blog/Sanity, and legal pages
// are loaded only when their route is visited.
const SignInPage = React.lazy(() => import('./pages/SignInPage').then((m) => ({ default: m.SignInPage })));
const SignUpPage = React.lazy(() => import('./pages/SignUpPage').then((m) => ({ default: m.SignUpPage })));
const UserProfilePage = React.lazy(() => import('./pages/UserProfilePage').then((m) => ({ default: m.UserProfilePage })));
const SSOCallback = React.lazy(() => import('./pages/SSOCallback').then((m) => ({ default: m.SSOCallback })));
const SpotifyConnectPage = React.lazy(() => import('./pages/SpotifyConnectPage').then((m) => ({ default: m.SpotifyConnectPage })));
const PrivacyPage = React.lazy(() => import('./pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage })));
const TermsPage = React.lazy(() => import('./pages/TermsPage').then((m) => ({ default: m.TermsPage })));
const AboutPage = React.lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const BlogPage = React.lazy(() => import('./pages/BlogPage').then((m) => ({ default: m.BlogPage })));
const BlogPostPage = React.lazy(() => import('./pages/BlogPostPage').then((m) => ({ default: m.BlogPostPage })));
const ForArtistsPage = React.lazy(() => import('./pages/ForArtistsPage').then((m) => ({ default: m.ForArtistsPage })));
const ForArtistsDashboardPage = React.lazy(() => import('./pages/ForArtistsDashboardPage').then((m) => ({ default: m.ForArtistsDashboardPage })));
const ForArtistsShowDemandPage = React.lazy(() => import('./pages/ForArtistsShowDemandPage').then((m) => ({ default: m.ForArtistsShowDemandPage })));
const ForArtistsTeamPage = React.lazy(() => import('./pages/ForArtistsTeamPage').then((m) => ({ default: m.ForArtistsTeamPage })));
const ArtistClaimPage = React.lazy(() => import('./pages/ArtistClaimPage').then((m) => ({ default: m.ArtistClaimPage })));
const AcceptInvitePage = React.lazy(() => import('./pages/AcceptInvitePage').then((m) => ({ default: m.AcceptInvitePage })));

// Error boundary component for 404
function Error404({ resetErrorBoundary }: { resetErrorBoundary: () => void }) {
  const error = useRouteError() as Error;
  return <ArtistNotFound error={error.message} resetErrorBoundary={resetErrorBoundary} />;
}

export const router = createBrowserRouter([
  {
    element: <AnalyticsLifecycle />,
    children: [
  {
    path: '/',
    element: <App />,
  },
  {
    // SEOHead applies the robots "noindex" meta for these auth paths
    // (see NOINDEX_PREFIXES in SEOHead).
    path: '/signin',
    element: <><SEOHead /><SignInPage /></>,
  },
  {
    path: '/signup',
    element: <><SEOHead /><SignUpPage /></>,
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
    ],
  },
]);
