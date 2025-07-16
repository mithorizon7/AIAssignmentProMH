import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FeedbackCard } from "@/components/ui/feedback-card";
import { formatDate } from "@/lib/utils/format";
import { SubmissionWithFeedback } from "@/lib/types";
import { useState } from "react";
import { 
  History, Loader2, ArrowUpCircle, FileText, File, 
  Image, FileCode, Video, Music, PieChart, FileJson, 
  CheckCircle, AlertCircle, ChevronDown, ChevronRight,
  BookOpen, Calendar, User, Clock
} from "lucide-react";
import { useLocation } from "wouter";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Helper function to get appropriate file icon based on file type
function getSubmissionFileIcon(fileType: string, fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  if (fileType.startsWith('image/')) {
    return <Image size={18} className="text-blue-600 mr-2" />;
  } else if (fileType.startsWith('video/')) {
    return <Video size={18} className="text-purple-600 mr-2" />;
  } else if (fileType.startsWith('audio/')) {
    return <Music size={18} className="text-amber-600 mr-2" />;
  } else if (fileType.startsWith('text/')) {
    return <FileText size={18} className="text-gray-600 mr-2" />;
  } else if (['application/pdf'].includes(fileType)) {
    return <FileText size={18} className="text-red-600 mr-2" />;
  } else if (['application/json'].includes(fileType) || extension === 'json') {
    return <FileJson size={18} className="text-green-600 mr-2" />;
  } else if ([
    'application/javascript', 
    'application/typescript',
    'application/x-python',
    'text/x-python',
    'application/x-java',
    'text/x-java'
  ].includes(fileType) || ['js', 'ts', 'py', 'java', 'c', 'cpp', 'html', 'css'].includes(extension)) {
    return <FileCode size={18} className="text-indigo-600 mr-2" />;
  } else if (['csv', 'xls', 'xlsx', 'numbers'].includes(extension)) {
    return <PieChart size={18} className="text-emerald-600 mr-2" />;
  }
  
  return <File size={18} className="text-neutral-600 mr-2" />;
}

// Helper to format file size
function formatSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

interface SubmissionHistoryByAssignmentProps {
  assignments: any[];
  loading?: boolean;
}

