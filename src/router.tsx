import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from './App';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
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
    path: '/venues',
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
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);