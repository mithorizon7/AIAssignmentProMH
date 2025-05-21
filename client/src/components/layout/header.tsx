import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";
import { getUserInitials } from "@/lib/utils/format";
import { Menu, Bell, HelpCircle, Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/ui/theme-provider";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { APP_ROUTES } from "@/lib/constants";

export function Header() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  if (!user) return null;

  const getRootPath = () => {
    if (user.role === 'admin') return APP_ROUTES.ADMIN_DASHBOARD;
    if (user.role === 'instructor') return APP_ROUTES.INSTRUCTOR_DASHBOARD;
    return APP_ROUTES.DASHBOARD;
  };

  return (
    <header className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 py-2 px-4 flex items-center justify-between">
      <div className="flex items-center">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <button className="md:hidden mr-2 text-neutral-700 dark:text-neutral-300 p-1">
              <Menu size={24} />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-80 bg-white dark:bg-neutral-900">
            <Sidebar />
          </SheetContent>
        </Sheet>
        
        <Link href={getRootPath()} className="flex items-center">
          <img src="/AcademusLogo.webp" alt="Academus Logo" className="h-8 mr-2" />
          <span className="text-lg font-medium text-primary hidden sm:block">Academus</span>
        </Link>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme"
          className="text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </Button>
        <button className="p-2 rounded-full text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Notifications">
          <Bell size={20} />
        </button>
        <button className="p-2 rounded-full text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Help">
          <HelpCircle size={20} />
        </button>
        <div className="md:hidden flex items-center">
          <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center">
            <span>{getUserInitials(user.name)}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
