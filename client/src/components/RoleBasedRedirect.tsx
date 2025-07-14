import { Redirect } from "wouter";
import { useAuth } from "@/lib/auth";
import { getDashboardPath, type UserRole } from "@/utils/route-utils";

/**
 * Component that handles role-based redirects for the root route
 * Centralized redirect logic to eliminate duplication
 */
export function RoleBasedRedirect() {
  const { isAuthenticated, user } = useAuth();
  
  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  
  // Redirect to appropriate dashboard based on user role
  if (user?.role) {
    const dashboardPath = getDashboardPath(user.role as UserRole);
    return <Redirect to={dashboardPath} />;
  }
  
  // Fallback to student dashboard if role is undefined
  return <Redirect to="/dashboard" />;
}