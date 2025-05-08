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
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and main navigation */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <Link href={getRootPath()}>
                <span className="font-bold text-xl cursor-pointer">
                  <span className="text-mit-red">MIT</span> <span className="text-gray-900">AI Feedback</span>
                </span>
              </Link>
            </div>
            
            {/* Desktop navigation */}
            <nav className="hidden md:ml-10 md:flex md:space-x-6">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <span className={`inline-flex items-center px-1 pt-1 pb-2 text-sm font-semibold border-b-2 cursor-pointer tracking-wide ${
                    location === link.href 
                      ? "border-mit-red text-gray-900" 
                      : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
                  }`}>
                    {link.label}
                  </span>
                </Link>
              ))}
              
              {/* More dropdown placeholder (if needed) */}
              {isAuthenticated && (
                <div className="relative group">
                  <button className="inline-flex items-center px-1 pt-1 pb-2 text-sm font-semibold border-b-2 border-transparent text-gray-600 hover:text-gray-900 group-hover:border-gray-300 tracking-wide">
                    More
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </button>
                  <div className="hidden group-hover:block absolute left-0 mt-1 w-48 bg-white shadow-lg py-2 rounded-md z-10 animate-fade-in border border-gray-100">
                    <Link href="/help">
                      <span className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">Help & Documentation</span>
                    </Link>
                    {user?.role === "instructor" && (
                      <Link href="/rubric-library">
                        <span className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">Rubric Library</span>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </nav>
          </div>
          
          {/* Search and user actions */}
          <div className="hidden md:flex md:items-center md:space-x-6">
            {/* Search */}
            {isAuthenticated && (
              <>
                {searchOpen ? (
                  <div className="animate-fade-in absolute inset-0 bg-white z-10 flex items-center px-8">
                    <input
                      type="text"
                      placeholder="Search assignments, courses..."
                      className="flex-1 h-10 px-3 bg-gray-50 rounded-md border border-gray-300 focus:ring-1 focus:ring-mit-red focus:border-mit-red"
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
                    className="p-1.5 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
                  >
                    <Search className="h-5 w-5" />
                  </button>
                )}
              
                {/* Notifications */}
                <button className="p-1.5 text-gray-500 hover:text-gray-700 relative rounded-md hover:bg-gray-100">
                  <Bell className="h-5 w-5" />
                  <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-mit-red"></span>
                </button>
              </>
            )}
            
            {/* Login/Logout buttons */}
            {isAuthenticated ? (
              <div className="flex items-center gap-4">
                <div className="text-sm font-medium text-gray-800">
                  {user?.name}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm"
                >
                  Sign Out
                </Button>
              </div>
            ) : (
              <Button asChild className="bg-mit-red hover:bg-mit-red/90 text-white border-0 shadow-sm">
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
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-mit-red hover:bg-gray-50"
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
        <div className="md:hidden overflow-hidden">
          <div className="max-h-[70vh] overflow-y-auto pb-4 animate-in slide-in-from-top duration-300 ease-in-out">
            <div className="border-t border-gray-200 pt-4 pb-3 px-4">
              {isAuthenticated && (
                <div className="flex items-center mb-3">
                  <div className="flex-shrink-0 bg-mit-red/10 text-mit-red rounded-full p-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <div className="text-base font-medium text-gray-800">{user?.name}</div>
                    <div className="text-sm font-medium text-gray-500">{user?.role}</div>
                  </div>
                </div>
              )}
              <div className="space-y-1">
                {navLinks.map((link) => (
                  <Link key={link.href} href={link.href}>
                    <div
                      className={`block px-4 py-2.5 rounded-md text-base font-medium cursor-pointer ${
                        location === link.href
                          ? "bg-gray-50 text-mit-red"
                          : "text-gray-700 hover:bg-gray-50 hover:text-mit-red"
                      }`}
                      onClick={() => setIsOpen(false)}
                    >
                      {link.label}
                    </div>
                  </Link>
                ))}
                
                {isAuthenticated && (
                  <>
                    <div className="border-t border-gray-200 my-3"></div>
                    <Link href="/help">
                      <div 
                        className="block px-4 py-2.5 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-mit-red cursor-pointer"
                        onClick={() => setIsOpen(false)}
                      >
                        Help & Documentation
                      </div>
                    </Link>
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-mit-red"
                    >
                      Sign Out
                    </button>
                  </>
                )}
                
                {!isAuthenticated && (
                  <Link href={APP_ROUTES.LOGIN}>
                    <div
                      className="mt-3 block px-4 py-2.5 rounded-md text-base font-medium bg-mit-red text-white hover:bg-mit-red/90 cursor-pointer text-center"
                      onClick={() => setIsOpen(false)}
                    >
                      Sign In
                    </div>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}