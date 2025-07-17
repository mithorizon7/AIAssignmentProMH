import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/format";
import { Assignment } from "@/lib/types";
import { Link } from "wouter";
import { APP_ROUTES } from "@/lib/constants";
import { useState } from "react";
import { Tabs, TabsList, TabsContent, TabsTrigger } from "@/components/ui/tabs";

interface AssignmentWithStats extends Assignment {
  submittedCount: number;
  totalStudents: number;
  submissionPercentage: number;
}

interface AssignmentTableProps {
  assignments: AssignmentWithStats[];
  loading?: boolean;
  onExportCsv?: (assignmentId: number) => void;
}

export function AssignmentTable({ assignments, loading = false, onExportCsv }: AssignmentTableProps) {
  const [activeTab, setActiveTab] = useState('active');
  
  const filteredAssignments = assignments.filter(assignment => {
    if (activeTab === 'active') return assignment.status === 'active';
    if (activeTab === 'past') return assignment.status === 'completed';
    if (activeTab === 'draft') return assignment.status === 'upcoming';
    return true;
  });
  
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'completed':
        return 'secondary';
      case 'upcoming':
        return 'outline';
      default:
        return 'outline';
    }
  };
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
          <CardDescription>Loading assignments...</CardDescription>
        </CardHeader>
        <CardContent className="h-60 flex items-center justify-center">
          <div className="animate-spin">
            <span className="material-icons text-4xl text-primary">refresh</span>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-0">
        <Tabs defaultValue="active" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="border-b border-neutral-200 pb-0">
            <TabsTrigger value="active">Active Assignments</TabsTrigger>
            <TabsTrigger value="past">Past Assignments</TabsTrigger>
            <TabsTrigger value="draft">Draft Assignments</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-neutral-50">
              <TableRow>
                <TableHead>Assignment</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Submissions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No assignments found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAssignments.map((assignment) => (
                  <TableRow key={assignment.id} className="hover:bg-neutral-50">
                    <TableCell>
                      <div className="text-sm font-medium text-neutral-800">{assignment.title}</div>
                      <div className="text-xs text-neutral-500">{assignment.description}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-neutral-700">{assignment.course.code}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-neutral-700">{formatDate(assignment.dueDate)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-neutral-700">
                        {assignment.submittedCount}/{assignment.totalStudents} students
                      </div>
                      <Progress 
                        value={assignment.submissionPercentage} 
                        className="h-1.5 mt-1"
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(assignment.status)}>
                        {assignment.status === 'active' ? 'Active' : 
                         assignment.status === 'completed' ? 'Completed' : 
                         'Upcoming'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={APP_ROUTES.INSTRUCTOR_ASSIGNMENT(assignment.id)}>
                        <Button variant="link" className="text-primary hover:text-primary-dark h-auto p-0">
                          View Details
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      
      <CardFooter className="p-4 border-t border-neutral-200 flex justify-end">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => onExportCsv && onExportCsv(filteredAssignments[0]?.id)}
          disabled={filteredAssignments.length === 0}
          className="text-primary border-primary"
        >
          <span className="material-icons text-sm mr-2">file_download</span>
          Export Grades (CSV)
        </Button>
      </CardFooter>
    </Card>
  );
}
