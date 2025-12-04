import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "./ui/button";
import { Calendar, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { MagicCard } from "./ui/magic-card";
import { BorderBeam } from "./ui/border-beam";

export function ShowNotFound() {
  const navigate = useNavigate();

  React.useEffect(() => {
    toast.warning("Show not found – check the URL or search for upcoming concerts.");
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen flex items-center justify-center">
      <MagicCard className="relative overflow-hidden rounded-xl p-8 max-w-md w-full text-center bg-card border-0">
        <BorderBeam size={200} duration={12} className="opacity-20" />
        <div className="relative z-10 space-y-4">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Show Not Found</h1>
          <p className="text-muted-foreground">
            The concert you're looking for couldn't be found. It might not be in our database yet or the URL may be incorrect.
          </p>
          <div className="space-y-2">
            <Button onClick={() => navigate("/shows")} className="w-full">
              <Calendar className="h-4 w-4 mr-2" />
              Browse Shows
            </Button>
            <Button variant="ghost" onClick={() => navigate("/")} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </MagicCard>
    </div>
  );
}

