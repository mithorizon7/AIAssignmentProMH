import { ReactNode, useState } from "react";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  BarChart,
  Settings,
  Menu,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { APP_ROUTES } from "@/lib/constants";

interface NavLinkProps {
  href: string;
  icon: ReactNode;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
}

function NavLink({ href, icon, label, isActive, onClick }: NavLinkProps) {
  const [, navigate] = useLocation();
  
  const handleClick = () => {
    navigate(href);
    if (onClick) onClick();
  };
  
  return (
    <Button
      variant={isActive ? "secondary" : "ghost"}
      className="w-full justify-start"
      onClick={handleClick}
    >
      <span className="mr-2">{icon}</span>
      {label}
    </Button>
  );
}

function NavLinks({ closeMenu }: { closeMenu?: () => void }) {
  const [location] = useLocation();
  
  const navItems = [
    {
      href: APP_ROUTES.INSTRUCTOR_DASHBOARD,
      label: "Dashboard",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      href: APP_ROUTES.INSTRUCTOR_COURSES,
      label: "Courses",
      icon: <BookOpen className="h-4 w-4" />,
    },
    {
      href: "/instructor/students",
      label: "Students",
      icon: <GraduationCap className="h-4 w-4" />,
    },
    {
      href: "/instructor/analytics",
      label: "Analytics",
      icon: <BarChart className="h-4 w-4" />,
    },
    {
      href: "/instructor/settings",
      label: "Settings",
      icon: <Settings className="h-4 w-4" />,
    },
  ];
  
  return (
    <div className="space-y-1">
      {navItems.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          icon={item.icon}
          label={item.label}
          isActive={location === item.href || location.startsWith(`${item.href}/`)}
          onClick={closeMenu}
        />
      ))}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  
  const userInitials = user?.username 
    ? user.username.substring(0, 2).toUpperCase()
    : "??";
  
  const handleLogout = async () => {
    await logout();
    navigate(APP_ROUTES.LOGIN);
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-full justify-start gap-2 px-2 text-base">
          <Avatar className="h-8 w-8">
            <AvatarImage src="" alt={user?.username || ""} />
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium">{user?.username || "Instructor"}</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
            <span className="text-xs text-muted-foreground capitalize">{user?.role || "instructor"}</span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start" forceMount>
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{user?.username || "Instructor"}</p>
            <p className="text-xs text-muted-foreground">{user?.email || ""}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/instructor/profile")}>
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/instructor/settings")}>
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileNav() {
  const [open, setOpen] = useState(false);
  
  return (
    <div className="flex h-16 items-center border-b bg-background px-4">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-80 flex-col p-0">
          <div className="p-4">
            <UserMenu />
          </div>
          <Separator />
          <div className="p-4">
            <NavLinks closeMenu={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
      <div className="ml-4 text-xl font-semibold">Instructor Dashboard</div>
    </div>
  );
}

export function InstructorShell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  
  return (
    <div className="flex min-h-screen flex-col">
      {isMobile ? (
        <MobileNav />
      ) : (
        <div className="flex flex-1">
          <aside className="fixed inset-y-0 left-0 z-20 hidden w-80 flex-col border-r bg-background md:flex">
            <div className="p-6 text-xl font-semibold">Instructor Dashboard</div>
            <Separator />
            <div className="flex-1 overflow-auto p-4">
              <NavLinks />
            </div>
            <Separator />
            <div className="p-4">
              <UserMenu />
            </div>
          </aside>
          <main className="flex-1 md:pl-80">
            <div className="container mx-auto p-6">{children}</div>
          </main>
        </div>
      )}
      {isMobile && (
        <main className="flex-1">
          <div className="container mx-auto p-4">{children}</div>
        </main>
      )}
    </div>
  );
}