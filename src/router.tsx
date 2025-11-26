import React from 'react';
import { createBrowserRouter, Navigate, useRouteError } from 'react-router-dom';
import { App } from './App';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { UserProfilePage } from './pages/UserProfilePage';
import { SSOCallback } from './pages/SSOCallback';
import { SpotifyConnectPage } from './pages/SpotifyConnectPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { ArtistNotFound } from './components/ArtistNotFound';
import { ShowNotFound } from './components/ShowNotFound'; // Assume similar for shows

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
    element: <SSOCallback />,
  },
  {
    path: '/profile',
    element: <UserProfilePage />,
  },
  {
    path: '/spotify-connect',
    element: <SpotifyConnectPage />,
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
    path: '/privacy',
    element: <PrivacyPage />,
  },
  {
    path: '/terms',
    element: <TermsPage />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
