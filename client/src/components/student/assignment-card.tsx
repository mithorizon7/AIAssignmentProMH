import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Assignment, Submission } from "@/lib/types";
import { formatDate, formatTimeRemaining } from "@/lib/utils/format";
import { Link } from "wouter";
import { APP_ROUTES } from "@/lib/constants";

interface AssignmentCardProps {
  assignment: Assignment;
  latestSubmission?: Submission;
}

export function AssignmentCard({ assignment, latestSubmission }: AssignmentCardProps) {
  const isActive = assignment.status === 'active';
  const isSubmitted = !!latestSubmission;
  
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 border-b border-neutral-200">
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-lg font-medium text-neutral-800">{assignment.title}</h2>
          <Badge variant={isActive ? "success" : "secondary"}>
            {assignment.status === 'active' ? 'Active' : 
             assignment.status === 'completed' ? 'Completed' : 'Upcoming'}
          </Badge>
        </div>
        <p className="text-neutral-600 text-sm mb-3">{assignment.course.name}</p>
        <div className="flex items-center text-sm text-neutral-600">
          <span className="material-icons text-sm mr-1">calendar_today</span>
          <span>Due: {formatDate(assignment.dueDate)}</span>
        </div>
      </CardContent>
      
      <div className="p-5 bg-blue-50">
        <div className="flex justify-between items-center mb-3">
          <div>
            <span className="text-sm font-medium text-neutral-700">Status:</span>
            <span className="ml-1 text-sm text-neutral-700">
              {isSubmitted ? 'Submitted' : 'Not submitted'}
            </span>
          </div>
          
          {isActive && !isSubmitted && (
            <Link href={APP_ROUTES.SUBMISSION(assignment.id)}>
              <Button size="sm" className="h-8">
                Submit Assignment
              </Button>
            </Link>
          )}
          
          {isSubmitted && (
            <Link href={APP_ROUTES.SUBMISSION(assignment.id)}>
              <Button size="sm" variant="outline" className="h-8 text-primary border-primary">
                View Feedback
              </Button>
            </Link>
          )}
        </div>
        
        {isSubmitted ? (
          <div className="flex items-center text-xs text-green-700">
            <span className="material-icons text-sm mr-1">check_circle</span>
            <span>
              {latestSubmission.status === 'completed' 
                ? 'AI feedback available for your last submission' 
                : 'Submission received, feedback processing...'}
            </span>
          </div>
        ) : (
          <div className="text-xs text-neutral-600">
            {isActive 
              ? 'Submit before the deadline to receive AI feedback and improve your work.'
              : assignment.status === 'completed' 
                ? 'Submission deadline has passed.'
                : 'This assignment will be available soon.'}
          </div>
        )}
      </div>
    </Card>
  );
}
