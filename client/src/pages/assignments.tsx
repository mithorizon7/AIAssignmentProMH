import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { API_ROUTES } from "@/lib/constants";
import { AssignmentWithSubmissions } from "@/lib/types";
import { AppShell } from "@/components/layout/app-shell";
import { AssignmentCard } from "@/components/student/assignment-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Assignments() {
  const { user } = useAuth();
  
  const { data: assignments, isLoading } = useQuery<AssignmentWithSubmissions[]>({
    queryKey: [API_ROUTES.ASSIGNMENTS],
  });
  
  const activeAssignments = assignments?.filter(a => a.status === 'active') || [];
  const pastAssignments = assignments?.filter(a => a.status === 'completed') || [];
  const upcomingAssignments = assignments?.filter(a => a.status === 'upcoming') || [];
  
  const renderAssignmentGrid = (items: AssignmentWithSubmissions[]) => {
    if (items.length === 0) {
      return (
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-8 text-center">
          <span className="material-icons text-4xl text-neutral-400 mb-2">assignment</span>
          <h3 className="text-lg font-medium text-neutral-700 mb-1">No assignments found</h3>
          <p className="text-neutral-600">There are no assignments in this category</p>
        </div>
      );
    }
    
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {items.map((assignment) => (
          <AssignmentCard
            key={assignment.id}
            assignment={assignment}
            latestSubmission={assignment.submissions?.[0]}
          />
        ))}
      </div>
    );
  };
  
  if (!user) return null;
  
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-neutral-800">My Assignments</h1>
          <p className="text-neutral-600">Submit assignments and receive AI-powered feedback</p>
        </div>
        
        <Tabs defaultValue="active">
          <TabsList className="mb-6">
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>
          
          <TabsContent value="active">
            {isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-48 rounded-lg" />
                ))}
              </div>
            ) : (
              renderAssignmentGrid(activeAssignments)
            )}
          </TabsContent>
          
          <TabsContent value="upcoming">
            {isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-48 rounded-lg" />
                ))}
              </div>
            ) : (
              renderAssignmentGrid(upcomingAssignments)
            )}
          </TabsContent>
          
          <TabsContent value="past">
            {isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-48 rounded-lg" />
                ))}
              </div>
            ) : (
              renderAssignmentGrid(pastAssignments)
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
