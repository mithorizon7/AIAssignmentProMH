import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FeedbackCard } from "@/components/ui/feedback-card";
import { formatDate } from "@/lib/utils/format";
import { SubmissionWithFeedback } from "@/lib/types";
import { useState } from "react";
import { History, Loader2, ArrowUpCircle, FileText } from "lucide-react";
import { useLocation } from "wouter";

interface SubmissionHistoryProps {
  submissions: SubmissionWithFeedback[];
  loading?: boolean;
}

export function SubmissionHistory({ submissions, loading = false }: SubmissionHistoryProps) {
  const [expandedFeedbacks, setExpandedFeedbacks] = useState<Record<number, boolean>>({});
  const [, navigate] = useLocation();
  
  const toggleFeedback = (submissionId: number) => {
    setExpandedFeedbacks(prev => ({
      ...prev,
      [submissionId]: !prev[submissionId]
    }));
  };
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Submission History</CardTitle>
          <CardDescription>Loading your previous submissions...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center p-10">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
        </CardContent>
      </Card>
    );
  }
  
  if (submissions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Submission History</CardTitle>
          <CardDescription>View your previous submissions and AI feedback</CardDescription>
        </CardHeader>
        <CardContent className="p-10 text-center">
          <span className="material-icons text-4xl text-neutral-400 mb-2">history</span>
          <h3 className="text-lg font-medium text-neutral-700 mb-1">No submissions yet</h3>
          <p className="text-neutral-600">Select an active assignment from above to submit your work and receive AI feedback</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Submission History</CardTitle>
        <CardDescription>View your previous submissions and AI feedback</CardDescription>
      </CardHeader>
      
      <CardContent className="p-6">
        {submissions.map((submission, index) => (
          <div 
            key={submission.id}
            className={`border-l-2 ${
              index === 0 ? 'border-primary' : 'border-neutral-300'
            } pl-4 pb-8 relative`}
          >
            <div 
              className={`absolute w-3 h-3 ${
                index === 0 ? 'bg-primary' : 'bg-neutral-300'
              } rounded-full -left-[7px]`}
            ></div>
            
            <div className="mb-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-neutral-800">Submission #{submissions.length - index}</h3>
                  <p className="text-sm text-neutral-600">{formatDate(submission.createdAt)}</p>
                </div>
                {index === 0 && (
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                    Latest
                  </span>
                )}
                {index > 0 && (
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-neutral-100 text-neutral-800">
                    Previous
                  </span>
                )}
              </div>
            </div>
            
            {/* Feedback Card */}
            {submission.feedback ? (
              <FeedbackCard 
                feedback={submission.feedback} 
                expanded={!!expandedFeedbacks[submission.id]}
                onToggle={() => toggleFeedback(submission.id)}
              />
            ) : (
              submission.status === 'processing' ? (
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-neutral-800">AI Feedback</h4>
                    <span className="text-xs text-neutral-500 flex items-center">
                      <span className="material-icons animate-spin mr-1">refresh</span>
                      Processing...
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-neutral-800">AI Feedback</h4>
                    <span className="text-xs text-neutral-500">
                      Feedback unavailable
                    </span>
                  </div>
                </div>
              )
            )}
            
            {/* Submission File/Content Link */}
            <div className="bg-white border border-neutral-200 rounded-lg p-3 flex justify-between items-center">
              <div className="flex items-center">
                <span className="material-icons text-neutral-400 mr-2">
                  {submission.fileName ? 'description' : 'code'}
                </span>
                <span className="text-sm text-neutral-700">
                  {submission.fileName || 'Code submission'}
                </span>
              </div>
              <Button variant="ghost" size="sm" className="text-primary hover:text-primary-dark">
                {submission.fileName ? 'Download' : 'View'}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
