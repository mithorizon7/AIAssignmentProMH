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
  User,
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
    <header className="sticky top-0 z-50">
      {/* MIT-style top bar with the deep red background */}
      <div className="bg-mit-red text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link href={getRootPath()}>
                <span className="font-bold text-2xl cursor-pointer tracking-tight text-white">
                  MIT AI Feedback
                </span>
              </Link>
            </div>
            
            {/* Desktop navigation */}
            <div className="hidden md:flex md:space-x-8">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <span className={`inline-flex items-center px-3 py-4 text-base font-medium cursor-pointer text-white ${
                    location === link.href 
                      ? "bg-mit-red/80" 
                      : "hover:bg-mit-red/80"
                  }`}>
                    {link.label}
                  </span>
                </Link>
              ))}
              
              {isAuthenticated && (
                <div className="relative group">
                  <button className="inline-flex items-center px-3 py-4 text-base font-medium cursor-pointer text-white hover:bg-mit-red/80">
                    More
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </button>
                  <div className="hidden group-hover:block absolute right-0 mt-1 w-48 bg-white shadow-lg py-2 rounded-md z-10 animate-fade-in border border-gray-200">
                    <Link href="/help">
                      <span className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                        Help & Documentation
                      </span>
                    </Link>
                    {user?.role === "instructor" && (
                      <Link href="/rubric-library">
                        <span className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                          Rubric Library
                        </span>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* User info and actions (Desktop) */}
            <div className="hidden md:flex items-center space-x-4">
              {isAuthenticated && (
                <>
                  <button
                    onClick={() => setSearchOpen(!searchOpen)}
                    className="p-2 text-white hover:bg-mit-red/80 rounded-md"
                  >
                    <Search className="h-5 w-5" />
                  </button>
                  
                  <button className="p-2 text-white hover:bg-mit-red/80 rounded-md relative">
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-white"></span>
                  </button>
                  
                  <div className="text-sm font-medium text-white ml-1 mr-2">
                    {user?.name || 'User'}
                  </div>
                </>
              )}
              
              {isAuthenticated ? (
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="text-sm font-medium bg-white text-mit-red border-white hover:bg-white/90"
                >
                  Sign Out
                </Button>
              ) : (
                <Button 
                  asChild 
                  className="bg-white text-mit-red hover:bg-white/90 border-white"
                >
                  <Link href={APP_ROUTES.LOGIN}>
                    <span>Sign In</span>
                  </Link>
                </Button>
              )}
            </div>
            
            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-mit-red/80"
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
      </div>
      
      {/* Search bar overlay (when search is active) */}
      {searchOpen && (
        <div className="absolute inset-0 bg-white z-10 flex items-center px-8 py-4 shadow-md">
          <input
            type="text"
            placeholder="Search assignments, courses..."
            className="flex-1 h-12 px-4 bg-gray-50 rounded-md border border-gray-300 focus:ring-1 focus:ring-mit-red focus:border-mit-red"
            autoFocus
          />
          <button 
            onClick={() => setSearchOpen(false)}
            className="ml-4 p-2 text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
      
      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 shadow-md">
          <div className="pt-2 pb-3 space-y-1 px-2">
            {isAuthenticated && (
              <div className="flex items-center p-3 bg-gray-50 rounded-md mb-2">
                <div className="flex-shrink-0 bg-mit-red/10 text-mit-red rounded-full p-2">
                  <User className="h-5 w-5" />
                </div>
                <div className="ml-3">
                  <div className="text-base font-medium text-gray-800">{user?.name}</div>
                  <div className="text-sm font-medium text-gray-500">{user?.role}</div>
                </div>
              </div>
            )}
            
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
      )}
    </header>
  );
}