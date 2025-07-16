import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Assignment, Submission } from "@/lib/types";
import { formatDate, formatTimeRemaining } from "@/lib/utils/format";
import { Link } from "wouter";
import { APP_ROUTES } from "@/lib/constants";
import { Calendar, CheckCircle, ArrowRightCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssignmentCardProps {
  assignment: Assignment;
  latestSubmission?: Submission;
}

export function AssignmentCard({ assignment, latestSubmission }: AssignmentCardProps) {
  const isActive = assignment.status === 'active';
  const isSubmitted = !!latestSubmission;
  
  return (
    <Card className="overflow-hidden card-hover scale-in transition-all duration-300 hover:shadow-md">
      <CardContent className="p-5 border-b border-neutral-200">
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-lg font-medium text-neutral-800 fade-in" style={{animationDelay: "50ms"}}>{assignment.title}</h2>
          <Badge 
            variant={isActive ? "default" : "secondary"}
            className={cn(
              "transition-all duration-300 slide-in-right",
              isActive && "bg-green-100 text-green-800 hover:bg-green-200",
              assignment.status === 'completed' && "bg-gray-100 text-gray-800 hover:bg-gray-200",
              assignment.status === 'upcoming' && "bg-blue-100 text-blue-800 hover:bg-blue-200"
            )}
            style={{animationDelay: "150ms"}}
          >
            {assignment.status === 'active' ? 'Active' : 
             assignment.status === 'completed' ? 'Completed' : 'Upcoming'}
          </Badge>
        </div>
        <p className="text-neutral-600 text-sm mb-3 fade-in" style={{animationDelay: "100ms"}}>{assignment.course.name}</p>
        <div className="flex items-center text-sm text-neutral-600 fade-in" style={{animationDelay: "150ms"}}>
          <Calendar className="h-4 w-4 mr-1.5" />
          <span>Due: {formatDate(assignment.dueDate)}</span>
        </div>
      </CardContent>
      
      <div className="p-5 bg-blue-50 fade-in" style={{animationDelay: "200ms"}}>
        <div className="flex justify-between items-center mb-3">
          <div>
            <span className="text-sm font-medium text-neutral-700">Status:</span>
            <span className="ml-1 text-sm text-neutral-700">
              {isSubmitted ? 'Submitted' : 'Not submitted'}
            </span>
          </div>
          
          {isActive && !isSubmitted && (
            <Link href={`/submission/${assignment.id}`} className="slide-in-right" style={{animationDelay: "250ms"}}>
              <Button size="sm" className="h-10 px-4 btn-hover-effect group relative overflow-hidden whitespace-nowrap bg-gradient-to-r from-primary to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all duration-300">
                <span className="relative z-10">Submit Assignment</span>
                <ArrowRightCircle className="ml-2 h-4 w-4 relative z-10 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
          )}
          
          {isSubmitted && (
            <Link href={`/submission/${assignment.id}`} className="slide-in-right" style={{animationDelay: "250ms"}}>
              <Button 
                size="sm" 
                variant="outline" 
                className="h-10 px-4 text-primary border-primary hover:bg-primary/5 btn-hover-effect group whitespace-nowrap transition-all duration-300 hover:shadow-md"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                View Feedback
                <ArrowRightCircle className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
          )}
        </div>
        
        {isSubmitted ? (
          <div className="flex items-center text-xs text-green-700 fade-in">
            <CheckCircle className="h-4 w-4 mr-1.5" />
            <span>
              {latestSubmission.status === 'completed' 
                ? 'AI feedback available for your last submission' 
                : 'Submission received, feedback processing...'}
            </span>
          </div>
        ) : (
          <div className="text-xs text-neutral-600 fade-in">
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