export function SubmissionHistoryByAssignment({ assignments, loading = false }: SubmissionHistoryByAssignmentProps) {
  const [expandedFeedbacks, setExpandedFeedbacks] = useState<Record<number, boolean>>({});
  const [expandedAssignments, setExpandedAssignments] = useState<Record<number, boolean>>({});
  const [, navigate] = useLocation();
  
  const toggleFeedback = (submissionId: number) => {
    setExpandedFeedbacks(prev => ({
      ...prev,
      [submissionId]: !prev[submissionId]
    }));
  };
  
  const toggleAssignment = (assignmentId: number) => {
    setExpandedAssignments(prev => ({
      ...prev,
      [assignmentId]: !prev[assignmentId]
    }));
  };
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Submission History by Assignment</CardTitle>
          <CardDescription>Loading your submissions organized by assignment...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center p-10">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
        </CardContent>
      </Card>
    );
  }
  
  // Filter assignments that have submissions
  const assignmentsWithSubmissions = assignments.filter(assignment => 
    assignment.submissions && assignment.submissions.length > 0
  );
  
  if (assignmentsWithSubmissions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Submission History by Assignment</CardTitle>
          <CardDescription>View your submissions organized by assignment</CardDescription>
        </CardHeader>
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center">
            <div className="mb-6 relative">
              <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center border border-indigo-100">
                <History className="h-8 w-8 text-indigo-500" />
              </div>
              <div className="absolute -top-2 -right-2 bg-primary rounded-full p-1.5 shadow-md animate-pulse">
                <AlertCircle className="h-4 w-4 text-white" />
              </div>
            </div>
            
            <h3 className="text-xl font-semibold text-neutral-800 mb-3">Your submission journey starts here</h3>
            <p className="text-neutral-600 mb-6 max-w-md">
              Submit your first assignment to see your work organized by assignment. 
              Track your progress and review detailed AI feedback for each submission.
            </p>
            
            <Button 
              onClick={() => navigate('/assignments')}
              className="inline-flex items-center justify-center px-6 h-11 bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-md hover:shadow-lg transition-all"
              size="lg"
            >
              <ArrowUpCircle className="mr-2 h-5 w-5" />
              Find assignments to submit
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Submission History by Assignment</CardTitle>
        <CardDescription>
          View your submissions organized by assignment ({assignmentsWithSubmissions.length} assignments with submissions)
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="space-y-4">
          {assignmentsWithSubmissions.map((assignment) => (
            <Card key={assignment.id} className="border-l-4 border-l-primary">
              <Collapsible 
                open={expandedAssignments[assignment.id] || false}
                onOpenChange={(open) => {
                  if (open) {
                    setExpandedAssignments(prev => ({ ...prev, [assignment.id]: true }));
                  } else {
                    setExpandedAssignments(prev => ({ ...prev, [assignment.id]: false }));
                  }
                }}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center transition-transform group-hover:translate-x-1">
                          {expandedAssignments[assignment.id] ? (
                            <ChevronDown className="h-5 w-5 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-gray-500" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <BookOpen className="h-5 w-5 text-primary" />
                            <CardTitle className="text-lg group-hover:text-primary transition-colors">
                              {assignment.title}
                            </CardTitle>
                          </div>
                          <CardDescription className="flex items-center space-x-4 mt-1">
                            <span className="flex items-center">
                              <User className="h-4 w-4 mr-1" />
                              {assignment.course.name}
                            </span>
                            <span className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              Due: {formatDate(assignment.dueDate)}
                            </span>
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {assignment.submissions.length} submission{assignment.submissions.length !== 1 ? 's' : ''}
                        </Badge>
                        <Badge variant={assignment.status === 'active' ? 'default' : 'secondary'}>
                          {assignment.status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      {assignment.submissions.map((submission: SubmissionWithFeedback, index: number) => (
                        <div 
                          key={submission.id}
                          className={`border-l-2 ${
                            index === 0 ? 'border-primary' : 'border-neutral-300'
                          } pl-4 pb-6 relative`}
                        >
                          <div 
                            className={`absolute w-3 h-3 ${
                              index === 0 ? 'bg-primary' : 'bg-neutral-300'
                            } rounded-full -left-[7px]`}
                          ></div>
                          
                          <div className="mb-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-medium text-neutral-800">
                                  Submission #{assignment.submissions.length - index}
                                </h4>
                                <p className="text-sm text-neutral-600 flex items-center">
                                  <Clock className="h-4 w-4 mr-1" />
                                  {formatDate(submission.createdAt)}
                                </p>
                              </div>
                              {index === 0 && (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                  Latest
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Submission Content */}
                          <div className="mb-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center">
                                {submission.fileName && getSubmissionFileIcon(submission.mimeType || '', submission.fileName)}
                                <span className="text-sm font-medium text-neutral-700">
                                  {submission.fileName || 'Text Submission'}
                                </span>
                              </div>
                              {submission.fileSize && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <span className="text-xs text-neutral-500 bg-white px-2 py-1 rounded">
                                        {formatSize(submission.fileSize)}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>File size: {formatSize(submission.fileSize)}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                            
                            {submission.content && (
                              <div className="text-sm text-neutral-600 bg-white p-3 rounded border border-gray-200 max-h-32 overflow-y-auto shadow-inner">
                                <div className="font-mono text-xs">
                                  {submission.content.substring(0, 200)}
                                  {submission.content.length > 200 && (
                                    <span className="text-primary ml-1">
                                      ... ({submission.content.length - 200} more characters)
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Feedback Section */}
                          {submission.feedback ? (
                            <div className="mb-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium text-neutral-800 flex items-center">
                                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                                  AI Feedback
                                </h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleFeedback(submission.id)}
                                  className="text-primary hover:text-primary-dark hover:bg-primary/10 transition-colors"
                                >
                                  {expandedFeedbacks[submission.id] ? 'Hide' : 'Show'} Details
                                </Button>
                              </div>
                              
                              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                                {submission.feedback.score !== null && (
                                  <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-medium text-blue-800">Score:</span>
                                    <div className="flex items-center space-x-2">
                                      <Progress 
                                        value={submission.feedback.score} 
                                        className="w-24 h-2" 
                                      />
                                      <span className="text-sm font-bold text-blue-800 bg-white px-2 py-1 rounded">
                                        {submission.feedback.score}%
                                      </span>
                                    </div>
                                  </div>
                                )}
                                
                                {submission.feedback.summary && (
                                  <div className="bg-white p-3 rounded border border-blue-200 mb-3">
                                    <p className="text-sm text-blue-700">
                                      <strong className="text-blue-800">Summary:</strong> {submission.feedback.summary}
                                    </p>
                                  </div>
                                )}
                                
                                {expandedFeedbacks[submission.id] && (
                                  <FeedbackCard 
                                    feedback={submission.feedback}
                                    className="mt-3"
                                  />
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="mb-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
                              <div className="flex items-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-600 border-t-transparent mr-3"></div>
                                <p className="text-sm text-amber-700">
                                  <strong>Feedback is being generated.</strong> Please check back shortly.
                                </p>
                              </div>
                            </div>
                          )}
                          
                          <div className="flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/submission/${assignment.id}`)}
                              className="text-primary border-primary hover:bg-primary/5 hover:border-primary/70 transition-all duration-200"
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              View Full Details
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}