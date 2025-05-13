import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, PlayCircle, Clock, CheckCircle, Download, Link, Copy, Check } from "lucide-react";

interface AssignmentDetailProps {
  id: string;
}

interface AssignmentDetailData {
  id: number;
  title: string;
  description: string;
  courseId: number;
  dueDate: string;
  status: 'upcoming' | 'active' | 'completed';
  rubric: any;
  rubricType: string;
  createdAt: string;
  updatedAt: string;
  shareableCode?: string;
  course?: {
    id: number;
    name: string;
    code: string;
  };
  submittedCount: number;
  totalStudents: number;
  submissionPercentage: number;
}

interface StudentProgressData {
  students: any[];
  totalCount: number;
  totalPages: number;
}

interface AnalyticsData {
  assignmentStats: {
    submittedCount: number;
    inProgressCount: number;
    notStartedCount: number;
    totalCount: number;
    submissionPercentage: number;
  };
  submissionTimeline: any[];
  avgFeedbackTime: number;
  avgRevisionsPerStudent: number;
  avgImprovementPercentage: number;
}

export default function AssignmentDetail({ id }: AssignmentDetailProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const assignmentId = parseInt(id);
  const [studentsPage, setStudentsPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [copyLinkSuccess, setCopyLinkSuccess] = useState(false);
  
  // Fetch assignment details
  const { data: assignment, isLoading: assignmentLoading } = useQuery<AssignmentDetailData>({
    queryKey: [`${API_ROUTES.ASSIGNMENTS}/${assignmentId}/details`],
  });
  
  // Fetch student progress for this assignment
  const { data: studentProgressData, isLoading: studentsLoading } = useQuery<StudentProgressData>({
    queryKey: [
      `${API_ROUTES.STUDENTS}/progress/${assignmentId}`, 
      { page: studentsPage, search: searchQuery, status: statusFilter }
    ],
  });
  
  // Fetch analytics data for this assignment
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: [`${API_ROUTES.ASSIGNMENTS}/${assignmentId}/analytics`],
  });
  
  // Mutation to update assignment status
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const response = await apiRequest(
        'PATCH', 
        `${API_ROUTES.ASSIGNMENTS}/${assignmentId}/status`, 
        { status: newStatus }
      );
      return await response.json();
    },
    onSuccess: (data) => {
      // Update the assignment data directly in the cache
      queryClient.setQueryData<AssignmentDetailData>(
        [`${API_ROUTES.ASSIGNMENTS}/${assignmentId}/details`], 
        (oldData) => {
          if (oldData) {
            return { ...oldData, status: data.status };
          }
          return oldData;
        }
      );
      
      // Also invalidate assignments list for consistency
      queryClient.invalidateQueries({ queryKey: [API_ROUTES.ASSIGNMENTS] });
      
      toast({
        title: "Status updated",
        description: "Assignment status has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "Failed to update assignment status.",
      });
      console.error("Error updating assignment status:", error);
    }
  });
  
  const handleStatusChange = (newStatus: string) => {
    updateStatusMutation.mutate(newStatus);
  };
  
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
  
  const handleCopyShareableLink = () => {
    if (assignment?.shareableCode) {
      // Create the full URL for the shareable link
      const baseUrl = window.location.origin;
      const shareableUrl = `${baseUrl}/submit/${assignment.shareableCode}`;
      
      // Copy to clipboard
      navigator.clipboard.writeText(shareableUrl)
        .then(() => {
          setCopyLinkSuccess(true);
          toast({
            title: "Link Copied",
            description: "Shareable link has been copied to clipboard.",
          });
          
          // Reset copy success state after a moment
          setTimeout(() => {
            setCopyLinkSuccess(false);
          }, 2000);
        })
        .catch(() => {
          toast({
            variant: "destructive",
            title: "Copy Failed",
            description: "Failed to copy link to clipboard.",
          });
        });
    } else {
      toast({
        variant: "destructive",
        title: "No Shareable Link",
        description: "This assignment doesn't have a shareable code.",
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
                  <CardTitle className="text-xl">{assignment?.title || ''}</CardTitle>
                  <CardDescription>{assignment?.description || ''}</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge 
                    className={`${
                      assignment?.status === 'active' 
                        ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                        : assignment?.status === 'completed' 
                          ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' 
                          : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                    }`}
                  >
                    {assignment?.status === 'active' ? 'Active' : 
                     assignment?.status === 'completed' ? 'Completed' : 'Upcoming'}
                  </Badge>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="ml-2">
                        Change Status <ChevronDown className="ml-1 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleStatusChange('upcoming')}
                        className="flex items-center cursor-pointer"
                        disabled={assignment?.status === 'upcoming'}
                      >
                        <Clock className="mr-2 h-4 w-4 text-amber-500" />
                        <span>Mark as Upcoming</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleStatusChange('active')}
                        className="flex items-center cursor-pointer"
                        disabled={assignment?.status === 'active'}
                      >
                        <PlayCircle className="mr-2 h-4 w-4 text-green-500" />
                        <span>Mark as Active</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleStatusChange('completed')}
                        className="flex items-center cursor-pointer"
                        disabled={assignment?.status === 'completed'}
                      >
                        <CheckCircle className="mr-2 h-4 w-4 text-blue-500" />
                        <span>Mark as Completed</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="flex flex-col space-y-1">
                  <span className="text-sm text-neutral-500">Course</span>
                  <span className="font-medium">
                    {assignment?.course?.name ? `${assignment.course.name} (${assignment.course.code})` : 'No course assigned'}
                  </span>
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
            <CardFooter className="border-t pt-4 flex justify-between items-center">
              <div className="flex items-center">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCopyShareableLink}
                  className="border-amber-500 text-amber-600 hover:bg-amber-50"
                  disabled={!assignment?.shareableCode}
                >
                  {copyLinkSuccess ? (
                    <Check className="mr-2 h-4 w-4 text-green-500" />
                  ) : (
                    <Link className="mr-2 h-4 w-4" />
                  )}
                  {copyLinkSuccess ? 'Copied!' : 'Copy Shareable Link'}
                </Button>
                {assignment?.shareableCode && (
                  <div className="text-xs text-muted-foreground ml-3">
                    Code: <span className="font-mono font-medium">{assignment.shareableCode}</span>
                  </div>
                )}
              </div>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportCsv}
                className="text-primary border-primary"
              >
                <Download className="mr-2 h-4 w-4" />
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
              data={analyticsData ? analyticsData : {
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
