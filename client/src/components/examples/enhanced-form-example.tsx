import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { EnhancedFormField } from "@/components/ui/enhanced-form-field";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Trash2, Loader2, Save, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Define the form schema with validation rules
const formSchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  role: z.string().min(1, { message: "Please select a role" }),
  bio: z.string().max(200, { message: "Bio must be less than 200 characters" }).optional(),
  agreeToTerms: z.boolean().refine((val) => val === true, {
    message: "You must agree to the terms and conditions"
  }),
  notifications: z.boolean().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function EnhancedFormExample() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  // Initialize form with default values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "",
      bio: "",
      agreeToTerms: false,
      notifications: false,
    },
    mode: "onTouched", // Validate fields when they are touched and on submit
  });

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Form submission logging removed for production
    
    toast({
      title: "Form Submitted Successfully",
      description: `Thank you ${data.name}! Your information has been saved.`,
      className: "success-pulse",
    });
    
    setIsSubmitting(false);
  }

  function handleReset() {
    form.reset();
    toast({
      title: "Form Reset",
      description: "All form fields have been cleared.",
    });
  }

  function handleDelete() {
    toast({
      title: "Profile Deleted",
      description: "Your profile has been permanently deleted.",
      variant: "destructive",
    });
    form.reset();
  }

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Enhanced Form Example</CardTitle>
        <CardDescription>
          This form demonstrates enhanced interactions with MIT-branded focus states, 
          inline validation, and confirmation dialogs.
        </CardDescription>
      </CardHeader>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <CardContent className="space-y-4">
            <EnhancedFormField
              control={form.control}
              name="name"
              label="Full Name"
              placeholder="Enter your full name"
              description="Your name as it will appear on your profile"
              required
            />
            
            <EnhancedFormField
              control={form.control}
              name="email"
              label="Email Address"
              type="email"
              placeholder="your.email@example.com"
              description="We'll never share your email with anyone else"
              required
            />
            
            <EnhancedFormField
              control={form.control}
              name="role"
              label="Role"
              type="select"
              placeholder="Select your role"
              options={[
                { label: "Student", value: "student" },
                { label: "Instructor", value: "instructor" },
                { label: "Administrator", value: "admin" },
              ]}
              required
            />
            
            <EnhancedFormField
              control={form.control}
              name="bio"
              label="Bio"
              type="textarea"
              placeholder="Tell us about yourself"
              description="Optional: Share a brief description about yourself"
            />
            
            <div className="pt-2">
              <EnhancedFormField
                control={form.control}
                name="notifications"
                label="Preferences"
                type="switch"
                placeholder="Receive email notifications"
              />
            </div>
            
            <div className="pt-2">
              <EnhancedFormField
                control={form.control}
                name="agreeToTerms"
                label="Terms & Privacy"
                type="checkbox"
                placeholder="I agree to the terms and privacy policy"
                required
              />
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-between">
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleReset}
                className="press-effect"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset
              </Button>
              
              <ConfirmationDialog
                title="Delete Profile"
                description="Are you sure you want to delete your profile? This action cannot be undone and all your data will be permanently removed."
                confirmText="Delete"
                onConfirm={handleDelete}
                triggerButton={
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="text-red-600 hover:bg-red-50 press-effect"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                }
              />
            </div>
            
            <Button type="submit" disabled={isSubmitting} className="press-effect">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}