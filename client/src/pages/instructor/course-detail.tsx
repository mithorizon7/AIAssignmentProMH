import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { API_ROUTES, APP_ROUTES, SUBMISSION_STATUS } from "@/lib/constants";
import { format } from "date-fns";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { InstructorShell } from "@/components/layout/instructor-shell";
import {
  PlusCircle,
  ArrowLeft,
  Copy,
  MoreHorizontal,
  Calendar,
  Users,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Download,
} from "lucide-react";

type AssignmentStatus = "active" | "completed" | "upcoming";

export default function CourseDetailPage() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("assignments");

  // Fetch course details
  const {
    data: course,
    isLoading: courseLoading,
    error: courseError,
  } = useQuery({
    queryKey: [API_ROUTES.COURSES, id],
    queryFn: async () => {
      const response = await fetch(`${API_ROUTES.COURSES}/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch course details");
      }
      return response.json();
    },
  });

  // Fetch course assignments
  const {
    data: assignments = [],
    isLoading: assignmentsLoading,
    error: assignmentsError,
  } = useQuery({
    queryKey: [API_ROUTES.ASSIGNMENTS, { courseId: id }],
    queryFn: async () => {
      const response = await fetch(
        `${API_ROUTES.ASSIGNMENTS}?courseId=${id}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch assignments");
      }
      return response.json();
    },
    enabled: !!id,
  });

  // Fetch enrolled students
  const {
    data: students = [],
    isLoading: studentsLoading,
    error: studentsError,
  } = useQuery({
    queryKey: ["students", { courseId: id }],
    queryFn: async () => {
      const response = await fetch(`/api/courses/${id}/students`);
      if (!response.ok) {
        throw new Error("Failed to fetch enrolled students");
      }
      return response.json();
    },
    enabled: !!id && activeTab === "students",
  });

  const isLoading = courseLoading || assignmentsLoading;
  const error = courseError || assignmentsError;

  // Function to copy shareable link
  const copyShareableLink = (code: string) => {
    const link = `${window.location.origin}/submit/${code}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copied",
      description: "Shareable link has been copied to clipboard",
    });
  };

  // Function to render status badge
  const renderStatusBadge = (status: AssignmentStatus) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <Clock className="mr-1 h-3 w-3" />
            Active
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Completed
          </Badge>
        );
      case "upcoming":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <Calendar className="mr-1 h-3 w-3" />
            Upcoming
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <AlertCircle className="mr-1 h-3 w-3" />
            Unknown
          </Badge>
        );
    }
  };

  if (error) {
    return (
      <InstructorShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error Loading Course</h2>
          <p className="text-muted-foreground mb-6">{(error as Error).message}</p>
          <Button onClick={() => navigate("/instructor/courses")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Courses
          </Button>
        </div>
      </InstructorShell>
    );
  }

  return (
    <InstructorShell>
      <div className="flex flex-col space-y-6">
        {/* Header with back button */}
        <div className="flex flex-col space-y-4">
          <Button
            variant="ghost"
            className="w-fit p-0 h-8"
            onClick={() => navigate("/instructor/courses")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Courses
          </Button>

          {courseLoading ? (
            <>
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">
                    {course?.name}
                  </h1>
                  <div className="flex items-center mt-1">
                    <Badge variant="outline" className="mr-2">
                      {course?.code}
                    </Badge>
                    {course?.term && (
                      <span className="text-sm text-muted-foreground">
                        {course.term}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => navigate(`/instructor/create-assignment?courseId=${id}`)}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create Assignment
                </Button>
              </div>
              {course?.description && (
                <p className="text-muted-foreground max-w-3xl">
                  {course.description}
                </p>
              )}
            </>
          )}
        </div>

        {/* Course stats cards */}
        {!courseLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Assignments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <FileText className="text-primary mr-2 h-5 w-5" />
                  <div className="text-2xl font-bold">
                    {assignments.length}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Assignments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Clock className="text-green-500 mr-2 h-5 w-5" />
                  <div className="text-2xl font-bold">
                    {assignments.filter((a: any) => a.status === "active").length}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Enrolled Students
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Users className="text-blue-500 mr-2 h-5 w-5" />
                  <div className="text-2xl font-bold">
                    {course?.studentCount || 0}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs for Assignments and Students */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
          </TabsList>

          <TabsContent value="assignments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Course Assignments</CardTitle>
                <CardDescription>
                  Manage assignments for this course
                </CardDescription>
              </CardHeader>
              <CardContent>
                {assignmentsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : assignments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No assignments yet</h3>
                    <p className="text-sm text-muted-foreground mt-2 mb-6">
                      Get started by creating your first assignment for this course.
                    </p>
                    <Button
                      onClick={() => navigate(`/instructor/create-assignment?courseId=${id}`)}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Create Assignment
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Assignment</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Submissions</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assignments.map((assignment: any) => (
                          <TableRow key={assignment.id}>
                            <TableCell className="font-medium">
                              {assignment.title}
                            </TableCell>
                            <TableCell>
                              {renderStatusBadge(assignment.status)}
                            </TableCell>
                            <TableCell>
                              {format(
                                new Date(assignment.dueDate),
                                "MMM d, yyyy"
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {assignment.submissionCount || 0}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() =>
                                        navigate(
                                          APP_ROUTES.INSTRUCTOR_ASSIGNMENT(
                                            assignment.id
                                          )
                                        )
                                      }
                                    >
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        copyShareableLink(assignment.shareableCode)
                                      }
                                    >
                                      <Copy className="mr-2 h-4 w-4" />
                                      Copy Shareable Link
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() =>
                                    navigate(
                                      APP_ROUTES.INSTRUCTOR_ASSIGNMENT(
                                        assignment.id
                                      )
                                    )
                                  }
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="students" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle>Enrolled Students</CardTitle>
                  <CardDescription>
                    Students who can access and submit to this course's assignments
                  </CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                  <Button size="sm">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Students
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {studentsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : students.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Users className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No students enrolled</h3>
                    <p className="text-sm text-muted-foreground mt-2 mb-6">
                      Enroll students to allow them to access the course assignments.
                    </p>
                    <Button>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Students
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Submissions</TableHead>
                          <TableHead>Last Activity</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((student: any) => (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">
                              {student.name}
                            </TableCell>
                            <TableCell>{student.email}</TableCell>
                            <TableCell>
                              {student.submissionCount || 0}
                            </TableCell>
                            <TableCell>
                              {student.lastActivity
                                ? format(
                                    new Date(student.lastActivity),
                                    "MMM d, yyyy"
                                  )
                                : "Never"}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </InstructorShell>
  );
}