import React from "react";
import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  BookOpen,
  BookPlus,
  Users,
  LogOut,
  Menu,
  X,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { API_ROUTES } from "@/lib/constants";
import { useIsMobile } from "@/hooks/use-mobile";

interface InstructorShellProps {
  children: React.ReactNode;
}

export function InstructorShell({ children }: InstructorShellProps) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [showSidebar, setShowSidebar] = React.useState(false);

  const handleLogout = async () => {
    try {
      await apiRequest("POST", API_ROUTES.LOGOUT);
      window.location.href = "/login";
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Logout failed",
        description: "Failed to log out. Please try again.",
      });
    }
  };

  const navigationItems = [
    {
      name: "Dashboard",
      href: "/instructor/dashboard",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      name: "Courses",
      href: "/instructor/courses",
      icon: <BookOpen className="h-5 w-5" />,
    },
    {
      name: "Create Assignment",
      href: "/instructor/create-assignment",
      icon: <BookPlus className="h-5 w-5" />,
    },
    {
      name: "Students",
      href: "/instructor/students",
      icon: <Users className="h-5 w-5" />,
    },
  ];

  const NavLinks = () => (
    <nav className="grid items-start px-2 text-sm font-medium">
      {navigationItems.map((item) => {
        const isActive = location === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary ${
              isActive
                ? "bg-muted font-semibold text-primary"
                : "text-muted-foreground"
            }`}
          >
            {item.icon}
            {item.name}
          </Link>
        );
      })}
    </nav>
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header for mobile */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6 lg:hidden">
        <Sheet open={showSidebar} onOpenChange={setShowSidebar}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 sm:max-w-none">
            <div className="flex h-full flex-col">
              <div className="flex items-center gap-2 border-b p-4">
                <SheetClose asChild>
                  <Button variant="ghost" size="icon">
                    <X className="h-5 w-5" />
                  </Button>
                </SheetClose>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-6 w-6 text-primary" />
                  <span className="text-lg font-semibold">AI Feedback</span>
                </div>
              </div>
              <div className="flex-1 overflow-auto py-4">
                <NavLinks />
              </div>
              <div className="border-t p-4">
                <div className="flex items-center gap-4 pb-4">
                  <Avatar>
                    <AvatarFallback>
                      {user?.name
                        ? user.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                        : user?.username?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {user?.name || user?.username}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {user?.email}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        <div className="flex flex-1 items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">AI Feedback</span>
          </div>
          <div className="flex items-center gap-4">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {user?.name
                  ? user.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                  : user?.username?.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar for desktop */}
        <aside className="hidden w-64 flex-col border-r bg-background lg:flex">
          <div className="flex h-16 items-center gap-2 border-b px-6">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">AI Feedback</span>
          </div>
          <div className="flex-1 overflow-auto py-6">
            <NavLinks />
          </div>
          <div className="border-t p-6">
            <div className="flex items-center gap-4 pb-4">
              <Avatar>
                <AvatarFallback>
                  {user?.name
                    ? user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                    : user?.username?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {user?.name || user?.username}
                </span>
                <span className="text-xs text-muted-foreground">
                  {user?.email}
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}