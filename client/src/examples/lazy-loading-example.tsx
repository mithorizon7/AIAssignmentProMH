// Example of how to implement code splitting with lazy loading
// This is a reference implementation, not meant to replace App.tsx directly

import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MITNavbar } from "@/components/layout/mit-navbar";
import { MITFooter } from "@/components/layout/mit-footer";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { lazyLoad, preloadComponent } from "@/lib/lazy-load";
import { AuthProvider, useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";

// Eagerly loaded components (used on initial render)
import NotFound from "@/pages/not-found";
import Login from "@/pages/login-fixed";

// Lazily loaded components (code split by route)
const Dashboard = lazyLoad(() => import("@/pages/dashboard"));
const Assignments = lazyLoad(() => import("@/pages/assignments"));
const SubmissionDetail = lazyLoad(() => import("@/pages/submission-detail"));
const SubmitAssignment = lazyLoad(() => import("@/pages/submit"));

// Instructor pages group
const InstructorDashboard = lazyLoad(() => import("@/pages/instructor/dashboard"));
const AssignmentDetail = lazyLoad(() => import("@/pages/instructor/assignment-detail"));
const CreateAssignment = lazyLoad(() => import("@/pages/instructor/create-assignment"));
const CoursesPage = lazyLoad(() => import("@/pages/instructor/courses"));
const CourseDetailPage = lazyLoad(() => import("@/pages/instructor/course-detail"));
const CourseStudentsPage = lazyLoad(() => import("@/pages/instructor/course-students"));
const StudentsPage = lazyLoad(() => import("@/pages/instructor/students"));
const AnalyticsPage = lazyLoad(() => import("@/pages/instructor/analytics"));
const SettingsPage = lazyLoad(() => import("@/pages/instructor/settings"));
const ProfilePage = lazyLoad(() => import("@/pages/instructor/profile"));

// Admin pages group
const AdminDashboard = lazyLoad(() => import("@/pages/admin/dashboard"));
const UsersPage = lazyLoad(() => import("@/pages/admin/users"));
const SystemConfigPage = lazyLoad(() => import("@/pages/admin/system-config"));
const LogsPage = lazyLoad(() => import("@/pages/admin/logs"));

// Preload common routes on idle
if ('requestIdleCallback' in window) {
  window.requestIdleCallback(() => {
    preloadComponent(() => import("@/pages/dashboard"));
    preloadComponent(() => import("@/pages/instructor/dashboard"));
    preloadComponent(() => import("@/pages/admin/dashboard"));
  });
}

function PrivateRoute({ component: Component, requireRole, ...rest }: any) {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  
  if (requireRole) {
    // Admin can access all routes
    if (user?.role === "admin") {
      return <Component {...rest} />;
    }
    
    // Instructors can access instructor and student routes
    if (requireRole === "student" && user?.role === "instructor") {
      return <Component {...rest} />;
    }
    
    // Check exact role match for other cases
    if (user?.role !== requireRole) {
      return <Redirect to="/dashboard" />;
    }
  }
  
  return <Component {...rest} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      {/* Student Routes */}
      <Route path="/dashboard">
        {() => <PrivateRoute component={Dashboard} />}
      </Route>
      <Route path="/assignments">
        {() => <PrivateRoute component={Assignments} />}
      </Route>
      <Route path="/submission/:id">
        {(params) => <PrivateRoute component={SubmissionDetail} id={params.id} />}
      </Route>
      
      {/* Instructor Routes */}
      <Route path="/instructor/dashboard">
        {() => <PrivateRoute component={InstructorDashboard} requireRole="instructor" />}
      </Route>
      <Route path="/instructor/assignment/:id">
        {(params) => <PrivateRoute component={AssignmentDetail} requireRole="instructor" id={params.id} />}
      </Route>
      <Route path="/instructor/create-assignment">
        {() => <PrivateRoute component={CreateAssignment} requireRole="instructor" />}
      </Route>
      <Route path="/instructor/courses">
        {() => <PrivateRoute component={CoursesPage} requireRole="instructor" />}
      </Route>
      <Route path="/instructor/course/:id">
        {(params) => <PrivateRoute component={CourseDetailPage} requireRole="instructor" id={params.id} />}
      </Route>
      <Route path="/instructor/course/:id/students">
        {(params) => <PrivateRoute component={CourseStudentsPage} requireRole="instructor" id={params.id} />}
      </Route>
      <Route path="/instructor/students">
        {() => <PrivateRoute component={StudentsPage} requireRole="instructor" />}
      </Route>
      <Route path="/instructor/analytics">
        {() => <PrivateRoute component={AnalyticsPage} requireRole="instructor" />}
      </Route>
      <Route path="/instructor/settings">
        {() => <PrivateRoute component={SettingsPage} requireRole="instructor" />}
      </Route>
      <Route path="/instructor/profile">
        {() => <PrivateRoute component={ProfilePage} requireRole="instructor" />}
      </Route>
      
      {/* Admin Routes */}
      <Route path="/admin/dashboard">
        {() => <PrivateRoute component={AdminDashboard} requireRole="admin" />}
      </Route>
      <Route path="/admin/users">
        {() => <PrivateRoute component={UsersPage} requireRole="admin" />}
      </Route>
      <Route path="/admin/system-config">
        {() => <PrivateRoute component={SystemConfigPage} requireRole="admin" />}
      </Route>
      <Route path="/admin/logs">
        {() => <PrivateRoute component={LogsPage} requireRole="admin" />}
      </Route>
      
      {/* Public submission route via shareable link */}
      <Route path="/submit/:code">
        {(params) => <SubmitAssignment code={params.code} />}
      </Route>
      
      {/* Redirect root to dashboard or login */}
      <Route path="/">
        {() => {
          const { isAuthenticated, user } = useAuth();
          
          if (!isAuthenticated) {
            return <Redirect to="/login" />;
          }
          
          // Redirect based on user role
          if (user?.role === "admin") {
            return <Redirect to="/admin/dashboard" />;
          } else if (user?.role === "instructor") {
            return <Redirect to="/instructor/dashboard" />;
          } else {
            return <Redirect to="/dashboard" />;
          }
        }}
      </Route>
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function OptimizedApp() {
  // Function to log errors to monitoring service
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // In production, you would send this to an error monitoring service
    console.error('Error caught by error boundary:', error, errorInfo);
  };
  
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <div className="flex flex-col min-h-screen">
            <MITNavbar />
            <main className="flex-grow">
              <Toaster />
              <ErrorBoundary onError={handleError}>
                <Router />
              </ErrorBoundary>
            </main>
            <MITFooter />
          </div>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default OptimizedApp;