"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useEffect } from "react";

interface SyncJob {
  _id: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed";
  entityId?: string;
  startedAt?: number;
  completedAt?: number;
  errorMessage?: string;
}

interface SyncJobProgressProps {
  job: SyncJob;
  onComplete: () => void;
}

export function SyncProgress() {
  const [visibleJobs, setVisibleJobs] = useState<SyncJob[]>([]);
  const activeJobs = useQuery(api.syncJobs.getActive);
  const pendingJobs = useQuery(api.syncJobs.getPending, { limit: 5 });
  
  // Show progress for jobs that are running (subscribe live)
  const runningJobs = activeJobs || [];
  
  useEffect(() => {
    // Add new running jobs to visible list
    runningJobs.forEach((job: any) => {
      if (!visibleJobs.some(vJob => vJob._id === job._id)) {
        setVisibleJobs(prev => [...prev, job]);
      }
    });
  }, [runningJobs, visibleJobs]);

  const handleJobComplete = (jobId: string) => {
    setTimeout(() => {
      setVisibleJobs(prev => prev.filter(job => job._id !== jobId));
    }, 3000);
  };

  if (visibleJobs.length === 0) return null;

  return (
    <div className="border-b bg-muted/50">
      <div className="container mx-auto px-4 py-2">
        <div className="space-y-2">
          {visibleJobs.map(job => (
            <SyncJobProgress 
              key={job._id} 
              job={job} 
              onComplete={() => handleJobComplete(job._id)} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface ProgressData {
  status: string;
  currentPhase?: string;
  totalSteps?: number;
  completedSteps?: number;
  currentStep?: string;
  itemsProcessed?: number;
  totalItems?: number;
  progressPercentage?: number;
  startedAt?: number;
  completedAt?: number;
  errorMessage?: string;
}

function SyncJobProgress({ job, onComplete }: SyncJobProgressProps) {
  const [progress, setProgress] = useState<ProgressData>({
    status: job.status,
    currentPhase: "Initializing",
    progressPercentage: 0,
    currentStep: "Setting up sync job",
    itemsProcessed: 0,
  });

  useEffect(() => {
    if (job.status !== "running") {
      if (job.status === "completed") {
        setProgress({
          status: "completed",
          currentPhase: "Completed",
          progressPercentage: 100,
          currentStep: "Sync completed successfully",
          itemsProcessed: progress.totalItems || 100,
        });
        setTimeout(onComplete, 2000);
      }
      return;
    }

    // Set up SSE connection for real-time progress updates
    const eventSource = new EventSource(`/api/sync-progress?jobId=${job._id}`);
    
    eventSource.onmessage = (event) => {
      try {
        const data: ProgressData = JSON.parse(event.data);
        setProgress(data);
        
        // Handle completion
        if (data.status === "completed") {
          setTimeout(onComplete, 2000);
          eventSource.close();
        } else if (data.status === "failed") {
          eventSource.close();
        }
      } catch (error) {
        console.error("Error parsing SSE data:", error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error("SSE connection error:", error);
      eventSource.close();
    };
    
    return () => {
      eventSource.close();
    };
  }, [job.status, job._id, onComplete, progress.totalItems]);

  const isCompleted = progress.progressPercentage === 100 || progress.status === "completed";
  const isFailed = progress.status === "failed";
  const percentage = progress.progressPercentage || 0;

  const getStatusIcon = () => {
    if (isFailed) {
      return (
        <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      );
    }
    if (isCompleted) {
      return (
        <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="m9 12 2 2 4-4"></path>
          <circle cx="12" cy="12" r="10"></circle>
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5 text-muted-foreground animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    );
  };

  return (
    <div className="flex items-center gap-3 text-sm">
      {getStatusIcon()}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium">
            {job.type.replace("_", " ").toUpperCase()} - {progress.currentPhase || "Processing"}
          </span>
          <span className="text-muted-foreground">{Math.round(percentage)}%</span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{progress.currentStep || "Processing..."}</span>
          <span>
            {progress.itemsProcessed || 0}
            {progress.totalItems ? ` / ${progress.totalItems}` : ""} items
          </span>
        </div>
        {progress.totalSteps && progress.completedSteps !== undefined && (
          <div className="text-xs text-muted-foreground mb-1">
            Step {progress.completedSteps + 1} of {progress.totalSteps}
          </div>
        )}
        <div className="w-full bg-muted rounded-full h-1.5 mt-1">
          <div 
            className={`h-1.5 rounded-full transition-all duration-300 ${
              isFailed ? "bg-muted-foreground" : "bg-primary"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {(progress.errorMessage || job.errorMessage) && (
          <div className="mt-2 p-2 bg-muted/20 border border-muted rounded text-sm text-foreground">
            Error: {progress.errorMessage || job.errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}
