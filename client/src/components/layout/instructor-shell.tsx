import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { APP_ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  FileText,
  BarChart,
  LogOut,
  Menu,
  PlusCircle,
} from "lucide-react";

interface InstructorShellProps {
  children: React.ReactNode;
}

export function InstructorShell({ children }: InstructorShellProps) {
  const [location] = useLocation();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);

  const navItems = [
    {
      name: "Dashboard",
      href: APP_ROUTES.INSTRUCTOR_DASHBOARD,
      icon: <LayoutDashboard size={18} />,
    },
    {
      name: "Courses",
      href: "/instructor/courses",
      icon: <BookOpen size={18} />,
    },
    {
      name: "Assignments",
      href: "/instructor/assignments",
      icon: <FileText size={18} />,
    },
    {
      name: "Students",
      href: "/instructor/students",
      icon: <GraduationCap size={18} />,
    },
    {
      name: "Analytics",
      href: "/instructor/analytics",
      icon: <BarChart size={18} />,
    },
  ];

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Desktop sidebar */}
      <div className="hidden md:flex w-64 flex-col fixed inset-y-0">
        <div className="flex flex-col flex-grow border-r bg-primary-foreground pt-5 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4 mb-5">
            <div className="h-8 w-8 rounded-full bg-primary mr-3 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">Instructor Portal</span>
          </div>
          <div className="flex-grow flex flex-col">
            <nav className="flex-1 px-2 pb-4 space-y-1">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <a
                    className={cn(
                      "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      location === item.href
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <span className="mr-3">{item.icon}</span>
                    {item.name}
                  </a>
                </Link>
              ))}
            </nav>
          </div>
          <div className="px-2 pb-3">
            <Link href={APP_ROUTES.INSTRUCTOR_CREATE_ASSIGNMENT}>
              <Button className="w-full justify-start">
                <PlusCircle className="mr-2 h-4 w-4" />
                New Assignment
              </Button>
            </Link>
          </div>
          <div className="flex-shrink-0 flex border-t p-4">
            <Button
              variant="outline"
              onClick={handleLogout}
              className="w-full flex items-center justify-center"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Log out
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile sidebar */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild className="md:hidden absolute top-4 left-4 z-20">
          <Button variant="ghost" size="icon">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex flex-col h-full pt-5">
            <div className="flex items-center flex-shrink-0 px-4 mb-5">
              <div className="h-8 w-8 rounded-full bg-primary mr-3 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg">Instructor Portal</span>
            </div>
            <div className="flex-grow flex flex-col">
              <nav className="flex-1 px-2 pb-4 space-y-1">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <a
                      className={cn(
                        "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                        location === item.href
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-muted"
                      )}
                      onClick={() => setOpen(false)}
                    >
                      <span className="mr-3">{item.icon}</span>
                      {item.name}
                    </a>
                  </Link>
                ))}
              </nav>
            </div>
            <div className="px-2 pb-3">
              <Link href={APP_ROUTES.INSTRUCTOR_CREATE_ASSIGNMENT}>
                <Button
                  className="w-full justify-start"
                  onClick={() => setOpen(false)}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Assignment
                </Button>
              </Link>
            </div>
            <div className="flex-shrink-0 flex border-t p-4">
              <Button
                variant="outline"
                onClick={handleLogout}
                className="w-full flex items-center justify-center"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Log out
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex flex-col flex-1 md:pl-64">
        <main className="flex-1 pt-16 md:pt-8 px-4 sm:px-6 md:px-8 bg-background min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}