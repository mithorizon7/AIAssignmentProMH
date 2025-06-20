import { useAuth } from "@/lib/auth";
import { USER_ROLES, APP_ROUTES } from "@/lib/constants";
import { getUserInitials } from "@/lib/utils/format";
import { Link, useLocation } from "wouter";
import { Separator } from "@/components/ui/separator";
import { 
  LayoutDashboard, 
  FileText, 
  History, 
  Settings, 
  Users, 
  BarChart, 
  LogOut 
} from "lucide-react";

interface SidebarLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}

const SidebarLink = ({ href, icon, label, active }: SidebarLinkProps) => (
  <li>
    <Link href={href}>
      <a
        className={`flex items-center p-3 rounded-md transition-colors duration-150 ${
          active
            ? "text-primary bg-blue-50 hover:bg-blue-100 dark:bg-sidebar-primary dark:text-sidebar-primary-foreground hover:dark:bg-primary/90"
            : "text-neutral-700 hover:bg-neutral-100 dark:text-sidebar-foreground/80 dark:hover:bg-sidebar-accent dark:hover:text-sidebar-accent-foreground"
        }`}
      >
        <div className="mr-4 text-[#8a1a2c]" aria-hidden="true">{icon}</div>
        <span className="text-base font-medium">{label}</span>
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
    <aside className="hidden md:flex flex-col w-80 bg-white border-r border-neutral-200 dark:bg-sidebar dark:border-sidebar-border overflow-y-auto">
      <div className="p-5 border-b border-neutral-200 dark:border-sidebar-border">
        <div className="flex items-center">
          <img src="/AcademusLogo.webp" alt="Academus Logo" className="h-10 mr-3" />
          <div>
            <h1 className="text-xl font-medium text-primary">
              {user.role === 'admin' ? 'Admin Portal' : 
               user.role === 'instructor' ? 'Instructor Portal' : 
               'Student Portal'}
            </h1>
            <p className="text-sm text-neutral-600 dark:text-sidebar-foreground/70">AI Grader</p>
          </div>
        </div>
      </div>
      


      {/* Navigation Links - Student View */}
      {isStudent && (
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            <SidebarLink 
              href={APP_ROUTES.DASHBOARD} 
              icon={<LayoutDashboard size={24} />}
              label="Dashboard" 
              active={location === APP_ROUTES.DASHBOARD}
            />
            <SidebarLink 
              href={APP_ROUTES.ASSIGNMENTS} 
              icon={<FileText size={24} />}
              label="My Assignments" 
              active={location === APP_ROUTES.ASSIGNMENTS}
            />
            <SidebarLink 
              href={APP_ROUTES.SUBMISSION_HISTORY} 
              icon={<History size={24} />}
              label="Submission History" 
              active={location === APP_ROUTES.SUBMISSION_HISTORY}
            />
            <SidebarLink 
              href="/settings" 
              icon={<Settings size={24} />}
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
              icon={<LayoutDashboard size={24} />}
              label="Dashboard" 
              active={location === APP_ROUTES.INSTRUCTOR_DASHBOARD}
            />
            <SidebarLink 
              href="/instructor/students" 
              icon={<Users size={24} />}
              label="Students" 
              active={location === "/instructor/students"}
            />
            <SidebarLink 
              href="/instructor/assignments" 
              icon={<FileText size={24} />}
              label="Assignments" 
              active={location === "/instructor/assignments"}
            />
            <SidebarLink 
              href="/instructor/analytics" 
              icon={<BarChart size={24} />}
              label="Analytics" 
              active={location === "/instructor/analytics"}
            />
            <SidebarLink 
              href="/instructor/settings" 
              icon={<Settings size={24} />}
              label="Settings" 
              active={location === "/instructor/settings"}
            />
          </ul>
        </nav>
      )}
      
      <Separator className="dark:bg-sidebar-border" />
      <div className="p-4">
        {/* User Profile Section */}
        <div className="flex items-center mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
            {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div className="ml-3 min-w-0 flex-1">
            <p className="text-sm font-medium text-neutral-800 dark:text-sidebar-foreground truncate">
              {user.name}
            </p>
            <p className="text-xs text-neutral-500 dark:text-sidebar-foreground/70 truncate capitalize">
              {user.role}
            </p>
          </div>
        </div>

        {/* Logout Button */}
        <button 
          onClick={() => logout()} 
          className="flex items-center w-full text-neutral-700 hover:text-neutral-900 dark:text-sidebar-foreground/80 dark:hover:text-sidebar-foreground transition-colors duration-150"
        >
          <LogOut size={20} className="mr-2 text-mit-red" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
