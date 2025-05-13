import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { InstructorShell } from "@/components/layout/instructor-shell";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { API_ROUTES, APP_ROUTES } from "@/lib/constants";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Rubric } from '@shared/schema';
import { RubricBuilder } from "@/components/instructor/rubric-builder";
import { RubricTester } from "@/components/instructor/rubric-tester";
import { ShareableLink } from "@/components/instructor/shareable-link";
import { TooltipInfo } from "@/components/ui/tooltip-info";
import { RichTextEditor } from "@/components/rich-text-editor";
import { QuillContent } from "@/components/quill-content";

// Create a schema for assignment creation
const assignmentSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters" }),
  description: z.string().min(10, { message: "Description must be at least 10 characters" }),
  courseId: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  dueDate: z.date({ required_error: "Please select a due date" }),
  instructorContext: z.string().optional(),
});

type AssignmentFormValues = z.infer<typeof assignmentSchema>;

export default function CreateAssignment() {
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
  
  // Form validation and state
  const form = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      title: "",
      description: "",
      dueDate: new Date(new Date().setDate(new Date().getDate() + 14)), // Default to 2 weeks from now
      instructorContext: "",
    },
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
  
  // Handle new course creation
  const handleCreateCourse = async () => {
    if (!newCourseName.trim() || !newCourseCode.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both a course name and code",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setCreatingCourse(true);
      
      // Use apiRequest from queryClient to properly handle CSRF tokens and authentication
      const response = await apiRequest('POST', API_ROUTES.COURSES, {
        name: newCourseName,
        code: newCourseCode,
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create course: ${response.statusText}`);
      }
      
      const course = await response.json();
      
      // Update the courses list
      queryClient.invalidateQueries({ queryKey: [API_ROUTES.COURSES] });
      
      // Set the new course as selected
      form.setValue('courseId', course.id.toString());
      
      // Reset and close dialog
      setNewCourseName('');
      setNewCourseCode('');
      setShowCourseDialog(false);
      
      toast({
        title: "Course Created",
        description: `Successfully created course: ${course.name}`,
      });
    } catch (error) {
      console.error('Error creating course:', error);
      toast({
        title: "Error",
        description: "Failed to create course. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreatingCourse(false);
    }
  };
  
  // Handle form submission
  const handleSubmit = async (values: AssignmentFormValues) => {
    try {
      setSubmitting(true);
      
      // Prepare the payload
      const payload = {
        ...values,
        dueDate: values.dueDate.toISOString(),
        // Only include instructorContext if it's not empty
        instructorContext: values.instructorContext?.trim() ? values.instructorContext : undefined,
        rubric: rubric.criteria.length > 0 ? {
          criteria: rubric.criteria,
          totalPoints: rubric.criteria.reduce((sum, c) => sum + c.maxScore * c.weight, 0),
          passingThreshold: rubric.passingThreshold,
        } : undefined,
      };
      
      // Send request to create assignment using apiRequest helper
      const response = await apiRequest('POST', API_ROUTES.ASSIGNMENTS, payload);
      
      if (!response.ok) {
        throw new Error(`Failed to create assignment: ${response.statusText}`);
      }
      
      const assignment = await response.json();
      
      // Update UI with the newly created assignment
      setCreatedAssignment(assignment);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: [API_ROUTES.ASSIGNMENTS] });
      
      // Show success toast
      toast({
        title: "Assignment Created",
        description: "Your assignment has been successfully created",
      });
    } catch (error) {
      console.error('Error creating assignment:', error);
      toast({
        title: "Error",
        description: "Failed to create assignment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <InstructorShell>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Create Assignment</h1>
          <p className="text-muted-foreground">Define a new assignment with AI feedback criteria</p>
        </div>
        
        {createdAssignment ? (
          <div className="space-y-6">
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
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center space-x-2">
                          <FormLabel>Title</FormLabel>
                          <TooltipInfo content={
                            <>
                              <p className="font-medium">How this is used:</p>
                              <p>The title is displayed to students on their dashboard and appears in the AI-generated feedback. It helps students identify assignments and provides context for the AI.</p>
                              <p className="mt-1 font-medium">Tips:</p>
                              <ul className="list-disc pl-4 space-y-1">
                                <li>Keep it clear, descriptive, and specific (e.g., "Python Loop Implementation Exercise")</li>
                                <li>Include programming language/concept to help the AI contextualize</li>
                                <li>Avoid generic titles like "Assignment 1" as they provide less context for AI feedback</li>
                              </ul>
                            </>
                          } />
                        </div>
                        <FormControl>
                          <Input 
                            placeholder="Enter assignment title"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          A clear, concise title for the assignment
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
                        <div className="flex items-center space-x-2">
                          <FormLabel>Description</FormLabel>
                          <TooltipInfo content={
                            <>
                              <p className="font-medium">How this is used:</p>
                              <p>The description is sent to the AI along with student submissions to provide context for feedback. It's also shown to students when they view the assignment.</p>
                              <p className="mt-1 font-medium">Tips:</p>
                              <ul className="list-disc pl-4 space-y-1">
                                <li>Be specific about what the code should accomplish</li>
                                <li>Mention programming languages, frameworks, or libraries students should use</li>
                                <li>Include any specific requirements or constraints</li>
                                <li>Add examples or sample inputs/outputs if applicable</li>
                                <li>The AI will use this context to provide more accurate feedback</li>
                              </ul>
                            </>
                          } />
                        </div>
                        <FormControl>
                          <RichTextEditor
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Enter detailed assignment instructions"
                            className="min-h-32"
                          />
                        </FormControl>
                        <FormDescription>
                          Provide detailed instructions, requirements, and expectations
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="instructorContext"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center space-x-2">
                          <FormLabel>Instructor-Only Context (Hidden from Students)</FormLabel>
                          <TooltipInfo content={
                            <>
                              <p className="font-medium">How this is used:</p>
                              <p>This information is only provided to the AI for evaluation and is <strong>never shown to students</strong>. It helps the AI provide more accurate feedback by giving it private context that instructors want to keep hidden.</p>
                              <p className="mt-1 font-medium">Tips:</p>
                              <ul className="list-disc pl-4 space-y-1">
                                <li>Include correct solutions, implementation approaches, or specific criteria</li>
                                <li>Mention common pitfalls or mistakes students might make</li>
                                <li>Provide examples of excellent, average, and poor implementations</li>
                                <li>Include special considerations the AI should account for when providing feedback</li>
                                <li>The AI will use this guidance but will not reveal it directly to students</li>
                              </ul>
                            </>
                          } />
                        </div>
                        <FormControl>
                          <RichTextEditor
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Enter private guidance for the AI (not visible to students)"
                            className="min-h-32 bg-amber-50 border-amber-200"
                            isDarkBg={false}
                          />
                        </FormControl>
                        <FormDescription>
                          This information is used to guide AI feedback but is never revealed to students
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid gap-6 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="courseId"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center space-x-2">
                            <FormLabel>Course</FormLabel>
                            <TooltipInfo content={
                              <>
                                <p className="font-medium">How this is used:</p>
                                <p>The course determines which students will see this assignment on their dashboard and be able to submit solutions.</p>
                                <p className="mt-1 font-medium">Tips:</p>
                                <ul className="list-disc pl-4 space-y-1">
                                  <li>Only students enrolled in this course will have access to the assignment</li>
                                  <li>Make sure all students who need to complete this assignment are enrolled in the selected course</li>
                                  <li>Students can be enrolled in multiple courses simultaneously</li>
                                </ul>
                              </>
                            } />
                          </div>
                          <Select 
                            onValueChange={handleCourseSelectChange} 
                            defaultValue={field.value?.toString()}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select course" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {courses.map((course: any) => (
                                <SelectItem key={course.id} value={course.id.toString()}>
                                  {course.name} ({course.code})
                                </SelectItem>
                              ))}
                              <Separator className="my-1" />
                              <SelectItem value="new" className="text-primary font-medium">
                                + Create New Course
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          
                          {/* Course Creation Dialog */}
                          <Dialog open={showCourseDialog} onOpenChange={setShowCourseDialog}>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Create New Course</DialogTitle>
                                <DialogDescription>
                                  Add a new course to assign this assignment to.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                  <Label htmlFor="courseName">Course Name</Label>
                                  <Input
                                    id="courseName"
                                    value={newCourseName}
                                    onChange={(e) => setNewCourseName(e.target.value)}
                                    placeholder="Introduction to Programming"
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor="courseCode">Course Code</Label>
                                  <Input
                                    id="courseCode"
                                    value={newCourseCode}
                                    onChange={(e) => setNewCourseCode(e.target.value)}
                                    placeholder="CS101"
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setShowCourseDialog(false)}>
                                  Cancel
                                </Button>
                                <Button onClick={handleCreateCourse} disabled={creatingCourse}>
                                  {creatingCourse ? 'Creating...' : 'Create Course'}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          <FormDescription>
                            The course this assignment belongs to (optional)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <div className="flex items-center space-x-2">
                            <FormLabel>Due Date</FormLabel>
                            <TooltipInfo content={
                              <>
                                <p className="font-medium">How this is used:</p>
                                <p>The due date is displayed to students and determines when the assignment is no longer accepting submissions. It's also useful for AI scoring context.</p>
                                <p className="mt-1 font-medium">Tips:</p>
                                <ul className="list-disc pl-4 space-y-1">
                                  <li>Allow sufficient time for students to complete the assignment</li>
                                  <li>Due dates can impact how the AI evaluates "timeliness" in feedback</li>
                                  <li>Students can submit before the deadline but not after</li>
                                  <li>Setting a reasonable deadline encourages better time management</li>
                                </ul>
                              </>
                            } />
                          </div>
                          <div className="space-y-2">
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "PPP")
                                    ) : (
                                      <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) => date < new Date()}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            
                            <div className="flex items-center gap-2">
                              <div className="grid grid-cols-2 gap-2 flex-1">
                                <div className="flex items-center gap-1 border rounded-md px-3 py-1">
                                  <span className="text-muted-foreground text-sm">Time:</span>
                                  <select
                                    className="flex-1 bg-transparent focus:outline-none"
                                    value={field.value.getHours()}
                                    onChange={(e) => {
                                      const newDate = new Date(field.value);
                                      newDate.setHours(parseInt(e.target.value));
                                      field.onChange(newDate);
                                    }}
                                  >
                                    {Array.from({length: 24}, (_, i) => (
                                      <option key={i} value={i}>
                                        {i.toString().padStart(2, '0')}
                                      </option>
                                    ))}
                                  </select>
                                  <span>:</span>
                                  <select
                                    className="flex-1 bg-transparent focus:outline-none"
                                    value={field.value.getMinutes()}
                                    onChange={(e) => {
                                      const newDate = new Date(field.value);
                                      newDate.setMinutes(parseInt(e.target.value));
                                      field.onChange(newDate);
                                    }}
                                  >
                                    {[0, 15, 30, 45].map((minute) => (
                                      <option key={minute} value={minute}>
                                        {minute.toString().padStart(2, '0')}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex items-center border rounded-md px-3 py-1">
                                  <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">
                                    Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <FormDescription>
                            Deadline for submission
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center space-x-2">
                    <CardTitle>Rubric Builder</CardTitle>
                    <TooltipInfo content={
                      <>
                        <p className="font-medium">How this is used:</p>
                        <p>The rubric is the most important element for AI feedback. It defines what aspects of the submission the AI should evaluate and how to weight the scoring.</p>
                        <p className="mt-1 font-medium">Tips:</p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>Each criterion should be specific and measurable</li>
                          <li>Higher weight criteria have more impact on final score</li>
                          <li>Include criteria for both technical correctness and code quality</li>
                          <li>The AI uses these criteria to structure its feedback</li>
                          <li>Use the "Test Your Rubric" feature below to see how the AI will apply your rubric</li>
                        </ul>
                      </>
                    } />
                  </div>
                  <CardDescription>
                    Define criteria for AI evaluation of student submissions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RubricBuilder 
                    rubric={rubric} 
                    setRubric={setRubric} 
                  />
                </CardContent>
              </Card>
              
              {rubric.criteria.length > 0 && (
                <RubricTester 
                  rubric={rubric}
                  assignmentTitle={form.watch("title") || "Untitled Assignment"}
                  assignmentDescription={form.watch("description") || "No description provided"}
                />
              )}
              
              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(APP_ROUTES.INSTRUCTOR_DASHBOARD)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="mr-2">Creating...</span>
                    </>
                  ) : (
                    'Create Assignment'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </div>
    </InstructorShell>
  );
}