import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { InstructorShell } from "@/components/layout/instructor-shell";
import { USER_ROLES } from "@/lib/constants";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";

// Form schema for account settings
const accountFormSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  if (data.currentPassword && (!data.newPassword || !data.confirmPassword)) {
    return false;
  }
  return true;
}, {
  message: "New password and confirm password are required when changing password.",
  path: ['newPassword'],
}).refine((data) => {
  if (data.newPassword && data.newPassword !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "Passwords do not match.",
  path: ['confirmPassword'],
});

// Form schema for notification settings
const notificationFormSchema = z.object({
  emailNotifications: z.boolean().default(true),
  assignmentNotifications: z.boolean().default(true),
  feedbackNotifications: z.boolean().default(true),
  systemNotifications: z.boolean().default(false),
});

// Form schema for AI feedback settings
const aiSettingsFormSchema = z.object({
  detailedFeedbackEnabled: z.boolean().default(true),
  includeStrengths: z.boolean().default(true),
  includeWeaknesses: z.boolean().default(true),
  includeSuggestions: z.boolean().default(true),
  aiScoring: z.boolean().default(true),
  customPromptEnabled: z.boolean().default(false),
  customPrompt: z.string().optional(),
});

export default function SettingsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("account");
  
  // Redirect non-instructors away
  useEffect(() => {
    if (user?.role !== USER_ROLES.INSTRUCTOR && user?.role !== USER_ROLES.ADMIN) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Setup account form
  const accountForm = useForm<z.infer<typeof accountFormSchema>>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Setup notifications form
  const notificationForm = useForm<z.infer<typeof notificationFormSchema>>({
    resolver: zodResolver(notificationFormSchema),
    defaultValues: {
      emailNotifications: true,
      assignmentNotifications: true,
      feedbackNotifications: true,
      systemNotifications: false,
    },
  });

  // Setup AI settings form
  const aiSettingsForm = useForm<z.infer<typeof aiSettingsFormSchema>>({
    resolver: zodResolver(aiSettingsFormSchema),
    defaultValues: {
      detailedFeedbackEnabled: true,
      includeStrengths: true,
      includeWeaknesses: true,
      includeSuggestions: true,
      aiScoring: true,
      customPromptEnabled: false,
      customPrompt: "",
    },
  });

  // Update user profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: z.infer<typeof accountFormSchema>) => {
      const response = await apiRequest("PUT", "/api/user/profile", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update profile",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update notification settings mutation
  const updateNotificationsMutation = useMutation({
    mutationFn: async (data: z.infer<typeof notificationFormSchema>) => {
      const response = await apiRequest("PUT", "/api/user/notifications", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Notification settings updated",
        description: "Your notification preferences have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update notification settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update AI settings mutation
  const updateAiSettingsMutation = useMutation({
    mutationFn: async (data: z.infer<typeof aiSettingsFormSchema>) => {
      const response = await apiRequest("PUT", "/api/user/ai-settings", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "AI settings updated",
        description: "Your AI feedback preferences have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update AI settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form submission handlers
  const onSubmitAccountForm = (data: z.infer<typeof accountFormSchema>) => {
    updateProfileMutation.mutate(data);
  };

  const onSubmitNotificationForm = (data: z.infer<typeof notificationFormSchema>) => {
    updateNotificationsMutation.mutate(data);
  };

  const onSubmitAiSettingsForm = (data: z.infer<typeof aiSettingsFormSchema>) => {
    updateAiSettingsMutation.mutate(data);
  };

  return (
    <InstructorShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account and preferences
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <Tabs defaultValue="account" value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="ai-settings">AI Feedback</TabsTrigger>
          </TabsList>
          
          {/* Account Settings */}
          <TabsContent value="account" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>
                  Update your account information and change your password
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...accountForm}>
                  <form onSubmit={accountForm.handleSubmit(onSubmitAccountForm)} className="space-y-6">
                    <FormField
                      control={accountForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={accountForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Separator className="my-4" />
                    <h3 className="mb-4 text-lg font-medium">Change Password</h3>
                    
                    <FormField
                      control={accountForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        control={accountForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>New Password</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={accountForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm New Password</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="mt-4"
                      disabled={updateProfileMutation.isPending}
                    >
                      {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Notification Settings */}
          <TabsContent value="notifications" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Choose what notifications you want to receive
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...notificationForm}>
                  <form onSubmit={notificationForm.handleSubmit(onSubmitNotificationForm)} className="space-y-4">
                    <FormField
                      control={notificationForm.control}
                      name="emailNotifications"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Email Notifications</FormLabel>
                            <FormDescription>
                              Receive email notifications for important updates
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={notificationForm.control}
                      name="assignmentNotifications"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Assignment Updates</FormLabel>
                            <FormDescription>
                              Get notified when students submit assignments
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={notificationForm.control}
                      name="feedbackNotifications"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Feedback Notifications</FormLabel>
                            <FormDescription>
                              Get notified when AI generates feedback
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={notificationForm.control}
                      name="systemNotifications"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">System Notifications</FormLabel>
                            <FormDescription>
                              Receive updates about system changes and maintenance
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <Button 
                      type="submit" 
                      className="mt-4"
                      disabled={updateNotificationsMutation.isPending}
                    >
                      {updateNotificationsMutation.isPending ? "Saving..." : "Save Preferences"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* AI Settings */}
          <TabsContent value="ai-settings" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AI Feedback Settings</CardTitle>
                <CardDescription>
                  Customize how AI generates feedback for student assignments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...aiSettingsForm}>
                  <form onSubmit={aiSettingsForm.handleSubmit(onSubmitAiSettingsForm)} className="space-y-4">
                    <FormField
                      control={aiSettingsForm.control}
                      name="detailedFeedbackEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Detailed Feedback</FormLabel>
                            <FormDescription>
                              Generate comprehensive feedback for student assignments
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <div className="ml-6 space-y-4">
                      <FormField
                        control={aiSettingsForm.control}
                        name="includeStrengths"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={!aiSettingsForm.watch("detailedFeedbackEnabled")}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>
                                Include strengths in feedback
                              </FormLabel>
                              <FormDescription>
                                Highlight what students did well
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={aiSettingsForm.control}
                        name="includeWeaknesses"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={!aiSettingsForm.watch("detailedFeedbackEnabled")}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>
                                Include areas for improvement
                              </FormLabel>
                              <FormDescription>
                                Identify weaknesses and areas to improve
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={aiSettingsForm.control}
                        name="includeSuggestions"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={!aiSettingsForm.watch("detailedFeedbackEnabled")}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>
                                Include suggestions for improvement
                              </FormLabel>
                              <FormDescription>
                                Provide actionable recommendations
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={aiSettingsForm.control}
                      name="aiScoring"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">AI Scoring</FormLabel>
                            <FormDescription>
                              Allow AI to assign scores based on rubric
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={aiSettingsForm.control}
                      name="customPromptEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Custom AI Prompt</FormLabel>
                            <FormDescription>
                              Use your own prompt for AI feedback generation
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    {aiSettingsForm.watch("customPromptEnabled") && (
                      <FormField
                        control={aiSettingsForm.control}
                        name="customPrompt"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Custom Prompt</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter your custom prompt for the AI..." 
                                {...field} 
                              />
                            </FormControl>
                            <FormDescription>
                              Use {"{submission}"} to reference the student's submission
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    
                    <Button 
                      type="submit" 
                      className="mt-4"
                      disabled={updateAiSettingsMutation.isPending}
                    >
                      {updateAiSettingsMutation.isPending ? "Saving..." : "Save AI Settings"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </InstructorShell>
  );
}