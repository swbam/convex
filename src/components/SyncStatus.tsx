import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Activity, CheckCircle, AlertCircle, Clock } from "lucide-react";

export function SyncStatus() {
  // Check admin status first
  const isAdmin = useQuery((api as any).admin.isCurrentUserAdmin);
  
  const syncStatus = useQuery(api.syncStatus.getStatus);
  
  // Only fetch active jobs if user is admin
  const activeJobs = useQuery(
    (api as any).syncJobs.getActive,
    isAdmin === true ? {} : "skip"
  );

  if (!syncStatus) return null;

  const isActive = (activeJobs?.length || 0) > 0;
  const lastSync = syncStatus.lastSync ? new Date(syncStatus.lastSync) : null;

  return (
    <div className="flex items-center gap-2 text-sm">
      {isActive ? (
        <>
          <Activity className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-muted-foreground">Syncing...</span>
          <div className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
            {activeJobs?.length} jobs
          </div>
        </>
      ) : (
        <>
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-muted-foreground">
            {lastSync ? `Synced ${formatTimeAgo(lastSync)}` : "Ready"}
          </span>
        </>
      )}
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
