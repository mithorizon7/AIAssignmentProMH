import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { SubmissionWithFeedback } from '@/lib/types';

interface UseSubmissionPollingOptions {
  enabled?: boolean;
  onFeedbackReady?: (submission: SubmissionWithFeedback) => void;
}

/**
 * Hook for real-time polling of submission status
 * Automatically polls submissions that are in "processing" status
 */
export function useSubmissionPolling(userId: number, options: UseSubmissionPollingOptions = {}) {
  const { enabled = true, onFeedbackReady } = options;
  const queryClient = useQueryClient();
  const processingSubmissionsRef = useRef<Set<number>>(new Set());
  const onFeedbackReadyRef = useRef(onFeedbackReady);
  
  // Update the callback ref when it changes
  useEffect(() => {
    onFeedbackReadyRef.current = onFeedbackReady;
  }, [onFeedbackReady]);

  // Main submissions query with conditional polling
  const { data: submissions = [], isLoading } = useQuery<SubmissionWithFeedback[]>({
    queryKey: ['/api/submissions'],
    enabled: enabled && !!userId,
    refetchInterval: (data) => {
      if (!data || !Array.isArray(data)) return false;
      
      // Check if any submissions are in processing status
      const hasProcessing = data.some((submission: SubmissionWithFeedback) => 
        submission.status === 'processing' || submission.status === 'pending'
      );
      
      // Poll every 3 seconds if there are processing submissions, otherwise stop
      return hasProcessing ? 3000 : false;
    },
    refetchIntervalInBackground: false, // Only poll when tab is active
  });

  // Track feedback completion and trigger callbacks
  useEffect(() => {
    if (!Array.isArray(submissions) || !submissions.length) return;

    submissions.forEach((submission: SubmissionWithFeedback) => {
      const wasProcessing = processingSubmissionsRef.current.has(submission.id);
      const isNowComplete = submission.status === 'completed' && submission.feedback;
      
      // If submission was processing and now has feedback, trigger callback
      if (wasProcessing && isNowComplete && onFeedbackReadyRef.current) {
        onFeedbackReadyRef.current(submission);
        processingSubmissionsRef.current.delete(submission.id);
      }
      
      // Track submissions that are currently processing
      if (submission.status === 'processing' || submission.status === 'pending') {
        processingSubmissionsRef.current.add(submission.id);
      } else {
        processingSubmissionsRef.current.delete(submission.id);
      }
    });
  }, [submissions]);

  // Get processing submissions for UI indicators
  const processingSubmissions = Array.isArray(submissions) 
    ? submissions.filter((s: SubmissionWithFeedback) => 
        s.status === 'processing' || s.status === 'pending'
      )
    : [];

  // Manual refresh function
  const refreshSubmissions = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/submissions'] });
  };

  return {
    submissions,
    isLoading,
    processingSubmissions,
    hasProcessingSubmissions: processingSubmissions.length > 0,
    refreshSubmissions
  };
}