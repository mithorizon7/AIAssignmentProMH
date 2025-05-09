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

  // Fetch analytics data
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ["analytics", selectedDateRange, selectedAssignment, selectedCourse, activeTab],
    queryFn: async () => {
      // This would normally call a backend API endpoint that returns analytics data
      // Since this endpoint might not exist yet, we'll simulate the response
      
      // Submissions graph data
      const submissionsData = [
        { day: "Mon", submissions: 22, completed: 20 },
        { day: "Tue", submissions: 28, completed: 25 },
        { day: "Wed", submissions: 35, completed: 29 },
        { day: "Thu", submissions: 32, completed: 28 },
        { day: "Fri", submissions: 40, completed: 32 },
        { day: "Sat", submissions: 15, completed: 12 },
        { day: "Sun", submissions: 13, completed: 10 },
      ];
      
      // Score distribution data
      const scoreDistributionData = [
        { score: "0-20", count: 5 },
        { score: "21-40", count: 10 },
        { score: "41-60", count: 25 },
        { score: "61-80", count: 40 },
        { score: "81-100", count: 20 },
      ];
      
      // Completion time data
      const completionTimeData = [
        { range: "0-5 min", count: 15 },
        { range: "5-15 min", count: 25 },
        { range: "15-30 min", count: 40 },
        { range: "30-60 min", count: 15 },
        { range: "60+ min", count: 5 },
      ];
      
      // Return the different datasets based on active tab
      return {
        submissionsData,
        scoreDistributionData,
        completionTimeData,
        summary: {
          totalSubmissions: 185,
          avgScore: 72.5,
          avgCompletionTime: "24 minutes",
          feedbackQuality: 4.2,
        }
      };
    },
    retry: false,
  });

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
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
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
              {courses.map((course) => (
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
              {assignments.map((assignment) => (
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