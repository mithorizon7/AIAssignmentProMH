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
            <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-8 text-center max-w-2xl mx-auto fade-in">
              <div className="relative mb-6">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
                  <ClipboardList className="h-8 w-8 text-primary" />
                </div>
                <div className="absolute top-0 right-1/2 transform translate-x-12 -translate-y-1 animate-bounce delay-300">
                  <span className="flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                  </span>
                </div>
              </div>
              
              <h3 className="text-xl font-semibold text-neutral-800 mb-3">Ready to start learning?</h3>
              <p className="text-neutral-600 mb-6 max-w-md mx-auto">
                Your dashboard will show your active assignments and recent submissions. 
                Discover available assignments to begin using AI-powered feedback.
              </p>
              
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/assignments')}
                    className="justify-center h-11 px-6 hover:bg-blue-50 hover:text-blue-700 transition-all"
                    size="lg"
                  >
                    <BookOpen className="mr-2 h-5 w-5" />
                    Browse assignments
                  </Button>
                  <Button 
                    variant="secondary"
                    onClick={() => window.location.reload()}
                    className="justify-center h-11 px-6 transition-all"
                    size="lg"
                  >
                    <svg className="mr-2 h-5 w-5" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                    Refresh dashboard
                  </Button>
                </div>
                
                <div className="border-t border-neutral-200 pt-5 text-sm text-neutral-500">
                  <p>Need help? Check out our <span className="text-primary hover:underline cursor-pointer">quick start guide</span> or <span className="text-primary hover:underline cursor-pointer">contact support</span>.</p>
                </div>
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
