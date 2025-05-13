import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { InstructorShell } from "@/components/layout/instructor-shell";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EnhancedFormField } from "@/components/ui/enhanced-form-field";
import { Form } from "@/components/ui/form";
import { RubricBuilder } from "@/components/instructor/rubric-builder";
import { ShareableLink } from "@/components/instructor/shareable-link";
import { QuillContent } from "@/components/ui/quill-content";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { API_ROUTES, APP_ROUTES } from "@/lib/constants";
import { Rubric } from "@shared/schema";
import { Plus, Info, BookOpen, Loader2 } from "lucide-react";

// Form validation schema with enhanced validation
const assignmentSchema = z.object({
  title: z.string()
    .min(5, { message: "Title must be at least 5 characters" })
    .max(100, { message: "Title must be less than 100 characters" }),
  description: z.string()
    .min(20, { message: "Description must be at least 20 characters" })
    .regex(/.*[.!?](\s|$)/, { message: "Description should have at least one complete sentence" }),
  dueDate: z.date()
    .refine((date) => date > new Date(), { message: "Due date must be in the future" }),
  courseId: z.number().optional(),
  instructorContext: z.string().optional(),
});

type AssignmentFormValues = z.infer<typeof assignmentSchema>;

export default function EnhancedCreateAssignment() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [rubric, setRubric] = useState<Rubric>({ criteria: [], passingThreshold: 60 });
  const [createdAssignment, setCreatedAssignment] = useState<any>(null);
  const [showCourseDialog, setShowCourseDialog] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');
  const [creatingCourse, setCreatingCourse] = useState(false);
  const queryClient = useQueryClient();
  
  // Form validation and state with mode set to onChange for real-time validation
  const form = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      title: "",
      description: "",
      dueDate: new Date(new Date().setDate(new Date().getDate() + 14)), // Default to 2 weeks from now
      instructorContext: "",
    },
    mode: "onChange", // Enables real-time validation as the user types
  });
  
  // Fetch courses for the dropdown
  const { data: courses = [] } = useQuery<any[]>({
    queryKey: [API_ROUTES.COURSES],
  });
  
  // Handle course select change to detect when "Create New Course" is selected
  const handleCourseSelectChange = (value: string) => {
    if (value === 'new') {
      setShowCourseDialog(true);
      return;
    }
    
    form.setValue('courseId', parseInt(value));
  };
  
  // Create course mutation
  const createCourseMutation = useMutation({
    mutationFn: async (newCourse: { name: string; code: string }) => {
      const response = await fetch(API_ROUTES.COURSES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCourse),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create course');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [API_ROUTES.COURSES] });
      form.setValue('courseId', data.id);
      setShowCourseDialog(false);
      setNewCourseName('');
      setNewCourseCode('');
      
      toast({
        title: "Course Created",
        description: `${data.name} has been created successfully.`,
        className: "success-pulse",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create course",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setCreatingCourse(false);
    }
  });
  
  // Handle creating a new course
  const handleCreateCourse = async () => {
    if (!newCourseName.trim() || !newCourseCode.trim()) {
      toast({
        title: "Please fill in all fields",
        description: "Both course name and code are required.",
        variant: "destructive",
      });
      return;
    }
    
    setCreatingCourse(true);
    createCourseMutation.mutate({
      name: newCourseName,
      code: newCourseCode,
    });
  };
  
  // Assignment creation mutation
  const createAssignmentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(API_ROUTES.ASSIGNMENTS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create assignment');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setCreatedAssignment(data);
      
      toast({
        title: "Assignment Created",
        description: "Your assignment has been created successfully.",
        className: "success-pulse",
      });
      
      queryClient.invalidateQueries({ queryKey: [API_ROUTES.ASSIGNMENTS] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create assignment",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setSubmitting(false);
    }
  });
  
  // Handle form submission
  const handleSubmit = async (values: AssignmentFormValues) => {
    if (rubric.criteria.length === 0) {
      toast({
        title: "Missing Rubric Criteria",
        description: "Please add at least one criterion to the rubric.",
        variant: "destructive",
      });
      return;
    }
    
    setSubmitting(true);
    
    const assignmentData = {
      ...values,
      rubric,
    };
    
    createAssignmentMutation.mutate(assignmentData);
  };
  
  return (
    <InstructorShell>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Create Assignment</h1>
          <p className="text-muted-foreground">Define a new assignment with AI feedback criteria</p>
        </div>
        
        {createdAssignment ? (
          <div className="space-y-6 slide-up">
            <Card className="border-green-200 bg-green-50/50">
              <CardHeader className="pb-4">
                <CardTitle>Assignment Created Successfully</CardTitle>
                <CardDescription>
                  Your assignment has been created and is ready to share with students
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-medium">Title</h3>
                  <p>{createdAssignment.title}</p>
                </div>
                <div>
                  <h3 className="font-medium">Description</h3>
                  <QuillContent 
                    content={createdAssignment.description}
                    className="text-sm text-neutral-600"
                  />
                </div>
                <div className="flex flex-wrap gap-4">
                  <div>
                    <h3 className="font-medium">Due Date</h3>
                    <p className="text-sm">
                      {new Date(createdAssignment.dueDate).toLocaleDateString()} at {new Date(createdAssignment.dueDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      <span className="ml-1 text-xs text-muted-foreground">({Intl.DateTimeFormat().resolvedOptions().timeZone})</span>
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium">Status</h3>
                    <p className="text-sm capitalize">{createdAssignment.status}</p>
                  </div>
                </div>
                
                {createdAssignment.instructorContext && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                    <h3 className="font-medium text-amber-800">Instructor-Only Context (Hidden from Students)</h3>
                    <QuillContent 
                      content={createdAssignment.instructorContext}
                      className="text-sm text-amber-700"
                    />
                  </div>
                )}
                
                <Separator />
                
                <ShareableLink 
                  assignmentId={createdAssignment.id}
                  shareableCode={createdAssignment.shareableCode}
                />
                
                <div className="pt-4 flex justify-between">
                  <Button 
                    variant="outline"
                    onClick={() => navigate(APP_ROUTES.INSTRUCTOR_DASHBOARD)}
                  >
                    Return to Dashboard
                  </Button>
                  <Button 
                    onClick={() => {
                      setCreatedAssignment(null);
                      form.reset();
                      setRubric({ criteria: [], passingThreshold: 60 });
                    }}
                    className="press-effect"
                  >
                    Create Another Assignment
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Assignment Details</CardTitle>
                  <CardDescription>
                    Basic information about the assignment
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <EnhancedFormField
                    control={form.control}
                    name="title"
                    label="Title"
                    placeholder="Enter a clear, descriptive title for your assignment"
                    description="A concise title that clearly indicates what the assignment is about"
                    required
                    validateOnChange
                    showSuccessState
                  />
                  
                  <EnhancedFormField
                    control={form.control}
                    name="description"
                    label="Description"
                    type="textarea"
                    placeholder="Provide detailed instructions for students to complete the assignment"
                    description="Comprehensive instructions including requirements, submission format, and expectations"
                    required
                    rows={6}
                    validateOnChange
                    showSuccessState
                  />
                  
                  <div className="grid gap-6 sm:grid-cols-2">
                    <EnhancedFormField
                      control={form.control}
                      name="courseId"
                      label="Course"
                      type="select"
                      placeholder="Select a course (optional)"
                      options={[
                        ...courses.map((course: any) => ({
                          label: course.name,
                          value: course.id.toString(),
                        })),
                        { label: "Create New Course", value: "new" },
                      ]}
                      description="The course this assignment belongs to (optional)"
                    />
                    
                    <EnhancedFormField
                      control={form.control}
                      name="dueDate"
                      label="Due Date"
                      type="date"
                      placeholder="Select due date"
                      description="The deadline for student submissions"
                      required
                      validateOnChange
                      showSuccessState
                    />
                  </div>
                  
                  <div>
                    <EnhancedFormField
                      control={form.control}
                      name="instructorContext"
                      label="Instructor-Only Context (Optional)"
                      type="textarea"
                      placeholder="Additional context, notes, or guidance for yourself or other instructors that won't be visible to students"
                      description="This information will only be visible to instructors, not students"
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Grading Rubric</CardTitle>
                  <CardDescription>
                    Define criteria for AI feedback and evaluation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RubricBuilder rubric={rubric} setRubric={setRubric} />
                </CardContent>
              </Card>
              
              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  className="press-effect" 
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span className="mr-2">Creating...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" /> 
                      Create Assignment
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
        
        <Dialog open={showCourseDialog} onOpenChange={setShowCourseDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Course</DialogTitle>
              <DialogDescription>
                Add a new course to organize your assignments.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Course Name
                </label>
                <Input
                  id="name"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  placeholder="e.g., Introduction to Computer Science"
                  className="field-focus-animation"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="code" className="text-sm font-medium">
                  Course Code
                </label>
                <Input
                  id="code"
                  value={newCourseCode}
                  onChange={(e) => setNewCourseCode(e.target.value)}
                  placeholder="e.g., CS101"
                  className="field-focus-animation"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCourseDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateCourse} 
                disabled={creatingCourse}
                className="press-effect"
              >
                {creatingCourse ? 'Creating...' : 'Create Course'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </InstructorShell>
  );
}