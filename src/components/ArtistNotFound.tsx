import React from 'react';
import { useNavigate, useRouteError } from 'react-router-dom';
import { Button } from "./ui/button";
import { Search, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { MagicCard } from "./ui/magic-card";
import { BorderBeam } from "./ui/border-beam";

interface ArtistNotFoundProps {
  error?: string;
  resetErrorBoundary?: () => void;
}

export function ArtistNotFound({ error, resetErrorBoundary }: ArtistNotFoundProps) {
  const navigate = useNavigate();

  React.useEffect(() => {
    toast.warning("Artist not found – try searching again or check the URL.");
  }, []);

  const handleSearch = () => {
    navigate("/search");
  };

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen flex items-center justify-center">
      <MagicCard className="relative overflow-hidden rounded-2xl p-8 max-w-md w-full text-center bg-black border-0">
        <BorderBeam size={200} duration={12} className="opacity-20" />
        <div className="relative z-10 space-y-4">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="h-8 w-8 text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Artist Not Found</h1>
          <p className="text-gray-400">
            The artist you're looking for couldn't be found. It might be a typo in the URL or the artist may not be in our database yet.
          </p>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="space-y-2">
            <Button onClick={handleSearch} className="w-full">
              <Search className="h-4 w-4 mr-2" />
              Search Artists
            </Button>
            <Button variant="ghost" onClick={() => navigate("/")} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </div>
          {resetErrorBoundary && (
            <Button variant="link" onClick={resetErrorBoundary} className="text-xs text-gray-500">
              Try Again
            </Button>
          )}
        </div>
      </MagicCard>
    </div>
  );
}
