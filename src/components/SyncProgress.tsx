"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function SyncProgress() {
  // Only admins can see sync progress - check admin first
  const isAdmin = useQuery((api as any).admin.isCurrentUserAdmin);
  
  // Only fetch sync jobs if user is admin
  const activeJobs = useQuery(
    (api as any).syncJobs.getActive,
    isAdmin === true ? {} : "skip"
  );
  
  // Don't show anything if not admin or no active jobs
  if (!isAdmin || !activeJobs || activeJobs.length === 0) {
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