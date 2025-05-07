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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { API_ROUTES, APP_ROUTES } from "@/lib/constants";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Rubric, RubricBuilder } from "@/components/instructor/rubric-builder";
import { ShareableLink } from "@/components/instructor/shareable-link";

// Create a schema for assignment creation
const assignmentSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters" }),
  description: z.string().min(10, { message: "Description must be at least 10 characters" }),
  courseId: z.string({ required_error: "Please select a course" }).transform(val => parseInt(val)),
  dueDate: z.date({ required_error: "Please select a due date" }),
});

type AssignmentFormValues = z.infer<typeof assignmentSchema>;

export default function CreateAssignment() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [rubric, setRubric] = useState<Rubric>({ criteria: [], passingThreshold: 60 });
  const [createdAssignment, setCreatedAssignment] = useState<any>(null);
  const queryClient = useQueryClient();
  
  // Form validation and state
  const form = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      title: "",
      description: "",
      dueDate: new Date(new Date().setDate(new Date().getDate() + 14)), // Default to 2 weeks from now
    },
  });
  
  // Fetch courses for the dropdown
  const { data: courses = [] } = useQuery({
    queryKey: [API_ROUTES.COURSES],
  });
  
  // Handle form submission
  const handleSubmit = async (values: AssignmentFormValues) => {
    try {
      setSubmitting(true);
      
      // Prepare the payload
      const payload = {
        ...values,
        dueDate: values.dueDate.toISOString(),
        rubric: rubric.criteria.length > 0 ? {
          criteria: rubric.criteria,
          totalPoints: rubric.criteria.reduce((sum, c) => sum + c.maxScore * c.weight, 0),
          passingThreshold: rubric.passingThreshold,
        } : undefined,
      };
      
      // Send request to create assignment
      const response = await fetch(API_ROUTES.ASSIGNMENTS, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
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
                  <p className="text-sm text-neutral-600">{createdAssignment.description}</p>
                </div>
                <div className="flex flex-wrap gap-4">
                  <div>
                    <h3 className="font-medium">Due Date</h3>
                    <p className="text-sm">{new Date(createdAssignment.dueDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <h3 className="font-medium">Status</h3>
                    <p className="text-sm capitalize">{createdAssignment.status}</p>
                  </div>
                </div>
                
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
                        <FormLabel>Title</FormLabel>
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
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter detailed assignment instructions"
                            className="min-h-32"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Provide detailed instructions, requirements, and expectations
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
                          <FormLabel>Course</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
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
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            The course this assignment belongs to
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
                          <FormLabel>Due Date</FormLabel>
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
              
              <RubricBuilder 
                value={rubric} 
                onChange={setRubric} 
              />
              
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