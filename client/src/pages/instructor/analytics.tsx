import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { API_ROUTES, USER_ROLES } from "@/lib/constants";
import { InstructorShell } from "@/components/layout/instructor-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";

// Custom MIT colors for charts
const chartColors = {
  primary: "#8a1a2c", // MIT maroon
  secondary: "#C2C0BF", // MIT gray
  light: "#E5E5E5"
};

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedDateRange, setSelectedDateRange] = useState("7d");
  const [selectedAssignment, setSelectedAssignment] = useState("all");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [activeTab, setActiveTab] = useState("submissions");
  
  // Redirect non-instructors away
  useEffect(() => {
    if (user?.role !== USER_ROLES.INSTRUCTOR && user?.role !== USER_ROLES.ADMIN) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Fetch courses
  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: [API_ROUTES.COURSES],
    queryFn: async () => {
      const response = await fetch(API_ROUTES.COURSES);
      if (!response.ok) {
        throw new Error('Failed to fetch courses');
      }
      return response.json();
    },
  });

  // Fetch assignments
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: [API_ROUTES.ASSIGNMENTS, selectedCourse],
    queryFn: async () => {
      const url = selectedCourse !== "all" 
        ? `${API_ROUTES.COURSES}/${selectedCourse}/assignments`
        : API_ROUTES.ASSIGNMENTS;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch assignments');
      }
      return response.json();
    }
  });

  // Fetch analytics data from real API
  const { data: analyticsData, isLoading: analyticsLoading, error: analyticsError } = useQuery({
    queryKey: ["analytics", selectedDateRange, selectedAssignment, selectedCourse, activeTab],
    queryFn: async () => {
      // Call real API endpoint instead of using mock data
      const response = await fetch(`/api/assignments/${selectedAssignment}/analytics?${new URLSearchParams({
        dateRange: selectedDateRange,
        course: selectedCourse,
        tab: activeTab
      })}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.status}`);
      }
      
      return response.json();
    },
    // Only fetch if we have the required data
    enabled: Boolean(selectedAssignment && selectedAssignment !== 'all')
  });

  // Throw error instead of hiding it
  if (analyticsError) {
    throw new Error(`Analytics data unavailable: ${analyticsError.message}`);
  }

  // Use real data when available, otherwise show empty state
  const displayData = analyticsData || {
    submissionsData: [],
    scoreDistributionData: [],
    completionTimeData: [],
    summary: {
      totalSubmissions: 0,
      avgScore: 0,
      avgCompletionTime: "N/A",
      feedbackQuality: 0,
    }
  };

  // Handle filter changes
  const handleDateRangeChange = (value: string) => {
    setSelectedDateRange(value);
  };

  const handleAssignmentChange = (value: string) => {
    setSelectedAssignment(value);
  };

  const handleCourseChange = (value: string) => {
    setSelectedCourse(value);
    setSelectedAssignment("all"); // Reset assignment when course changes
  };

  return (
    <InstructorShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-[#8a1a2c]">Performance</span>{" "}
            <span className="text-black">Analytics</span>
          </h1>
          <p className="text-muted-foreground">
            Analyze student performance and submission patterns
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <Select value={selectedDateRange} onValueChange={handleDateRangeChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={selectedCourse} onValueChange={handleCourseChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Course" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses.map((course: { id: number; name: string }) => (
                <SelectItem key={course.id} value={course.id.toString()}>
                  {course.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedAssignment} onValueChange={handleAssignmentChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Assignment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignments</SelectItem>
              {assignments.map((assignment: { id: number; title: string }) => (
                <SelectItem key={assignment.id} value={assignment.id.toString()}>
                  {assignment.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard 
            title="Total Submissions" 
            value={analyticsData?.summary.totalSubmissions || 0} 
            isLoading={analyticsLoading} 
          />
          <SummaryCard 
            title="Average Score" 
            value={`${analyticsData?.summary.avgScore || 0}%`} 
            isLoading={analyticsLoading} 
          />
          <SummaryCard 
            title="Avg. Completion Time" 
            value={analyticsData?.summary.avgCompletionTime || "0"} 
            isLoading={analyticsLoading} 
          />
          <SummaryCard 
            title="Feedback Quality" 
            value={`${analyticsData?.summary.feedbackQuality || 0}/5`} 
            isLoading={analyticsLoading} 
          />
        </div>

        {/* Charts */}
        <Tabs defaultValue="submissions" value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
            <TabsTrigger value="scores">Score Distribution</TabsTrigger>
            <TabsTrigger value="completion">Completion Time</TabsTrigger>
          </TabsList>
          
          <TabsContent value="submissions" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Submission Trends</CardTitle>
                <CardDescription>
                  Number of submissions and completions over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analyticsLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={analyticsData?.submissionsData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="submissions" fill={chartColors.secondary} name="Submissions" />
                      <Bar dataKey="completed" fill={chartColors.primary} name="Completed" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="scores" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Score Distribution</CardTitle>
                <CardDescription>
                  Distribution of scores across all submissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analyticsLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={analyticsData?.scoreDistributionData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="score" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill={chartColors.primary} name="Students" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="completion" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Completion Time</CardTitle>
                <CardDescription>
                  Time taken to complete assignments
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analyticsLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={analyticsData?.completionTimeData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill={chartColors.primary} name="Students" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </InstructorShell>
  );
}

interface SummaryCardProps {
  title: string;
  value: string | number;
  isLoading: boolean;
}

function SummaryCard({ title, value, isLoading }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="text-2xl font-bold">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}