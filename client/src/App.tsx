import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Assignments from "@/pages/assignments";
import SubmissionDetail from "@/pages/submission-detail";
import InstructorDashboard from "@/pages/instructor/dashboard";
import AssignmentDetail from "@/pages/instructor/assignment-detail";
import CreateAssignment from "@/pages/instructor/create-assignment";
import SubmitAssignment from "@/pages/submit";
import { AuthProvider, useAuth } from "./lib/auth";

function PrivateRoute({ component: Component, requireRole, ...rest }: any) {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  
  if (requireRole && user?.role !== requireRole) {
    return <Redirect to="/dashboard" />;
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
      
      {/* Public submission route via shareable link */}
      <Route path="/submit/:code">
        {(params) => <SubmitAssignment code={params.code} />}
      </Route>
      
      {/* Redirect root to dashboard or login */}
      <Route path="/">
        {() => {
          const { isAuthenticated } = useAuth();
          return isAuthenticated ? <Redirect to="/dashboard" /> : <Redirect to="/login" />;
        }}
      </Route>
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
