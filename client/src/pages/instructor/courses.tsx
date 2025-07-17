import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { InstructorShell } from "@/components/layout/instructor-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, BookOpen, MoreHorizontal, Pencil, Users } from "lucide-react";
import { API_ROUTES, APP_ROUTES } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

// Course form schema
const courseFormSchema = z.object({
  name: z.string().min(3, { message: "Course name must be at least 3 characters" }),
  code: z.string().min(2, { message: "Course code must be at least 2 characters" }),
  description: z.string().optional(),
});

type CourseFormValues = z.infer<typeof courseFormSchema>;

export default function CoursesPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Set up react-hook-form
  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
    },
  });
  
  // Query courses
  const { data: courses = [], isLoading } = useQuery({
    queryKey: [API_ROUTES.COURSES],
  });
  
  // Mutation for creating a new course
  const createCourseMutation = useMutation({
    mutationFn: async (values: CourseFormValues) => {
      const response = await apiRequest("POST", API_ROUTES.COURSES, values);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [API_ROUTES.COURSES] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Course Created",
        description: "Your new course has been created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create course. Please try again.",
      });
    },
  });
  
  function onSubmit(values: CourseFormValues) {
    createCourseMutation.mutate(values);
  }
  
  return (
    <InstructorShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Courses</h1>
            <p className="text-muted-foreground">
              Manage your courses and their assignments
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Course
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a New Course</DialogTitle>
                <DialogDescription>
                  Enter the details for your new course
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Course Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Introduction to Programming" {...field} />
                        </FormControl>
                        <FormDescription>
                          The full name of your course
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Course Code</FormLabel>
                        <FormControl>
                          <Input placeholder="CS101" {...field} />
                        </FormControl>
                        <FormDescription>
                          A short code to identify your course
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="A brief description of your course content and objectives"
                            className="min-h-24"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsDialogOpen(false)}
                      disabled={createCourseMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createCourseMutation.isPending}
                    >
                      {createCourseMutation.isPending ? "Creating..." : "Create Course"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
        
        <Separator />
        
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array(3).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-lg" />
            ))}
          </div>
        ) : (courses as any[])?.length === 0 ? (
          <div className="flex h-[450px] shrink-0 items-center justify-center rounded-lg border border-dashed">
            <div className="mx-auto flex max-w-[450px] flex-col items-center justify-center text-center">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No courses created</h3>
              <p className="mb-4 mt-2 text-sm text-muted-foreground">
                You haven't created any courses yet. Create one to get started.
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Course
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course: any) => (
              <Card key={course.id} className="overflow-hidden">
                <CardHeader className="pb-3 relative">
                  <CardTitle>{course.name}</CardTitle>
                  <CardDescription>
                    <span className="font-mono text-sm">{course.code}</span>
                  </CardDescription>
                  <div className="absolute right-6 top-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(APP_ROUTES.INSTRUCTOR_COURSE_EDIT(course.id))}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(APP_ROUTES.INSTRUCTOR_COURSE_STUDENTS(course.id))}>
                          <Users className="mr-2 h-4 w-4" />
                          Students
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2 min-h-10">
                    {course.description || "No description provided"}
                  </p>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center text-sm">
                      <span className="font-semibold">Assignments:</span>
                      <span className="ml-1">{course.assignmentCount || 0}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="font-semibold">Students:</span>
                      <span className="ml-1">{course.studentCount || 0}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between border-t bg-muted/50 px-6 py-3">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={APP_ROUTES.INSTRUCTOR_COURSE(course.id)}>
                      View Details
                    </Link>
                  </Button>
                  
                  <Button asChild variant="outline" size="sm">
                    <Link href={`${APP_ROUTES.INSTRUCTOR_CREATE_ASSIGNMENT}?courseId=${course.id}`}>
                      <Plus className="mr-1 h-3 w-3" />
                      Assignment
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </InstructorShell>
  );
}