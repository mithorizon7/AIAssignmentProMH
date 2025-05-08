import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { APP_ROUTES } from "@/lib/constants";
import { useAuth } from "@/lib/auth";
import {
  Bell,
  ChevronDown,
  Menu,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function MITNavbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();

  // Navigation links based on user role
  const getNavLinks = () => {
    if (!isAuthenticated || !user) {
      return [
        { href: "/", label: "Home" },
        { href: APP_ROUTES.LOGIN, label: "Login" },
      ];
    }

    if (user.role === "admin") {
      return [
        { href: APP_ROUTES.ADMIN_DASHBOARD, label: "Dashboard" },
        { href: APP_ROUTES.ADMIN_USERS, label: "Users" },
        { href: "/admin/system-config", label: "Settings" },
      ];
    }

    if (user.role === "instructor") {
      return [
        { href: APP_ROUTES.INSTRUCTOR_DASHBOARD, label: "Dashboard" },
        { href: APP_ROUTES.INSTRUCTOR_COURSES, label: "Courses" },
        { href: APP_ROUTES.INSTRUCTOR_CREATE_ASSIGNMENT, label: "Create Assignment" },
        { href: "/instructor/analytics", label: "Analytics" },
      ];
    }

    // Student
    return [
      { href: APP_ROUTES.DASHBOARD, label: "Dashboard" },
      { href: APP_ROUTES.ASSIGNMENTS, label: "Assignments" },
      { href: "/submissions", label: "My Submissions" },
    ];
  };

  const navLinks = getNavLinks();

  const handleLogout = async () => {
    await logout();
  };

  const getRootPath = () => {
    if (!isAuthenticated) return "/";
    if (user?.role === 'admin') return APP_ROUTES.ADMIN_DASHBOARD;
    if (user?.role === 'instructor') return APP_ROUTES.INSTRUCTOR_DASHBOARD;
    return APP_ROUTES.DASHBOARD;
  };

  return (
    <header className="bg-white border-b border-mit-silver-gray/20 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and main navigation */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <Link href={getRootPath()}>
                <span className="text-mit-red font-bold text-xl cursor-pointer">
                  AI Feedback <span className="text-black">Platform</span>
                </span>
              </Link>
            </div>
            
            {/* Desktop navigation */}
            <nav className="hidden md:ml-8 md:flex md:space-x-8">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <span className={`inline-flex items-center px-2 py-1 text-sm font-medium border-b-2 cursor-pointer ${
                    location === link.href 
                      ? "border-mit-red text-gray-900" 
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}>
                    {link.label}
                  </span>
                </Link>
              ))}
              
              {/* More dropdown placeholder (if needed) */}
              {isAuthenticated && (
                <div className="relative group">
                  <button className="inline-flex items-center px-2 py-1 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 group-hover:border-gray-300">
                    More
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </button>
                  <div className="hidden group-hover:block absolute left-0 mt-2 w-48 bg-white shadow-lg py-1 rounded-md z-10 animate-fade-in">
                    <Link href="/help">
                      <span className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">Help & Documentation</span>
                    </Link>
                    {user?.role === "instructor" && (
                      <Link href="/rubric-library">
                        <span className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">Rubric Library</span>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </nav>
          </div>
          
          {/* Search and user actions */}
          <div className="hidden md:flex md:items-center md:space-x-5">
            {/* Search */}
            {isAuthenticated && (
              <>
                {searchOpen ? (
                  <div className="animate-fade-in absolute inset-0 bg-white z-10 flex items-center px-8">
                    <input
                      type="text"
                      placeholder="Search assignments, courses..."
                      className="flex-1 h-10 px-3 bg-gray-100 rounded-md border-0 focus:ring-1 focus:ring-mit-red"
                      autoFocus
                    />
                    <button 
                      onClick={() => setSearchOpen(false)}
                      className="ml-2 p-2 text-gray-500 hover:text-gray-700"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setSearchOpen(true)}
                    className="p-1 text-gray-500 hover:text-gray-700"
                  >
                    <Search className="h-5 w-5" />
                  </button>
                )}
              
                {/* Notifications */}
                <button className="p-1 text-gray-500 hover:text-gray-700 relative">
                  <Bell className="h-5 w-5" />
                  <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-mit-red"></span>
                </button>
              </>
            )}
            
            {/* Login/Logout buttons */}
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="text-sm font-medium text-gray-800">
                  {user?.name}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="text-sm font-medium border border-mit-red text-mit-red hover:bg-mit-red hover:text-white transition-colors"
                >
                  Sign Out
                </Button>
              </div>
            ) : (
              <Button asChild className="bg-mit-red hover:bg-mit-red/90 text-white border-0">
                <Link href={APP_ROUTES.LOGIN}>
                  <span>Sign In</span>
                </Link>
              </Button>
            )}
          </div>
          
          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:text-mit-red hover:bg-gray-100"
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? (
                <X className="block h-6 w-6" />
              ) : (
                <Menu className="block h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden animate-slide-up">
          <div className="pt-2 pb-4 space-y-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <span
                  className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium cursor-pointer ${
                    location === link.href
                      ? "border-mit-red text-mit-red bg-accent/50"
                      : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </span>
              </Link>
            ))}
            
            {isAuthenticated ? (
              <button
                onClick={handleLogout}
                className="block w-full text-left pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-500 hover:text-gray-800 hover:border-gray-300 hover:bg-gray-50"
              >
                Sign Out
              </button>
            ) : (
              <Link href={APP_ROUTES.LOGIN}>
                <span
                  className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-500 hover:text-gray-800 hover:border-mit-red hover:bg-gray-50 cursor-pointer"
                  onClick={() => setIsOpen(false)}
                >
                  Sign In
                </span>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}