import { useAuth } from "@/lib/auth";
import { USER_ROLES, APP_ROUTES } from "@/lib/constants";
import { getUserInitials } from "@/lib/utils/format";
import { Link, useLocation } from "wouter";
import { Separator } from "@/components/ui/separator";

interface SidebarLinkProps {
  href: string;
  icon: string;
  label: string;
  active?: boolean;
}

const SidebarLink = ({ href, icon, label, active }: SidebarLinkProps) => (
  <li>
    <Link href={href}>
      <a
        className={`flex items-center p-2 rounded-md ${
          active
            ? "text-primary bg-blue-50 hover:bg-blue-100"
            : "text-neutral-700 hover:bg-neutral-100"
        }`}
      >
        <span className="material-icons mr-3">{icon}</span>
        <span>{label}</span>
      </a>
    </Link>
  </li>
);

export function Sidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user) return null;
  
  const isStudent = user.role === USER_ROLES.STUDENT;
  const isInstructor = user.role === USER_ROLES.INSTRUCTOR;
  
  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-neutral-200 overflow-y-auto">
      <div className="p-4 border-b border-neutral-200">
        <h1 className="text-xl font-medium text-primary">AI Assignment Feedback</h1>
        <p className="text-sm text-neutral-600">University Portal</p>
      </div>
      
      {/* User Profile Section */}
      <div className="p-4 border-b border-neutral-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center">
            <span>{getUserInitials(user.name)}</span>
          </div>
          <div>
            <p className="font-medium">{user.name}</p>
            <p className="text-sm text-neutral-600 capitalize">{user.role}</p>
          </div>
        </div>
      </div>

      {/* Navigation Links - Student View */}
      {isStudent && (
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            <SidebarLink 
              href={APP_ROUTES.DASHBOARD} 
              icon="dashboard" 
              label="Dashboard" 
              active={location === APP_ROUTES.DASHBOARD}
            />
            <SidebarLink 
              href={APP_ROUTES.ASSIGNMENTS} 
              icon="assignment" 
              label="My Assignments" 
              active={location === APP_ROUTES.ASSIGNMENTS}
            />
            <SidebarLink 
              href="/history" 
              icon="history" 
              label="Submission History" 
              active={location === "/history"}
            />
            <SidebarLink 
              href="/settings" 
              icon="settings" 
              label="Settings" 
              active={location === "/settings"}
            />
          </ul>
        </nav>
      )}
      
      {/* Navigation Links - Instructor View */}
      {isInstructor && (
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            <SidebarLink 
              href={APP_ROUTES.INSTRUCTOR_DASHBOARD} 
              icon="dashboard" 
              label="Dashboard" 
              active={location === APP_ROUTES.INSTRUCTOR_DASHBOARD}
            />
            <SidebarLink 
              href="/instructor/students" 
              icon="people" 
              label="Students" 
              active={location === "/instructor/students"}
            />
            <SidebarLink 
              href="/instructor/assignments" 
              icon="assignment" 
              label="Assignments" 
              active={location === "/instructor/assignments"}
            />
            <SidebarLink 
              href="/instructor/analytics" 
              icon="analytics" 
              label="Analytics" 
              active={location === "/instructor/analytics"}
            />
            <SidebarLink 
              href="/instructor/settings" 
              icon="settings" 
              label="Settings" 
              active={location === "/instructor/settings"}
            />
          </ul>
        </nav>
      )}
      
      <Separator />
      <div className="p-4">
        <button 
          onClick={() => logout()} 
          className="flex items-center text-neutral-700 hover:text-neutral-900"
        >
          <span className="material-icons mr-2">logout</span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
