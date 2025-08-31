import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { App } from './App';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { AdminTest } from './components/AdminTest';

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
    path: '/artists/:artistSlug',
    element: <App />,
  },
  {
    path: '/shows/:showSlug',
    element: <App />,
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
    path: '/library',
    element: <App />,
  },
  {
    path: '/profile',
    element: <App />,
  },
  {
    path: '/admin',
    element: <App />,
  },
  {
    path: '/test',
    element: <App />,
  },
  {
    path: '/admin-test',
    element: <AdminTest />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);