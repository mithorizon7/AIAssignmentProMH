import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MITNavbar } from "@/components/layout/mit-navbar";
import { MITFooter } from "@/components/layout/mit-footer";
import GlobalErrorBoundary from "@/components/layout/global-error-boundary";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Assignments from "@/pages/assignments";
import SubmissionDetail from "@/pages/submission-detail";
import SubmissionHistory from "@/pages/submission-history";
import InstructorDashboard from "@/pages/instructor/dashboard";
import AssignmentDetail from "@/pages/instructor/assignment-detail";
import CreateAssignment from "@/pages/instructor/create-assignment";
import EnhancedCreateAssignment from "@/pages/instructor/enhanced-create-assignment";
import CoursesPage from "@/pages/instructor/courses";
import CourseDetailPage from "@/pages/instructor/course-detail";
import CourseStudentsPage from "@/pages/instructor/course-students";
import StudentsPage from "@/pages/instructor/students";
import AnalyticsPage from "@/pages/instructor/analytics";
import SettingsPage from "@/pages/instructor/settings";
import ProfilePage from "@/pages/instructor/profile";
import SubmitAssignment from "@/pages/submit";
import AdminDashboard from "@/pages/admin/dashboard";
import UsersPage from "@/pages/admin/users";
import SystemConfigPage from "@/pages/admin/system-config";
import SystemStatusPage from "@/pages/admin/system-status";
import LogsPage from "@/pages/admin/logs";
import UXExamples from "@/pages/ux-examples";
import { AuthProvider, useAuth } from "./lib/auth";

interface PrivateRouteProps {
  component: React.ComponentType<any>; // Using any here is unavoidable due to varying component props
  requireRole?: 'student' | 'instructor' | 'admin';
  id?: string | number;
  code?: string;
  [key: string]: unknown;
}

function PrivateRoute({ component: Component, requireRole, ...rest }: PrivateRouteProps) {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  
  if (requireRole) {
    // Admin can access all routes
    if (user?.role === "admin") {
      return <Component {...rest} />;
    }
    
    // Strict role-based access control - each role can only access their own routes
    if (user?.role !== requireRole) {
      // Redirect to appropriate dashboard based on user role
      if (user?.role === 'admin') {
        return <Redirect to="/admin/dashboard" />;
      }
      if (user?.role === 'instructor') {
        return <Redirect to="/instructor/dashboard" />;
      }
      // Default redirect for students or other roles
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
        {() => <PrivateRoute component={Dashboard} requireRole="student" />}
      </Route>
      <Route path="/assignments">
        {() => <PrivateRoute component={Assignments} requireRole="student" />}
      </Route>
      <Route path="/submission/:id">
        {(params) => <PrivateRoute component={SubmissionDetail} requireRole="student" id={params.id} />}
      </Route>
      <Route path="/history">
        {() => <PrivateRoute component={SubmissionHistory} requireRole="student" />}
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
      <Route path="/instructor/enhanced-create-assignment">
        {() => <PrivateRoute component={EnhancedCreateAssignment} requireRole="instructor" />}
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
      <Route path="/admin/system-status">
        {() => <PrivateRoute component={SystemStatusPage} requireRole="admin" />}
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
      
      {/* UX Examples route */}
      <Route path="/ux-examples" component={UXExamples} />
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Function to log errors if needed. GlobalErrorBoundary will handle logging by default.
  
  // Auth0 logout redirect is handled in AuthProvider
  
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <div className="flex flex-col min-h-screen">
            <MITNavbar />
            <main className="flex-grow">
              <Toaster />
              <GlobalErrorBoundary>
                <Router />
              </GlobalErrorBoundary>
            </main>
            <MITFooter />
          </div>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
