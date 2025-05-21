import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { API_ROUTES, USER_ROLES, APP_ROUTES } from "@/lib/constants";
import { InstructorShell } from "@/components/layout/instructor-shell";
import { StatsCard } from "@/components/instructor/stats-card";
// These components are not used in the new dashboard design
// import { AssignmentTable } from "@/components/instructor/assignment-table";
// import { StudentProgress } from "@/components/instructor/student-progress";
// import { AnalyticsPanel } from "@/components/instructor/analytics-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { BookOpen, PlusCircle, Search, BarChart4, Download, Users } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

export default function InstructorDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState('');
  const [studentId, setStudentId] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [selectedAssignment, setSelectedAssignment] = useState<string>("");
  
  // Redirect students to their dashboard
  useEffect(() => {
    if (user?.role === USER_ROLES.STUDENT) {
      navigate('/dashboard');
    }
  }, [user, navigate]);
  
  // Fetch courses
  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: [API_ROUTES.COURSES],
    queryFn: async () => {
      const response = await fetch(API_ROUTES.COURSES);
      if (!response.ok) {
        throw new Error("Failed to fetch courses");
      }
      return response.json();
    },
  });

  // Define types for assignments and course details
  interface Assignment {
    id: number;
    title: string;
    description: string;
    courseId: number;
    dueDate: string;
    status: string;
    shareableCode: string;
    rubric: string | null;
  }
  
  interface CourseDetails {
    id: number;
    name: string;
    code: string;
    description: string | null;
    assignments: Assignment[];
  }

  // Fetch course details with assignments
  const { data: courseDetails, isLoading: assignmentsLoading } = useQuery<CourseDetails>({
    queryKey: [`${API_ROUTES.COURSES}/${selectedCourse}`],
    enabled: !!selectedCourse,
  });

  // Extract assignments from course details
  const assignments = courseDetails?.assignments || [];
  
  // Fetch dashboard stats for the selected course/assignment
  interface Stats {
    totalStudents: number;
    submissionRate: number;
    totalSubmissions: number;
    averageScore: number;
    scoreDistribution: { high: number; medium: number; low: number };
    feedbackViewRate: number;
    feedbackViewed: number;
    notStartedCount: number;
    notStartedPercentage: number;
    submittedCount: number;
    submittedPercentage: number;
    feedbackViewPercentage: number;
  }

  const { data: stats = {} as Stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: [`${API_ROUTES.ASSIGNMENTS}/stats`, selectedCourse, selectedAssignment],
    queryFn: async () => {
      // Build URL with query parameters properly
      let url = `${API_ROUTES.ASSIGNMENTS}/stats`;
      const params = new URLSearchParams();
      
      // Only append valid numeric values
      if (selectedCourse) {
        const courseIdNum = parseInt(selectedCourse);
        if (!isNaN(courseIdNum) && courseIdNum > 0) {
          params.append('courseId', courseIdNum.toString());
        } else {
          console.warn('Invalid course ID detected:', selectedCourse);
        }
      }
      
      if (selectedAssignment) {
        const assignmentIdNum = parseInt(selectedAssignment);
        if (!isNaN(assignmentIdNum) && assignmentIdNum > 0) {
          params.append('assignmentId', assignmentIdNum.toString());
        } else {
          console.warn('Invalid assignment ID detected:', selectedAssignment);
        }
      }
      
      // Only add the query string if we have parameters
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      console.log('Fetching stats with URL:', url);
      
      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.error('Stats API error:', await response.text());
          // Instead of throwing, return empty stats object to prevent UI errors
          return {
            totalStudents: 0,
            submittedCount: 0,
            notStartedCount: 0,
            submissionRate: 0,
            totalSubmissions: 0,
            pendingReviews: 0,
            averageScore: 0,
            feedbackGenerated: 0,
            feedbackViewed: 0,
            feedbackViewRate: 0,
            submissionsIncrease: 0,
            scoreDistribution: { high: 0, medium: 0, low: 0 },
            submittedPercentage: 0,
            notStartedPercentage: 0,
            feedbackViewPercentage: 0
          } as Stats;
        }
        return response.json();
      } catch (error) {
        console.error('Error fetching stats:', error);
        // Return empty stats object to prevent UI errors
        return {
          totalStudents: 0,
          submittedCount: 0,
          notStartedCount: 0,
          submissionRate: 0,
          totalSubmissions: 0,
          pendingReviews: 0,
          averageScore: 0,
          feedbackGenerated: 0,
          feedbackViewed: 0,
          feedbackViewRate: 0,
          submissionsIncrease: 0,
          scoreDistribution: { high: 0, medium: 0, low: 0 },
          submittedPercentage: 0,
          notStartedPercentage: 0,
          feedbackViewPercentage: 0
        } as Stats;
      }
    },
    enabled: activeTab === "overview",
    // Add retry logic for better resilience
    retry: 2,
    retryDelay: 1000,
  });
  
  // Define analytics data interface
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

  // Fetch analytics data for the selected assignment
  const { data: analyticsData = {} as AnalyticsData, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: [
      `${API_ROUTES.ASSIGNMENTS}/${selectedAssignment}/analytics`,
      { courseId: selectedCourse }
    ],
    enabled: activeTab === "analytics" && !!selectedAssignment,
  });

  // Define student data interface
  interface StudentData {
    id: number;
    name: string;
    email: string;
    lastActivity?: string;
    completedAssignments: number;
    totalAssignments: number;
    averageScore: number;
    submissions: {
      id: number;
      assignmentTitle: string;
      createdAt: string;
      score?: number;
      status: string;
    }[];
  }

  // Fetch individual student data when searched
  const { data: studentData = {} as StudentData, isLoading: studentLoading } = useQuery<StudentData>({
    queryKey: [
      `${API_ROUTES.STUDENTS}/lookup`,
      { 
        studentId: studentId, 
        courseId: selectedCourse, 
        assignmentId: selectedAssignment 
      }
    ],
    enabled: !!studentId && studentId.length > 2,
  });
  
  const handleExportCsv = async (assignmentId: string = selectedAssignment) => {
    if (!assignmentId) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Please select an assignment to export.",
      });
      return;
    }
    
    try {
      let url = `${API_ROUTES.EXPORT_CSV}?assignmentId=${assignmentId}`;
      if (selectedCourse) {
        url += `&courseId=${selectedCourse}`;
      }
      
      const response = await apiRequest('GET', url, undefined);
      
      // Create blob from response
      const blob = await response.blob();
      
      // Create download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = downloadUrl;
      a.download = `assignment_${assignmentId}_grades.csv`;
      
      // Append to document, click, and clean up
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
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
  
  const handleStudentSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length > 2) {
      setStudentId(searchQuery);
    } else {
      toast({
        variant: "destructive",
        title: "Search Error",
        description: "Please enter at least 3 characters to search for a student.",
      });
    }
  };
  
  if (!user) return null;

  return (
    <InstructorShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              <span className="text-[#8a1a2c]">Instructor</span>{" "}
              <span className="text-black">Dashboard</span>
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitor student progress across large classes
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate("/instructor/courses")}
              className="shadow-sm border-gray-200"
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Manage Courses
            </Button>
            <Button 
              onClick={() => navigate(APP_ROUTES.INSTRUCTOR_CREATE_ASSIGNMENT)}
              className="bg-mit-red hover:bg-mit-red/90 text-white border-0"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Assignment
            </Button>
          </div>
        </div>
        
        {/* Course & Assignment Selection */}
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Course & Assignment Selection</CardTitle>
            <CardDescription>
              Select a course and assignment to view detailed statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-8 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="course-select" className="text-sm font-medium">
                  Course
                </label>
                <Select
                  value={selectedCourse}
                  onValueChange={setSelectedCourse}
                >
                  <SelectTrigger id="course-select" className="w-full">
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {coursesLoading ? (
                      <SelectItem value="loading">Loading courses...</SelectItem>
                    ) : courses.length === 0 ? (
                      <SelectItem value="none" disabled>No courses available</SelectItem>
                    ) : (
                      courses.map((course: any) => (
                        <SelectItem key={course.id} value={course.id.toString()}>
                          {course.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="assignment-select" className="text-sm font-medium">
                  Assignment
                </label>
                <Select
                  value={selectedAssignment}
                  onValueChange={setSelectedAssignment}
                  disabled={!selectedCourse || assignmentsLoading}
                >
                  <SelectTrigger id="assignment-select" className="w-full">
                    <SelectValue placeholder="Select an assignment" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignmentsLoading ? (
                      <SelectItem value="loading">Loading assignments...</SelectItem>
                    ) : !selectedCourse ? (
                      <SelectItem value="none" disabled>Select a course first</SelectItem>
                    ) : assignments.length === 0 ? (
                      <SelectItem value="none" disabled>No assignments for this course</SelectItem>
                    ) : (
                      assignments.map((assignment: any) => (
                        <SelectItem key={assignment.id} value={assignment.id.toString()}>
                          {assignment.title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="inline-flex h-10 bg-gray-100 p-1 text-gray-700 rounded-md border border-gray-200">
            <TabsTrigger value="overview" className="rounded px-4 py-1.5 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">
              Overview
            </TabsTrigger>
            <TabsTrigger value="search" className="rounded px-4 py-1.5 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">
              Student Lookup
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded px-4 py-1.5 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">
              Analytics
            </TabsTrigger>
            <TabsTrigger value="export" className="rounded px-4 py-1.5 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">
              Export Data
            </TabsTrigger>
          </TabsList>
          
          {/* Overview Tab Content */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {!selectedAssignment ? (
                <Card className="col-span-full p-6 text-center">
                  <p className="text-muted-foreground">
                    Please select a course and assignment to view statistics
                  </p>
                </Card>
              ) : statsLoading ? (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-32 rounded-lg" />
                  ))}
                </>
              ) : (
                <>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        Enrolled Students
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats?.totalStudents || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Total students in this course
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        Submission Rate
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <div className="text-2xl font-bold">
                          {stats?.submissionRate || 0}%
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {stats?.totalSubmissions || 0}/{stats?.totalStudents || 0}
                        </div>
                      </div>
                      <Progress value={stats?.submissionRate || 0} className="h-2" />
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        Average Score
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats?.averageScore || 0}%
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {stats?.scoreDistribution?.high || 0} students scored 80% or above
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        Feedback Viewed
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <div className="text-2xl font-bold">
                          {stats?.feedbackViewRate || 0}%
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {stats?.feedbackViewed || 0}/{stats?.totalSubmissions || 0}
                        </div>
                      </div>
                      <Progress value={stats?.feedbackViewRate || 0} className="h-2" />
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
            
            {selectedAssignment && (
              <Card>
                <CardHeader>
                  <CardTitle>Submission Status</CardTitle>
                  <CardDescription>
                    Overview of student submissions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    {/* Submission Distribution */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <div>Not Started</div>
                        <div>{stats?.notStartedCount || 0} students ({stats?.notStartedPercentage || 0}%)</div>
                      </div>
                      <Progress value={stats?.notStartedPercentage || 0} className="h-2 bg-gray-200" />
                      
                      <div className="flex justify-between text-sm">
                        <div>Submitted</div>
                        <div>{stats?.submittedCount || 0} students ({stats?.submittedPercentage || 0}%)</div>
                      </div>
                      <Progress value={stats?.submittedPercentage || 0} className="h-2 bg-blue-200" />
                      
                      <div className="flex justify-between text-sm">
                        <div>Feedback Viewed</div>
                        <div>{stats?.feedbackViewed || 0} students ({stats?.feedbackViewPercentage || 0}%)</div>
                      </div>
                      <Progress value={stats?.feedbackViewPercentage || 0} className="h-2 bg-green-200" />
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-4 flex-wrap">
                      <Button variant="outline" onClick={() => handleExportCsv()}>
                        <Download className="mr-2 h-4 w-4" />
                        Export All Grades
                      </Button>
                      <Button variant="outline" onClick={() => setActiveTab("analytics")}>
                        <BarChart4 className="mr-2 h-4 w-4" />
                        View Detailed Analytics
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          {/* Student Lookup Tab Content */}
          <TabsContent value="search">
            <Card>
              <CardHeader>
                <CardTitle>Student Lookup</CardTitle>
                <CardDescription>
                  Search for a specific student to view their submissions and performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleStudentSearch} className="space-y-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 space-y-2">
                      <label htmlFor="student-search" className="text-sm font-medium">
                        Student ID, Name or Email
                      </label>
                      <div className="flex">
                        <Input
                          id="student-search"
                          placeholder="Enter student ID, name or email"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="rounded-r-none flex-1"
                        />
                        <Button type="submit" className="rounded-l-none">
                          <Search className="h-4 w-4" />
                          <span className="sr-only">Search</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </form>
                
                {studentLoading && (
                  <div className="py-8 text-center">
                    <Skeleton className="h-8 w-8 rounded-full mx-auto mb-4" />
                    <Skeleton className="h-4 w-24 mx-auto" />
                  </div>
                )}
                
                {studentData && (
                  <div className="mt-6 space-y-6">
                    <div className="flex flex-col sm:flex-row gap-6 items-start">
                      <div className="sm:w-1/3 space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="bg-primary/10 text-primary flex items-center justify-center rounded-full h-12 w-12">
                            <Users className="h-6 w-6" />
                          </div>
                          <div>
                            <h3 className="font-medium">{studentData.name}</h3>
                            <p className="text-sm text-muted-foreground">{studentData.email}</p>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Student ID</p>
                          <p className="text-sm">{studentData.id}</p>
                        </div>
                        
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Last Activity</p>
                          <p className="text-sm">{studentData.lastActivity || 'Never'}</p>
                        </div>
                      </div>
                      
                      <div className="sm:w-2/3 space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm font-medium">
                                Assignment Progress
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="text-2xl font-bold">
                                {studentData.completedAssignments || 0}/{studentData.totalAssignments || 0}
                              </div>
                              <Progress 
                                value={studentData.totalAssignments 
                                  ? (studentData.completedAssignments / studentData.totalAssignments) * 100 
                                  : 0} 
                                className="h-2 mt-2" 
                              />
                            </CardContent>
                          </Card>
                          
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm font-medium">
                                Average Score
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="text-2xl font-bold">
                                {studentData.averageScore || 0}%
                              </div>
                              <Progress 
                                value={studentData.averageScore || 0} 
                                className="h-2 mt-2" 
                              />
                            </CardContent>
                          </Card>
                        </div>
                        
                        {studentData.submissions && studentData.submissions.length > 0 ? (
                          <div className="space-y-4">
                            <h3 className="font-medium">Recent Submissions</h3>
                            <div className="border rounded-md divide-y">
                              {studentData.submissions.map((submission: any) => (
                                <div key={submission.id} className="p-4 flex justify-between items-center">
                                  <div>
                                    <p className="font-medium">{submission.assignmentTitle}</p>
                                    <p className="text-sm text-muted-foreground">
                                      Submitted: {new Date(submission.createdAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-medium">{submission.score || 'N/A'}</p>
                                    <p className="text-sm text-muted-foreground">{submission.status}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-md border p-4 text-center text-muted-foreground">
                            No submissions found for this student
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {!studentLoading && studentId && !studentData && (
                  <div className="mt-6 rounded-md border p-4 text-center text-muted-foreground">
                    No student found matching your search criteria
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Analytics Tab Content */}
          <TabsContent value="analytics">
            {!selectedAssignment ? (
              <Card className="p-6 text-center">
                <p className="text-muted-foreground">
                  Please select a course and assignment to view analytics
                </p>
              </Card>
            ) : analyticsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-[400px]" />
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Performance Analytics</CardTitle>
                  <CardDescription>
                    Detailed analysis of student performance
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="grid gap-6 md:grid-cols-3">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">
                          Average Feedback Time
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {analyticsData?.avgFeedbackTime || 0} seconds
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Time from submission to feedback generation
                        </p>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">
                          Average Revisions
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {analyticsData?.avgRevisionsPerStudent || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Revisions per student for this assignment
                        </p>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">
                          Improvement Rate
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {analyticsData?.avgImprovementPercentage || 0}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Average score improvement after feedback
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Placeholder for charts - would be implemented with recharts */}
                  <div className="space-y-4">
                    <h3 className="font-medium">Submission Timeline</h3>
                    <div className="h-64 bg-gray-100 rounded-md flex items-center justify-center">
                      <p className="text-muted-foreground">
                        Timeline chart would be displayed here
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="font-medium">Score Distribution</h3>
                    <div className="h-64 bg-gray-100 rounded-md flex items-center justify-center">
                      <p className="text-muted-foreground">
                        Score distribution chart would be displayed here
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          {/* Export Tab Content */}
          <TabsContent value="export">
            <Card>
              <CardHeader>
                <CardTitle>Export Data</CardTitle>
                <CardDescription>
                  Download data for offline analysis or importing into other systems
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Export Options</h3>
                    <div className="space-y-4">
                      <Button 
                        variant="outline" 
                        className="w-full justify-start" 
                        onClick={() => handleExportCsv()}
                        disabled={!selectedAssignment}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export All Submissions and Grades
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        disabled={!selectedAssignment}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export Student Performance Report
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        disabled={!selectedAssignment}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export Detailed Analytics
                      </Button>
                    </div>
                  </div>
                  
                  <div className="bg-muted p-6 rounded-lg">
                    <h3 className="text-lg font-medium mb-4">Export Information</h3>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <div className="rounded-full bg-blue-500 w-5 h-5 flex items-center justify-center text-white mt-0.5 flex-shrink-0">1</div>
                        <p>The full roster export contains student identifiers, submission timestamps, AI-generated feedback, and grades.</p>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="rounded-full bg-blue-500 w-5 h-5 flex items-center justify-center text-white mt-0.5 flex-shrink-0">2</div>
                        <p>Data is available in CSV format for easy import into spreadsheets and other systems.</p>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="rounded-full bg-blue-500 w-5 h-5 flex items-center justify-center text-white mt-0.5 flex-shrink-0">3</div>
                        <p>All student data is exported securely and in compliance with privacy regulations.</p>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </InstructorShell>
  );
}
