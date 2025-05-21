import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { USER_ROLES } from "@/lib/constants";
import { InstructorShell } from "@/components/layout/instructor-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Calendar, Mail, MapPin, BookOpen, Smartphone, Clock, Briefcase } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfilePage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  
  // Redirect non-instructors away
  useEffect(() => {
    if (user?.role !== USER_ROLES.INSTRUCTOR && user?.role !== USER_ROLES.ADMIN) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // For demo purposes - would normally fetch this data from the API
  const instructorDetails = {
    bio: "Experienced instructor with a focus on computer science and programming. Passionate about teaching and helping students achieve their goals.",
    department: "Computer Science",
    location: "Cambridge, MA",
    phone: "+1 (555) 123-4567",
    officeHours: "Mon, Wed 3-5pm",
    employmentStatus: "Full-time",
    courses: [
      { id: 1, name: "Introduction to Programming", code: "CS101", students: 120 },
      { id: 2, name: "Data Structures", code: "CS201", students: 85 },
      { id: 3, name: "Algorithms", code: "CS301", students: 65 },
    ],
    stats: {
      totalStudents: 270,
      totalCourses: 3,
      totalAssignments: 42,
      avgFeedbackTime: "2.3 hours",
    }
  };

  return (
    <InstructorShell>
      <div className="space-y-8">
        {/* Profile Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
            <p className="text-muted-foreground">
              View and manage your instructor profile
            </p>
          </div>
          <Button 
            onClick={() => navigate("/instructor/settings")}
            className="mt-4 md:mt-0"
          >
            Edit Profile
          </Button>
        </div>
        
        {/* Profile Information */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Profile Summary Card */}
          <Card className="md:col-span-1">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-24 w-24 bg-white border border-gray-200">
                  <AvatarImage src="/AcademusLogo.webp" alt={user?.name || ""} />
                  <AvatarFallback className="bg-white p-2">
                    <img src="/AcademusLogo.webp" alt="Academus Logo" className="h-20 w-20" />
                  </AvatarFallback>
                </Avatar>
                
                <h2 className="mt-4 text-xl font-bold">{user?.name || "Instructor"}</h2>
                <p className="text-sm text-muted-foreground">
                  {instructorDetails.department}
                </p>
                
                <Badge className="mt-2" variant="outline">
                  {user?.role?.toUpperCase() || "INSTRUCTOR"}
                </Badge>
                
                <div className="mt-4 w-full space-y-2 text-sm">
                  <div className="flex items-center justify-start gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{user?.email || "email@example.com"}</span>
                  </div>
                  <div className="flex items-center justify-start gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{instructorDetails.location}</span>
                  </div>
                  <div className="flex items-center justify-start gap-2 text-muted-foreground">
                    <Smartphone className="h-4 w-4" />
                    <span>{instructorDetails.phone}</span>
                  </div>
                  <div className="flex items-center justify-start gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{instructorDetails.officeHours}</span>
                  </div>
                  <div className="flex items-center justify-start gap-2 text-muted-foreground">
                    <Briefcase className="h-4 w-4" />
                    <span>{instructorDetails.employmentStatus}</span>
                  </div>
                </div>
              </div>
              
              <Separator className="my-6" />
              
              <div className="space-y-4">
                <h3 className="font-medium">Bio</h3>
                <p className="text-sm text-muted-foreground">
                  {instructorDetails.bio}
                </p>
              </div>
            </CardContent>
          </Card>
          
          {/* Stats and Courses */}
          <div className="space-y-8 md:col-span-2">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Total Students</p>
                    {isLoading ? (
                      <Skeleton className="h-7 w-16" />
                    ) : (
                      <p className="text-2xl font-bold">{instructorDetails.stats.totalStudents}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Active Courses</p>
                    {isLoading ? (
                      <Skeleton className="h-7 w-16" />
                    ) : (
                      <p className="text-2xl font-bold">{instructorDetails.stats.totalCourses}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Total Assignments</p>
                    {isLoading ? (
                      <Skeleton className="h-7 w-16" />
                    ) : (
                      <p className="text-2xl font-bold">{instructorDetails.stats.totalAssignments}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Avg. Feedback Time</p>
                    {isLoading ? (
                      <Skeleton className="h-7 w-16" />
                    ) : (
                      <p className="text-2xl font-bold">{instructorDetails.stats.avgFeedbackTime}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Courses Card */}
            <Card>
              <CardHeader>
                <CardTitle>My Courses</CardTitle>
                <CardDescription>
                  Courses you're currently teaching
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : instructorDetails.courses.length > 0 ? (
                  <div className="space-y-4">
                    {instructorDetails.courses.map((course) => (
                      <div 
                        key={course.id} 
                        className="flex flex-col justify-between rounded-lg border p-4 md:flex-row md:items-center"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm font-medium">{course.code}</p>
                          </div>
                          <p className="font-medium">{course.name}</p>
                        </div>
                        <div className="mt-2 flex items-center gap-4 md:mt-0">
                          <div className="text-sm text-muted-foreground">
                            {course.students} students
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate(`/instructor/course/${course.id}`)}
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <BookOpen className="h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No courses yet</h3>
                    <p className="text-muted-foreground">
                      You haven't created any courses yet
                    </p>
                    <Button 
                      onClick={() => navigate("/instructor/courses")}
                      className="mt-4"
                    >
                      Create Course
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </InstructorShell>
  );
}