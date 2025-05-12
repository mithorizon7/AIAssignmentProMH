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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-48 rounded-lg" />
              ))}
            </div>
          ) : assignments?.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-8 text-center">
              <span className="material-icons text-4xl text-neutral-400 mb-2">assignment</span>
              <h3 className="text-lg font-medium text-neutral-700 mb-1">No active assignments</h3>
              <p className="text-neutral-600">No assignments are currently active. Check the 'My Assignments' page for all your assignments or contact your instructor.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {assignments?.filter(a => a.status === 'active').map((assignment) => (
                <AssignmentCard 
                  key={assignment.id}
                  assignment={assignment}
                  latestSubmission={assignment.submissions?.[0]}
                />
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
