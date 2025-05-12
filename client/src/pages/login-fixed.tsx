import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { APP_ROUTES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";

const formSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters long"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
});

type FormData = z.infer<typeof formSchema>;

export default function Login() {
  const { login, isLoading, isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      // Redirect based on user role
      if (user.role === 'admin') {
        navigate(APP_ROUTES.ADMIN_DASHBOARD);
      } else if (user.role === 'instructor') {
        navigate(APP_ROUTES.INSTRUCTOR_DASHBOARD);
      } else {
        navigate(APP_ROUTES.DASHBOARD);
      }
    }
  }, [isAuthenticated, user, navigate]);
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });
  
  const onSubmit = async (data: FormData) => {
    try {
      await login(data.username, data.password);
    } catch (error) {
      // Error is handled in the auth hook
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold text-primary">AI Assignment Feedback</CardTitle>
          <CardDescription>
            Enter your credentials to access the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter your username" 
                        {...field} 
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Enter your password" 
                        {...field} 
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin mr-2">⟳</div>
                    Logging in...
                  </>
                ) : 'Sign In'}
              </Button>
            </form>
          </Form>
          
          <div className="mt-4">
            <Separator className="my-4" />
            
            <div className="text-center mb-4">
              <p className="text-sm text-neutral-500 mb-2">Or sign in with</p>
              <Button 
                variant="outline" 
                className="w-full border-2 border-mit-red hover:bg-mit-red/10"
                onClick={() => window.location.href = '/api/auth-sso/login'}
              >
                <svg 
                  className="h-5 w-5 mr-2" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 512 512"
                >
                  <rect width="512" height="512" fill="#A31F34" rx="15%"/>
                  <path fill="#fff" d="M157 291v-70h-35v-28h106v28h-36v70h-35m24-119V76h32l18 66 17-66h33v96h-30v-69l-19 69h-21l-18-69v69h-12"/>
                </svg>
                Sign in with MIT Horizon
              </Button>
            </div>
            
            <p className="text-center text-sm text-neutral-500 mt-4">
              This is a secure login for authorized university personnel and students.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}