import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { InstructorShell } from "@/components/layout/instructor-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody,
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft } from "lucide-react";
import { API_ROUTES, APP_ROUTES } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Student {
  id: number;
  name: string;
  username: string;
  email: string;
  status: 'enrolled' | 'invited' | 'inactive';
  joinedAt: string;
  lastActivity?: string;
  assignmentsCompleted: number;
  assignmentsTotal: number;
}

interface Course {
  id: number;
  name: string;
  code: string;
  description?: string;
}

export default function CourseStudentsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  
  // Extract course ID from URL
  const courseId = parseInt(window.location.pathname.split("/").pop() || "0");
  
  // Fetch course details
  const { data: course, isLoading: courseLoading } = useQuery<Course>({
    queryKey: [`${API_ROUTES.COURSES}/${courseId}`],
    enabled: !!courseId,
  });
  
  // Fetch students enrolled in the course
  const { data: students = [], isLoading: studentsLoading } = useQuery<Student[]>({
    queryKey: [`${API_ROUTES.COURSES}/${courseId}/students`],
    enabled: !!courseId,
  });
  
  // Mutation for inviting a student
  const inviteStudentMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest(
        "POST", 
        `${API_ROUTES.COURSES}/${courseId}/invite`, 
        { email }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`${API_ROUTES.COURSES}/${courseId}/students`] 
      });
      toast({
        title: "Invitation sent",
        description: `An invitation has been sent to ${inviteEmail}`,
      });
      setInviteEmail("");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Invitation failed",
        description: error.message || "Failed to send invitation. Please try again.",
      });
    },
  });
  
  // Mutation for removing a student
  const removeStudentMutation = useMutation({
    mutationFn: async (studentId: number) => {
      const response = await apiRequest(
        "DELETE", 
        `${API_ROUTES.COURSES}/${courseId}/students/${studentId}`, 
        {}
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`${API_ROUTES.COURSES}/${courseId}/students`] 
      });
      toast({
        title: "Student removed",
        description: "The student has been removed from this course",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Removal failed",
        description: error.message || "Failed to remove student. Please try again.",
      });
    },
  });
  
  const handleInviteStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteEmail.trim()) {
      inviteStudentMutation.mutate(inviteEmail);
    }
  };
  
  const handleRemoveStudent = (studentId: number, studentName: string) => {
    if (confirm(`Are you sure you want to remove ${studentName} from this course?`)) {
      removeStudentMutation.mutate(studentId);
    }
  };
  
  const getProgressColor = (completed: number, total: number) => {
    const percentage = total === 0 ? 0 : (completed / total) * 100;
    if (percentage >= 75) return "bg-green-100 text-green-800";
    if (percentage >= 50) return "bg-blue-100 text-blue-800";
    if (percentage >= 25) return "bg-amber-100 text-amber-800";
    return "bg-gray-100 text-gray-800";
  };
  
  if (courseLoading) {
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
          <Skeleton className="h-[500px]" />
        </div>
      </InstructorShell>
    );
  }
  
  return (
    <InstructorShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate(APP_ROUTES.INSTRUCTOR_COURSE(courseId))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {course?.name} Students
              </h1>
              <p className="text-muted-foreground">
                Manage student enrollments and view progress for this course
              </p>
            </div>
          </div>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button>Invite Student</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Invite Student</SheetTitle>
                <SheetDescription>
                  Enter an email address to invite a student to join {course?.name}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <form onSubmit={handleInviteStudent} className="flex flex-col gap-4">
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium">
                      Email Address
                    </label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="student@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={inviteStudentMutation.isPending}
                  >
                    {inviteStudentMutation.isPending ? "Sending..." : "Send Invitation"}
                  </Button>
                </form>
                
                <Separator />
                
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Bulk Enrollment</h3>
                  <p className="text-sm text-muted-foreground">
                    You can also upload a CSV file with a list of student emails to invite multiple students at once.
                  </p>
                  <Button variant="outline" className="w-full">
                    Upload CSV
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Course Enrollment Statistics</CardTitle>
            <CardDescription>Overview of student enrollment and activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-3xl font-bold">{students.length}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Active Students</p>
                <p className="text-3xl font-bold">
                  {students.filter(s => s.status === 'enrolled' && s.lastActivity).length}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Completion Rate</p>
                <p className="text-3xl font-bold">
                  {students.length > 0 
                    ? `${Math.round(students.reduce((sum, s) => 
                        sum + (s.assignmentsTotal ? s.assignmentsCompleted / s.assignmentsTotal : 0), 0) 
                        / students.length * 100)}%` 
                    : '0%'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="rounded-md border">
          <Table>
            <TableCaption>A list of all students enrolled in this course</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assignment Progress</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studentsLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No students enrolled yet. Invite students to get started.
                  </TableCell>
                </TableRow>
              ) : (
                students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell>{student.email}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={
                          student.status === 'enrolled' 
                          ? "bg-green-100 text-green-800" 
                          : student.status === 'invited' 
                          ? "bg-blue-100 text-blue-800" 
                          : "bg-gray-100 text-gray-800"
                        }
                      >
                        {student.status === 'enrolled' ? 'Active' : 
                         student.status === 'invited' ? 'Invited' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="secondary" 
                          className={getProgressColor(
                            student.assignmentsCompleted, 
                            student.assignmentsTotal
                          )}
                        >
                          {student.assignmentsCompleted}/{student.assignmentsTotal}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {student.assignmentsTotal === 0 ? '0%' : 
                            `${Math.round((student.assignmentsCompleted / student.assignmentsTotal) * 100)}%`}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {student.lastActivity ? 
                        new Date(student.lastActivity).toLocaleDateString() : 
                        'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveStudent(student.id, student.name)}
                        disabled={removeStudentMutation.isPending}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </InstructorShell>
  );
}