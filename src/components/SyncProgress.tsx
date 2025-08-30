"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function SyncProgress() {
  const activeJobs = useQuery(api.syncJobs.getActive);
  
  // Don't show anything if no active jobs
  if (!activeJobs || activeJobs.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <div className="bg-muted/20 border border-border rounded-lg p-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></div>
          <span>Syncing data in background...</span>
        </div>
      </div>
    </div>
  );
}