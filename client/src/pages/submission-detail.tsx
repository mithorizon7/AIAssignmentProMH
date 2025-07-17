import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { API_ROUTES } from "@/lib/constants";
import { Assignment, SubmissionWithFeedback } from "@/lib/types";
import { AppShell } from "@/components/layout/app-shell";
import { SubmissionForm } from "@/components/student/submission-form";
import { SubmissionHistory } from "@/components/student/submission-history";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface SubmissionDetailProps {
  id: string;
}

export default function SubmissionDetail({ id }: SubmissionDetailProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const assignmentId = parseInt(id);
  
  const { data: assignment, isLoading: assignmentLoading } = useQuery<Assignment>({
    queryKey: [`${API_ROUTES.ASSIGNMENTS}/${assignmentId}`],
  });
  
  const { data: submissions, isLoading: submissionsLoading } = useQuery<SubmissionWithFeedback[]>({
    queryKey: [`${API_ROUTES.ASSIGNMENTS}/${assignmentId}/submissions`],
    enabled: !!assignmentId && !isNaN(assignmentId),
  });
  
  useEffect(() => {
    // Poll for feedback status updates if any submission is in "processing" state
    if (submissions?.some(s => s.status === 'processing')) {
      const intervalId = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: [`${API_ROUTES.SUBMISSIONS}`, assignmentId] });
      }, 5000); // Poll every 5 seconds
      
      return () => clearInterval(intervalId);
    }
  }, [submissions, assignmentId, queryClient]);
  
  const handleSubmissionComplete = (submission: SubmissionWithFeedback) => {
    // Update queries to reflect the new submission
    queryClient.invalidateQueries({ queryKey: [`${API_ROUTES.SUBMISSIONS}`, assignmentId] });
    
    // Show a toast notification
    toast({
      title: "Submission successful",
      description: "Your assignment has been submitted and is being processed.",
    });
  };
  
  if (!user) return null;
  
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-neutral-800">Assignment Submission</h1>
          <p className="text-neutral-600">Submit your work and receive AI feedback</p>
        </div>
        
        {assignmentLoading ? (
          <Skeleton className="h-64 rounded-lg mb-8" />
        ) : assignment ? (
          <div className="mb-8">
            <SubmissionForm 
              assignment={assignment} 
              onSubmissionComplete={handleSubmissionComplete}
            />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-8 text-center mb-8">
            <span className="material-icons text-4xl text-neutral-400 mb-2">error_outline</span>
            <h3 className="text-lg font-medium text-neutral-700 mb-1">Assignment not found</h3>
            <p className="text-neutral-600">The assignment you're looking for doesn't exist or you don't have access to it</p>
          </div>
        )}
        
        <div className="mb-8">
          <SubmissionHistory 
            submissions={submissions || []} 
            loading={submissionsLoading}
            assignmentTitle={assignment?.title}
            isAssignmentSpecific={true}
          />
        </div>
      </div>
    </AppShell>
  );
}
