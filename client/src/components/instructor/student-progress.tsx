import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { StudentProgress as StudentProgressType } from "@/lib/types";
import { Link } from "wouter";
import { APP_ROUTES } from "@/lib/constants";

interface StudentProgressProps {
  students: StudentProgressType[];
  loading?: boolean;
  totalStudents: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSearch: (query: string) => void;
  onFilterChange: (filter: string) => void;
}

export function StudentProgress({
  students,
  loading = false,
  totalStudents,
  currentPage,
  totalPages,
  onPageChange,
  onSearch,
  onFilterChange,
}: StudentProgressProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  const handleSearch = () => {
    onSearch(searchQuery);
  };
  
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'success';
      case 'not_submitted':
        return 'destructive';
      case 'needs_review':
        return 'warning';
      default:
        return 'outline';
    }
  };
  
  const getStatusBadgeText = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'Submitted';
      case 'not_submitted':
        return 'Not Submitted';
      case 'needs_review':
        return 'Needs Review';
      default:
        return status;
    }
  };
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Student Progress</CardTitle>
          <CardDescription>Loading student data...</CardDescription>
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
      <CardHeader>
        <CardTitle>Student Progress</CardTitle>
        <CardDescription>Showing student submission status and progress</CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-neutral-500">
              <span className="material-icons text-sm">search</span>
            </span>
            <Input
              type="text"
              className="pl-10 pr-4 py-2 w-full sm:w-64"
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          
          <div className="flex gap-2">
            <Select onValueChange={onFilterChange} defaultValue="all">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="not_submitted">Not Submitted</SelectItem>
                <SelectItem value="needs_review">Needs Review</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" size="icon" onClick={handleSearch}>
              <span className="material-icons text-neutral-600">filter_list</span>
            </Button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-neutral-50">
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Submission</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No students found.
                  </TableCell>
                </TableRow>
              ) : (
                students.map((student) => (
                  <TableRow 
                    key={student.id} 
                    className={`hover:bg-neutral-50 ${
                      student.status === 'needs_review' ? 'bg-amber-50' : ''
                    }`}
                  >
                    <TableCell>
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center">
                          <span>{student.name.split(' ').map(n => n[0]).join('').toUpperCase()}</span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-neutral-800">{student.name}</div>
                          <div className="text-xs text-neutral-500">{student.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(student.status)}>
                        {getStatusBadgeText(student.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-neutral-700">
                        {student.lastSubmission || '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-neutral-700">{student.attempts}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="link" 
                        className={`text-primary hover:text-primary-dark h-auto p-0 ${
                          student.status === 'not_submitted' 
                            ? 'text-neutral-400 cursor-not-allowed' 
                            : ''
                        }`}
                        disabled={student.status === 'not_submitted'}
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-neutral-700">
            Showing <span className="font-medium">{(currentPage - 1) * 10 + 1}</span> to{' '}
            <span className="font-medium">
              {Math.min(currentPage * 10, totalStudents)}
            </span>{' '}
            of <span className="font-medium">{totalStudents}</span> students
          </div>
          
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                />
              </PaginationItem>
              
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                const pageNum = currentPage <= 3 
                  ? i + 1 
                  : currentPage + i - 2;
                
                if (pageNum > totalPages) return null;
                
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      isActive={pageNum === currentPage}
                      onClick={() => onPageChange(pageNum)}
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              
              {totalPages > 5 && currentPage < totalPages - 2 && (
                <PaginationItem>
                  <span className="text-neutral-500">...</span>
                </PaginationItem>
              )}
              
              {totalPages > 5 && currentPage < totalPages - 2 && (
                <PaginationItem>
                  <PaginationLink onClick={() => onPageChange(totalPages)}>
                    {totalPages}
                  </PaginationLink>
                </PaginationItem>
              )}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </CardContent>
    </Card>
  );
}
