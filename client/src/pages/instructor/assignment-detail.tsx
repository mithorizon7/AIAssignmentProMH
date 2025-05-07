import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { API_ROUTES, USER_ROLES } from "@/lib/constants";
import { AppShell } from "@/components/layout/app-shell";
import { StudentProgress } from "@/components/instructor/student-progress";
import { AnalyticsPanel } from "@/components/instructor/analytics-panel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/format";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AssignmentDetailProps {
  id: string;
}

export default function AssignmentDetail({ id }: AssignmentDetailProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const assignmentId = parseInt(id);
  const [studentsPage, setStudentsPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Fetch assignment details
  const { data: assignment, isLoading: assignmentLoading } = useQuery({
    queryKey: [`${API_ROUTES.ASSIGNMENTS}/${assignmentId}/details`],
  });
  
  // Fetch student progress for this assignment
  const { data: studentProgressData, isLoading: studentsLoading } = useQuery({
    queryKey: [
      `${API_ROUTES.STUDENTS}/progress/${assignmentId}`, 
      { page: studentsPage, search: searchQuery, status: statusFilter }
    ],
  });
  
  // Fetch analytics data for this assignment
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: [`${API_ROUTES.ASSIGNMENTS}/${assignmentId}/analytics`],
  });
  
  const handleExportCsv = async () => {
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
  
  if (!user || user.role !== USER_ROLES.INSTRUCTOR) return null;
  
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-neutral-800">Assignment Details</h1>
          <p className="text-neutral-600">Review student submissions and performance</p>
        </div>
        
        {/* Assignment Overview */}
        {assignmentLoading ? (
          <Skeleton className="h-48 rounded-lg mb-8" />
        ) : (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{assignment?.title}</CardTitle>
                  <CardDescription>{assignment?.description}</CardDescription>
                </div>
                <Badge variant={assignment?.status === 'active' ? 'success' : 'secondary'}>
                  {assignment?.status === 'active' ? 'Active' : 
                   assignment?.status === 'completed' ? 'Completed' : 'Upcoming'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="flex flex-col space-y-1">
                  <span className="text-sm text-neutral-500">Course</span>
                  <span className="font-medium">{assignment?.course?.name} ({assignment?.course?.code})</span>
                </div>
                <div className="flex flex-col space-y-1">
                  <span className="text-sm text-neutral-500">Due Date</span>
                  <span className="font-medium">{formatDate(assignment?.dueDate)}</span>
                </div>
                <div className="flex flex-col space-y-1">
                  <span className="text-sm text-neutral-500">Submission Rate</span>
                  <span className="font-medium">
                    {assignment?.submittedCount || 0}/{assignment?.totalStudents || 0} students 
                    ({Math.round(((assignment?.submittedCount || 0) / (assignment?.totalStudents || 1)) * 100)}%)
                  </span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4 flex justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportCsv}
                className="text-primary border-primary"
              >
                <span className="material-icons text-sm mr-2">file_download</span>
                Export Grades (CSV)
              </Button>
            </CardFooter>
          </Card>
        )}
        
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
