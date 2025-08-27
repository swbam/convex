import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useEffect } from "react";
import { Loader2, CheckCircle } from "lucide-react";

export function SyncProgress() {
  const [visibleJobs, setVisibleJobs] = useState<string[]>([]);
  const pendingJobs = useQuery(api.syncJobs.getPending, { limit: 5 });
  
  // Show progress for jobs that are running
  const runningJobs = pendingJobs?.filter((job: any) => job.status === "running") || [];
  
  useEffect(() => {
    // Add new running jobs to visible list
    runningJobs.forEach((job: any) => {
      if (!visibleJobs.includes(job._id)) {
        setVisibleJobs(prev => [...prev, job._id]);
      }
    });
  }, [runningJobs, visibleJobs]);

  // Remove completed jobs after a delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisibleJobs(prev => 
        prev.filter(jobId => 
          runningJobs.some((job: any) => job._id === jobId)
        )
      );
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [runningJobs]);

  if (visibleJobs.length === 0) return null;

  return (
    <div className="border-b bg-muted/50">
      <div className="container mx-auto px-4 py-2">
        <div className="space-y-2">
          {visibleJobs.map(jobId => (
            <SyncJobProgress key={jobId} jobId={jobId} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SyncJobProgress({ jobId }: { jobId: string }) {
  // Create a mock progress object since the query is commented out
  const progress = {
    phase: "Syncing data...",
    percentage: 75,
    currentStep: "Processing artists",
    itemsProcessed: 42
  };

  const getStatusIcon = () => {
    if (progress.percentage === 100) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  };

  return (
    <div className="flex items-center gap-3 text-sm">
      {getStatusIcon()}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium">{progress.phase}</span>
          <span className="text-muted-foreground">{progress.percentage}%</span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{progress.currentStep}</span>
          {progress.itemsProcessed > 0 && (
            <span>{progress.itemsProcessed} items processed</span>
          )}
        </div>
        <div className="w-full bg-muted rounded-full h-1.5 mt-1">
          <div 
            className="bg-primary h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
