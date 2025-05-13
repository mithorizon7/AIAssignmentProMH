import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { API_ROUTES, APP_ROUTES } from "@/lib/constants";
import { AppShell } from "@/components/layout/app-shell";
import { SubmissionHistory } from "@/components/student/submission-history";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { History, Clock, FilePlus } from "lucide-react";
import { useLocation } from "wouter";

export default function SubmissionHistoryPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  
  // Fetch all assignments to allow filtering of submissions
  const { data: assignments, isLoading: isLoadingAssignments } = useQuery<any[]>({
    queryKey: [API_ROUTES.ASSIGNMENTS],
    enabled: !!user,
  });
  
  // Fetch all submissions for the user
  const { data: submissions, isLoading: isLoadingSubmissions } = useQuery<any[]>({
    queryKey: [API_ROUTES.SUBMISSIONS],
    enabled: !!user,
  });
  
  // Filter submissions by selected assignment
  const filteredSubmissions = selectedAssignmentId
    ? submissions?.filter(submission => submission.assignmentId === selectedAssignmentId)
    : submissions;
  
  return (
    <AppShell>
      <div className="container max-w-6xl py-6 space-y-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Submission History</h1>
            <p className="text-muted-foreground">View and manage all your previous submissions</p>
          </div>
        </div>
        
        <div className="grid gap-6">
          {/* Assignment Filter */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium">Filter by Assignment</CardTitle>
              <CardDescription>
                Select an assignment to view only submissions for that assignment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedAssignmentId === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedAssignmentId(null)}
                >
                  All Submissions
                </Button>
                
                {isLoadingAssignments ? (
                  <div className="grid grid-cols-3 gap-2 w-full">
                    <Skeleton className="h-9 w-32" />
                    <Skeleton className="h-9 w-32" />
                    <Skeleton className="h-9 w-32" />
                  </div>
                ) : (
                  assignments?.map(assignment => (
                    <Button
                      key={assignment.id}
                      variant={selectedAssignmentId === assignment.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedAssignmentId(assignment.id)}
                    >
                      {assignment.title}
                    </Button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Submission List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium">Your Submissions</CardTitle>
              <CardDescription>
                {filteredSubmissions?.length ?? 0} submission{(filteredSubmissions?.length ?? 0) !== 1 ? 's' : ''} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSubmissions ? (
                <div className="space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : filteredSubmissions?.length ? (
                <SubmissionHistory 
                  submissions={filteredSubmissions}
                  showAssignmentTitle={selectedAssignmentId === null}
                />
              ) : (
                <div className="text-center p-8">
                  <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No submissions found</h3>
                  <p className="text-muted-foreground mb-4">
                    {selectedAssignmentId === null 
                      ? "You haven't submitted any assignments yet." 
                      : "You haven't submitted this assignment yet."}
                  </p>
                  <Button
                    onClick={() => navigate(APP_ROUTES.ASSIGNMENTS)}
                    className="gap-2"
                  >
                    <FilePlus className="h-4 w-4" />
                    Browse Assignments
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}