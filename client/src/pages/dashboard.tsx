import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { API_ROUTES, USER_ROLES } from "@/lib/constants";
import { AssignmentWithSubmissions, SubmissionWithFeedback } from "@/lib/types";
import { AppShell } from "@/components/layout/app-shell";
import { AssignmentCard } from "@/components/student/assignment-card";
import { SubmissionHistory } from "@/components/student/submission-history";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, BookOpen } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  
  // Redirect instructors to their dashboard
  useEffect(() => {
    if (user?.role === USER_ROLES.INSTRUCTOR) {
      navigate('/instructor/dashboard');
    }
  }, [user, navigate]);
  
  const { data: assignments, isLoading: assignmentsLoading } = useQuery<AssignmentWithSubmissions[]>({
    queryKey: [API_ROUTES.ASSIGNMENTS],
  });
  
  const { data: recentSubmissions = [], isLoading: submissionsLoading } = useQuery<SubmissionWithFeedback[]>({
    queryKey: [API_ROUTES.SUBMISSIONS, 'recent'],
  });
  
  if (!user) return null;
  
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-neutral-800">Dashboard</h1>
          <p className="text-neutral-600">Welcome back, {user.name}</p>
        </div>
        
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-neutral-800 mb-4">Active Assignments</h2>
          
          {assignmentsLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 stagger-children">
              {[1, 2].map((i) => (
                <div key={i} style={{animationDelay: `${i * 100}ms`}}>
                  <Card className="overflow-hidden shimmer h-48">
                    <CardContent className="p-5">
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <Skeleton className="h-6 w-3/4" />
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                        <Skeleton className="h-4 w-1/2" />
                        <div className="flex">
                          <Skeleton className="h-4 w-4 mr-2 rounded-full" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          ) : assignments?.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-8 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 mb-4">
                <ClipboardList className="h-6 w-6 text-neutral-500" />
              </div>
              <h3 className="text-lg font-medium text-neutral-700 mb-2">No active assignments</h3>
              <p className="text-neutral-600 mb-4">You don't have any active assignments at the moment.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/assignments')}
                  className="justify-center"
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  View all assignments
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => window.location.reload()}
                  className="justify-center"
                >
                  Refresh dashboard
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 stagger-children">
              {assignments?.filter(a => a.status === 'active').map((assignment, index) => (
                <div key={assignment.id} className={`fade-in`} style={{animationDelay: `${index * 100}ms`}}>
                  <AssignmentCard 
                    assignment={assignment}
                    latestSubmission={assignment.submissions?.[0]}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="mb-8">
          <SubmissionHistory 
            submissions={recentSubmissions} 
            loading={submissionsLoading} 
          />
        </div>
      </div>
    </AppShell>
  );
}
