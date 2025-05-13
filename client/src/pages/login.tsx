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
import { Loader2, LogIn, Check, User, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters long"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
});

type FormData = z.infer<typeof formSchema>;

export default function Login() {
  const { login, isLoading, isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  
  // Parse query string to get returnTo parameter if present
  const getReturnToPath = () => {
    const queryParams = new URLSearchParams(window.location.search);
    const returnTo = queryParams.get('returnTo');
    // Ensure returnTo is safe - only relative paths allowed
    if (returnTo && returnTo.startsWith('/') && !returnTo.includes('//')) {
      return returnTo;
    }
    return null;
  };
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      // Check if there's a returnTo parameter
      const returnTo = getReturnToPath();
      if (returnTo) {
        navigate(returnTo);
      } else {
        // Default redirect based on user role
        if (user.role === 'admin') {
          navigate(APP_ROUTES.ADMIN_DASHBOARD);
        } else if (user.role === 'instructor') {
          navigate(APP_ROUTES.INSTRUCTOR_DASHBOARD);
        } else {
          navigate(APP_ROUTES.DASHBOARD);
        }
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
    <div className="flex min-h-screen bg-gray-50">
      {/* Left side - login form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 py-12 lg:px-12">
        <div className="mx-auto w-full max-w-md slide-up">
          <div className="mb-8 fade-in" style={{animationDelay: "100ms"}}>
            <h1 className="text-3xl font-bold tracking-tight text-mit-red mb-2">
              AI Feedback Platform
            </h1>
            <p className="text-gray-600">
              Sign in to access the platform
            </p>
          </div>
          
          <Card className="border border-gray-200 shadow-sm overflow-hidden">
            <CardContent className="pt-6 fade-in" style={{animationDelay: "200ms"}}>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-800 font-medium">Username</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                              <User className="h-4 w-4" />
                            </div>
                            <Input 
                              placeholder="Enter your username" 
                              {...field} 
                              disabled={isLoading}
                              className="border-gray-300 focus-ring pl-10 transition-all duration-200 focus:border-mit-red focus:ring-mit-red/20"
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-600" />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-800 font-medium">Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                              <Lock className="h-4 w-4" />
                            </div>
                            <Input 
                              type="password" 
                              placeholder="Enter your password" 
                              {...field} 
                              disabled={isLoading}
                              className="border-gray-300 focus-ring pl-10 transition-all duration-200 focus:border-mit-red focus:ring-mit-red/20"
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-600" />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className={cn(
                      "w-full bg-mit-red hover:bg-mit-red/90 text-white border-0 mt-4 btn-hover-effect transition-all",
                      isLoading && "opacity-90"
                    )}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Logging in...
                      </>
                    ) : (
                      <>
                        <LogIn className="h-4 w-4 mr-2" />
                        Sign In
                      </>
                    )}
                  </Button>
                </form>
              </Form>
              
              <div className="mt-6">
                <Separator />
                
                <div className="mt-4 space-y-4">
                  {/* MIT Horizon Direct OIDC Button */}
                  <Button 
                    variant="outline" 
                    className="w-full border-2 border-mit-red hover:bg-mit-red/10"
                    onClick={() => {
                      // Add returnTo parameter if present in current URL
                      const returnTo = getReturnToPath();
                      const loginUrl = returnTo 
                        ? `/api/auth/horizon/login?returnTo=${encodeURIComponent(returnTo)}` 
                        : '/api/auth/horizon/login';
                      window.location.href = loginUrl;
                    }}
                  >
                    <img 
                      src="/mit_logo_micro_rgb_mit-red.png" 
                      alt="MIT Logo" 
                      className="h-5 w-auto mr-2" 
                    />
                    Log in with institutional account
                  </Button>
                  
                  {/* Auth0 SSO Button */}
                  <Button 
                    variant="outline" 
                    className="w-full border border-gray-200 hover:bg-gray-50"
                    onClick={() => {
                      // Add returnTo parameter if present in current URL
                      const returnTo = getReturnToPath();
                      const loginUrl = returnTo 
                        ? `/api/auth-sso/login?returnTo=${encodeURIComponent(returnTo)}` 
                        : '/api/auth-sso/login';
                      window.location.href = loginUrl;
                    }}
                  >
                    <svg 
                      className="h-5 w-5 mr-2" 
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M21.35 11.1H12.18V13.83H18.69C18.36 17.64 15.19 19.27 12.19 19.27C8.36 19.27 5.22 16.25 5.22 12.21C5.22 8.17 8.36 5.15 12.19 5.15C15.14 5.15 16.89 7.26 16.89 7.26L19.05 5.05C19.05 5.05 16.5 2.1 12.03 2.1C6.24 2.1 2 7.17 2 12.21C2 17.1 5.98 22.3 12.2 22.3C17.92 22.3 21.59 18.43 21.59 13.45C21.59 12.23 21.35 11.1 21.35 11.1Z" />
                    </svg>
                    Log in with SSO
                  </Button>
                </div>
                
                <p className="text-center text-sm text-gray-500 mt-4">
                  This is a secure login for authorized university personnel and students.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Right side - hero section */}
      <div className="hidden lg:block lg:w-1/2 bg-[#F2F4F8]">
        <div className="flex h-full items-center justify-center p-12">
          <div className="max-w-lg">
            <h2 className="text-3xl font-bold mb-6 text-gray-900">
              AI-Powered Assignment Feedback
            </h2>
            <p className="text-lg text-gray-700 mb-6">
              A comprehensive platform for universities to provide automated feedback
              for student assignments at scale, powered by Google's Gemini AI model.
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="rounded-full bg-mit-red/10 text-mit-red p-1 mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-gray-700">Instant AI-generated feedback for assignments</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="rounded-full bg-mit-red/10 text-mit-red p-1 mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-gray-700">Comprehensive analytics for instructors</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="rounded-full bg-mit-red/10 text-mit-red p-1 mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-gray-700">Scale to handle courses with tens of thousands of students</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
