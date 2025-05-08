import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MITNavbar } from "@/components/layout/mit-navbar";
import { MITFooter } from "@/components/layout/mit-footer";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login-fixed";
import Dashboard from "@/pages/dashboard";
import Assignments from "@/pages/assignments";
import SubmissionDetail from "@/pages/submission-detail";
import InstructorDashboard from "@/pages/instructor/dashboard";
import AssignmentDetail from "@/pages/instructor/assignment-detail";
import CreateAssignment from "@/pages/instructor/create-assignment";
import CoursesPage from "@/pages/instructor/courses";
import CourseDetailPage from "@/pages/instructor/course-detail";
import CourseStudentsPage from "@/pages/instructor/course-students";
import SubmitAssignment from "@/pages/submit";
import AdminDashboard from "@/pages/admin/dashboard";
import UsersPage from "@/pages/admin/users";
import SystemConfigPage from "@/pages/admin/system-config";
import LogsPage from "@/pages/admin/logs";
import { AuthProvider, useAuth } from "./lib/auth";

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

function App() {
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

export default App;
