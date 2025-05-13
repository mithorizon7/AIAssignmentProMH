import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { InstructorShell } from "@/components/layout/instructor-shell";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { API_ROUTES, APP_ROUTES } from "@/lib/constants";
import { 
  ChevronLeft, 
  Plus, 
  CalendarDays, 
  Clock, 
  Users, 
  BookOpen, 
  CheckCircle, 
  Circle,
  AlarmClock
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

// Type definitions for better type safety
type AssignmentStatus = "active" | "completed" | "upcoming";

interface Assignment {
  id: number;
  title: string;
  description: string;
  dueDate: string;
  status: AssignmentStatus;
  submissionCount: number;
  completionRate: number;
}

interface Course {
  id: number;
  name: string;
  code: string;
  description: string;
  assignmentCount: number;
  studentCount: number;
  createdAt: string;
  assignments: Assignment[];
}

export default function CourseDetailPage({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<string>("all");
  
  // Get course ID from the route parameter
  const courseId = parseInt(id);
  
  // Fetch course details
  const { data: course, isLoading } = useQuery<Course>({
    queryKey: [`${API_ROUTES.COURSES}/${courseId}`],
    enabled: !!courseId,
  });
  
  // Render loading state
  if (isLoading || !course) {
    return (
      <InstructorShell>
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate(APP_ROUTES.INSTRUCTOR_COURSES)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Skeleton className="h-10 w-48" />
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </InstructorShell>
    );
  }
  
  // Get filtered assignments based on active tab
  const getFilteredAssignments = () => {
    if (activeTab === "all") return course.assignments || [];
    return (course.assignments || []).filter(a => a.status === activeTab);
  };
  
  // Helper function to render status badge
  const renderStatusBadge = (status: AssignmentStatus) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">
            <AlarmClock className="mr-1 h-3 w-3" />
            Active
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <CheckCircle className="mr-1 h-3 w-3" />
            Completed
          </Badge>
        );
      case "upcoming":
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">
            <Circle className="mr-1 h-3 w-3" />
            Upcoming
          </Badge>
        );
      default:
        return null;
    }
  };
  
  return (
    <InstructorShell>
      <div className="space-y-6">
        {/* Header with navigation */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate(APP_ROUTES.INSTRUCTOR_COURSES)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{course.name}</h1>
              <p className="text-muted-foreground">
                <span className="font-mono">{course.code}</span> • {course.description || "No description"}
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href={`${APP_ROUTES.INSTRUCTOR_CREATE_ASSIGNMENT}?courseId=${courseId}`}>
              <Plus className="mr-2 h-4 w-4" />
              Create Assignment
            </Link>
          </Button>
        </div>
        
        {/* Course statistics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">{course.assignmentCount || 0}</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Enrolled Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">{course.studentCount || 0}</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Created On</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="text-md font-medium">
                  {format(new Date(course.createdAt), "MMMM d, yyyy")}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Assignments */}
        <Card>
          <CardHeader>
            <CardTitle>Assignments</CardTitle>
            <CardDescription>
              Manage assignments for this course
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
              </TabsList>
              
              <TabsContent value={activeTab} className="m-0">
                {getFilteredAssignments().length === 0 ? (
                  <div className="flex h-32 items-center justify-center rounded-md border border-dashed">
                    <div className="flex flex-col items-center gap-1 text-center">
                      <BookOpen className="h-10 w-10 text-muted-foreground" />
                      <h3 className="font-semibold">No assignments found</h3>
                      <p className="text-sm text-muted-foreground">
                        {activeTab === "all" 
                          ? "This course doesn't have any assignments yet."
                          : `This course doesn't have any ${activeTab} assignments.`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {getFilteredAssignments().map((assignment) => (
                      <div 
                        key={assignment.id} 
                        className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{assignment.title}</h3>
                            {renderStatusBadge(assignment.status)}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {assignment.description}
                          </p>
                        </div>
                        
                        <div className="flex flex-col gap-1 sm:items-end">
                          <div className="flex items-center text-sm">
                            <Clock className="mr-1 h-3 w-3" />
                            Due: {format(new Date(assignment.dueDate), "MMM d, yyyy")}
                          </div>
                          <div className="flex items-center text-sm">
                            <Users className="mr-1 h-3 w-3" />
                            Submissions: {assignment.submissionCount} • 
                            <span className="ml-1">
                              {assignment.completionRate}% completed
                            </span>
                          </div>
                          <div className="mt-2 flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => navigate(`/instructor/assignment/${assignment.id}`)}
                            >
                              View Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </InstructorShell>
  );
}