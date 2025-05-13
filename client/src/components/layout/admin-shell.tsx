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
  Users,
  Settings,
  FileText,
  LogOut,
  Menu,
  AlertCircle,
} from "lucide-react";

interface AdminShellProps {
  children: React.ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const [location] = useLocation();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);

  const navItems = [
    {
      name: "Dashboard",
      href: APP_ROUTES.ADMIN_DASHBOARD,
      icon: <LayoutDashboard size={18} />,
    },
    {
      name: "User Management",
      href: APP_ROUTES.ADMIN_USERS,
      icon: <Users size={18} />,
    },
    {
      name: "System Configuration",
      href: APP_ROUTES.ADMIN_SYSTEM_CONFIG,
      icon: <Settings size={18} />,
    },
    {
      name: "Logs & Monitoring",
      href: APP_ROUTES.ADMIN_LOGS,
      icon: <FileText size={18} />,
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
      <div className="hidden md:flex w-80 flex-col fixed inset-y-0 top-20">
        <div className="flex flex-col flex-grow border-r bg-primary-foreground pt-5 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4 mb-5">
            <div className="h-8 w-8 rounded-full bg-primary mr-3 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">Admin Panel</span>
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
        <SheetTrigger asChild className="md:hidden absolute top-24 left-4 z-20">
          <Button variant="ghost" size="icon">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 p-0 pt-20">
          <div className="flex flex-col h-full pt-5">
            <div className="flex items-center flex-shrink-0 px-4 mb-5">
              <div className="h-8 w-8 rounded-full bg-primary mr-3 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg">Admin Panel</span>
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
      <div className="flex flex-col flex-1 md:pl-80">
        <main className="flex-1 pt-24 md:pt-24 px-4 sm:px-6 md:px-8 bg-background min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}