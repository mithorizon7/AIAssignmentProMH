import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { EnhancedFormExample } from "@/components/examples/enhanced-form-example";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Info, Lightbulb, AlertTriangle, RefreshCw, RotateCw, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function UXExamples() {
  const { toast } = useToast();
  
  const showToast = (type: "default" | "success" | "error" | "info") => {
    const toastOptions: Record<string, any> = {
      default: {
        title: "Notification",
        description: "This is a standard notification message.",
      },
      success: {
        title: "Success!",
        description: "Your action was completed successfully.",
        className: "success-pulse",
      },
      error: {
        title: "Error",
        description: "There was a problem with your request.",
        variant: "destructive",
      },
      info: {
        title: "Information",
        description: "Here's some information you might find useful.",
        className: "bg-blue-50 text-blue-800 border border-blue-200",
      },
    };
    
    toast(toastOptions[type]);
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto fade-in">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-neutral-800 mb-2">Enhanced UX Examples</h1>
          <p className="text-neutral-600">
            This page showcases the improved user experience components including enhanced form interactions,
            confirmation dialogs, and other microinteractions.
          </p>
        </div>
        
        <Tabs defaultValue="forms" className="mb-10">
          <TabsList className="mb-4">
            <TabsTrigger value="forms">Enhanced Forms</TabsTrigger>
            <TabsTrigger value="dialogs">Confirmation Dialogs</TabsTrigger>
            <TabsTrigger value="microinteractions">Microinteractions</TabsTrigger>
            <TabsTrigger value="toasts">Toast Notifications</TabsTrigger>
          </TabsList>
          
          <TabsContent value="forms" className="space-y-8 slide-up" style={{animationDelay: "100ms"}}>
            <EnhancedFormExample />
          </TabsContent>
          
          <TabsContent value="dialogs" className="space-y-8 slide-up" style={{animationDelay: "100ms"}}>
            <Card>
              <CardHeader>
                <CardTitle>Confirmation Dialogs</CardTitle>
                <CardDescription>
                  Confirmation dialogs ensure users don't accidentally perform destructive actions.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-4">
                <ConfirmationDialog
                  title="Delete Assignment"
                  description="Are you sure you want to delete this assignment? This action cannot be undone and all related submissions and feedback will be permanently removed."
                  confirmText="Delete Assignment"
                  onConfirm={() => toast({
                    title: "Assignment Deleted",
                    description: "The assignment has been permanently deleted.",
                    variant: "destructive",
                  })}
                  triggerButton={
                    <Button variant="destructive" className="press-effect">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Assignment
                    </Button>
                  }
                />
                
                <ConfirmationDialog
                  title="Unenroll Student"
                  description="Are you sure you want to unenroll this student from the course? They will lose access to all course materials and assignments."
                  confirmText="Unenroll"
                  onConfirm={() => toast({
                    title: "Student Unenrolled",
                    description: "The student has been unenrolled from the course.",
                  })}
                  triggerButton={
                    <Button variant="outline" className="press-effect">
                      <AlertTriangle className="mr-2 h-4 w-4 text-amber-500" />
                      Unenroll Student
                    </Button>
                  }
                  icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
                  destructive={false}
                />
                
                <ConfirmationDialog
                  title="Reset Progress"
                  description="Are you sure you want to reset your progress for this assignment? All your submissions will remain but your last feedback will be cleared."
                  confirmText="Reset Progress"
                  onConfirm={() => toast({
                    title: "Progress Reset",
                    description: "Your progress has been reset successfully.",
                  })}
                  triggerButton={
                    <Button variant="outline" className="press-effect">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Reset Progress
                    </Button>
                  }
                  icon={<RotateCw className="h-5 w-5 text-blue-500" />}
                  destructive={false}
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="microinteractions" className="space-y-8 slide-up" style={{animationDelay: "100ms"}}>
            <Card>
              <CardHeader>
                <CardTitle>Microinteractions & Animations</CardTitle>
                <CardDescription>
                  Subtle animations and transitions enhance the user experience and provide feedback.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-md">
                    <h3 className="font-medium mb-2">Hover Effects</h3>
                    <Button variant="outline" className="hover-lift mb-4 w-full">
                      Hover to lift
                    </Button>
                    <div className="text-xs text-neutral-500">
                      Adds depth on hover to indicate interactivity
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-md">
                    <h3 className="font-medium mb-2">Press Effects</h3>
                    <Button className="press-effect mb-4 w-full">
                      Press me
                    </Button>
                    <div className="text-xs text-neutral-500">
                      Subtle scale effect when pressing buttons
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-md">
                    <h3 className="font-medium mb-2">Focus Animation</h3>
                    <div className="mb-4">
                      <input 
                        type="text" 
                        placeholder="Click or tab to focus" 
                        className="w-full px-3 py-2 border rounded-md field-focus-animation" 
                      />
                    </div>
                    <div className="text-xs text-neutral-500">
                      Clear MIT-branded focus states for accessibility
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-md">
                    <h3 className="font-medium mb-2">Success Effects</h3>
                    <div className="mb-4 p-3 bg-green-100 border border-green-300 rounded-md success-pulse text-center text-green-800">
                      Successfully Completed!
                    </div>
                    <div className="text-xs text-neutral-500">
                      Pulse effect for success confirmation
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-md">
                    <h3 className="font-medium mb-2">Error Shake</h3>
                    <Button 
                      variant="destructive" 
                      className="mb-4 w-full"
                      onClick={(e) => {
                        (e.target as HTMLElement).classList.add('error-shake');
                        setTimeout(() => {
                          (e.target as HTMLElement).classList.remove('error-shake');
                        }, 600);
                      }}
                    >
                      Click to shake
                    </Button>
                    <div className="text-xs text-neutral-500">
                      Shake effect for error indication
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-md">
                    <h3 className="font-medium mb-2">Loading States</h3>
                    <div className="flex items-center justify-center mb-4 p-4 bg-neutral-100 rounded-md shimmer">
                      <div className="h-6 w-32 bg-neutral-200 rounded"></div>
                    </div>
                    <div className="text-xs text-neutral-500">
                      Shimmer effect for content loading
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="toasts" className="space-y-8 slide-up" style={{animationDelay: "100ms"}}>
            <Card>
              <CardHeader>
                <CardTitle>Toast Notifications</CardTitle>
                <CardDescription>
                  Non-intrusive notifications provide immediate feedback for user actions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button 
                    onClick={() => showToast("default")} 
                    variant="outline"
                    className="press-effect"
                  >
                    Show Default Toast
                  </Button>
                  
                  <Button 
                    onClick={() => showToast("success")} 
                    variant="outline"
                    className="text-green-700 border-green-200 hover:bg-green-50 press-effect"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Show Success Toast
                  </Button>
                  
                  <Button 
                    onClick={() => showToast("error")} 
                    variant="outline"
                    className="text-red-700 border-red-200 hover:bg-red-50 press-effect"
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Show Error Toast
                  </Button>
                  
                  <Button 
                    onClick={() => showToast("info")} 
                    variant="outline"
                    className="text-blue-700 border-blue-200 hover:bg-blue-50 press-effect"
                  >
                    <Info className="mr-2 h-4 w-4" />
                    Show Info Toast
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        <Card className="mb-10 bg-blue-50 border-blue-200">
          <CardHeader className="pb-2">
            <div className="flex items-center">
              <Lightbulb className="h-5 w-5 text-blue-600 mr-2" />
              <CardTitle className="text-blue-800">UX Enhancement Tips</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-6 space-y-2 text-blue-700">
              <li>
                <strong>Immediate Feedback:</strong> Always provide immediate visual feedback for user actions
              </li>
              <li>
                <strong>Error Prevention:</strong> Use confirmation dialogs for destructive or irreversible actions
              </li>
              <li>
                <strong>Inline Validation:</strong> Validate form fields as users type or when they blur a field
              </li>
              <li>
                <strong>Focused Interactions:</strong> Use MIT-branded focus states for accessibility
              </li>
              <li>
                <strong>Informative Empty States:</strong> Provide clear guidance and actions in empty states
              </li>
              <li>
                <strong>Loading Indicators:</strong> Always show loading states for asynchronous operations
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}