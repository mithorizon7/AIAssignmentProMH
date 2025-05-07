import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { API_ROUTES, USER_ROLES, APP_ROUTES } from "@/lib/constants";
import { AppShell } from "@/components/layout/app-shell";
import { StatsCard } from "@/components/instructor/stats-card";
import { AssignmentTable } from "@/components/instructor/assignment-table";
import { StudentProgress } from "@/components/instructor/student-progress";
import { AnalyticsPanel } from "@/components/instructor/analytics-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function InstructorDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [studentsPage, setStudentsPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Redirect students to their dashboard
  useEffect(() => {
    if (user?.role === USER_ROLES.STUDENT) {
      navigate('/dashboard');
    }
  }, [user, navigate]);
  
  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: [`${API_ROUTES.ASSIGNMENTS}/stats`],
  });
  
  // Fetch assignments with submission stats
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: [`${API_ROUTES.ASSIGNMENTS}/instructor`],
  });
  
  // Fetch student progress paginated
  const { data: studentProgressData, isLoading: studentsLoading } = useQuery({
    queryKey: [
      `${API_ROUTES.STUDENTS}/progress`, 
      { page: studentsPage, search: searchQuery, status: statusFilter }
    ],
  });
  
  // Fetch analytics data for the most recent active assignment
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: [`${API_ROUTES.ASSIGNMENTS}/analytics`],
  });
  
  const handleExportCsv = async (assignmentId: number) => {
    try {
      const response = await apiRequest('GET', `${API_ROUTES.EXPORT_CSV}?assignmentId=${assignmentId}`, undefined);
      
      // Create blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `assignment_${assignmentId}_grades.csv`;
      
      // Append to document, click, and clean up
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "CSV Export Successful",
        description: "The grades have been exported to CSV successfully.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "There was an error exporting the grades to CSV.",
      });
    }
  };
  
  if (!user) return null;
  
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-neutral-800">Instructor Dashboard</h1>
          <p className="text-neutral-600">Monitor student submissions and review AI feedback</p>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsLoading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </>
          ) : (
            <>
              <StatsCard 
                title="Total Submissions" 
                value={stats?.totalSubmissions} 
                icon="assignment_turned_in" 
                iconColor="primary"
                change={{ 
                  value: `${stats?.submissionsIncrease}% increase this week`, 
                  positive: true 
                }}
              />
              <StatsCard 
                title="Pending Reviews" 
                value={stats?.pendingReviews} 
                icon="pending_actions" 
                iconColor="amber-500"
                change={{ 
                  value: "Needs your attention", 
                  neutral: true,
                  icon: "info"
                }}
              />
              <StatsCard 
                title="Average Score" 
                value={`${stats?.averageScore}%`} 
                icon="analytics" 
                iconColor="green-500"
                change={{ 
                  value: "Similar to last assignment", 
                  neutral: true,
                  icon: "trending_flat"
                }}
              />
              <StatsCard 
                title="AI Feedback Generated" 
                value={stats?.feedbackGenerated} 
                icon="smart_toy" 
                iconColor="blue-500"
                change={{ 
                  value: "All feedback delivered", 
                  positive: true,
                  icon: "check_circle"
                }}
              />
            </>
          )}
        </div>
        
        {/* Assignments Table */}
        <div className="mb-8">
          <AssignmentTable 
            assignments={assignments || []} 
            loading={assignmentsLoading}
            onExportCsv={handleExportCsv}
          />
        </div>
        
        {/* Student Progress & Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Student Progress */}
          <div className="lg:col-span-2">
            <StudentProgress
              students={studentProgressData?.students || []}
              loading={studentsLoading}
              totalStudents={studentProgressData?.totalCount || 0}
              currentPage={studentsPage}
              totalPages={studentProgressData?.totalPages || 1}
              onPageChange={setStudentsPage}
              onSearch={setSearchQuery}
              onFilterChange={setStatusFilter}
            />
          </div>
          
          {/* Analytics Panel */}
          <div>
            <AnalyticsPanel 
              data={analyticsData || {
                assignmentStats: { 
                  submittedCount: 0, 
                  inProgressCount: 0, 
                  notStartedCount: 0, 
                  totalCount: 0,
                  submissionPercentage: 0
                },
                submissionTimeline: [],
                avgFeedbackTime: 0,
                avgRevisionsPerStudent: 0,
                avgImprovementPercentage: 0
              }} 
              loading={analyticsLoading}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
