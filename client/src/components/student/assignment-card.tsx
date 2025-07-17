import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Assignment, Submission } from "@/lib/types";
import { formatDate, formatTimeRemaining } from "@/lib/utils/format";
import { Link } from "wouter";
import { APP_ROUTES } from "@/lib/constants";
import { Calendar, CheckCircle, ArrowRightCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { AssignmentStatusIndicator } from "./assignment-status-indicator";

interface AssignmentCardProps {
  assignment: Assignment & {
    effectiveStatus?: 'upcoming' | 'active' | 'completed';
    calculatedStatus?: 'upcoming' | 'active' | 'completed';
    manualStatus?: string;
  };
  latestSubmission?: Submission;
}

export function AssignmentCard({ assignment, latestSubmission }: AssignmentCardProps) {
  const effectiveStatus = assignment.effectiveStatus || assignment.status;
  const isActive = effectiveStatus === 'active';
  const isSubmitted = !!latestSubmission;
  const isUpcoming = assignment.availableAt && new Date(assignment.availableAt) > new Date();
  
  return (
    <Card className="overflow-hidden card-hover scale-in transition-all duration-300 hover:shadow-md">
      <CardContent className="p-5 border-b border-neutral-200">
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-lg font-medium text-neutral-800 fade-in" style={{animationDelay: "50ms"}}>{assignment.title}</h2>
          <div className="slide-in-right" style={{animationDelay: "150ms"}}>
            <AssignmentStatusIndicator
              effectiveStatus={effectiveStatus as 'upcoming' | 'active' | 'completed'}
              manualStatus={assignment.manualStatus || assignment.status}
              calculatedStatus={assignment.calculatedStatus || assignment.status as 'upcoming' | 'active' | 'completed'}
              dueDate={assignment.dueDate}
            />
          </div>
        </div>
        <p className="text-neutral-600 text-sm mb-3 fade-in" style={{animationDelay: "100ms"}}>{assignment.course.name}</p>
        <div className="flex items-center text-sm text-neutral-600 fade-in" style={{animationDelay: "150ms"}}>
          <Calendar className="h-4 w-4 mr-1.5" />
          {assignment.availableAt && new Date(assignment.availableAt) > new Date() ? (
            <span className="text-blue-600">Available: {formatDate(assignment.availableAt)}</span>
          ) : (
            <span>Due: {formatDate(assignment.dueDate)}</span>
          )}
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
          
          {isActive && !isSubmitted && !isUpcoming && (
            <Link href={`/submission/${assignment.id}`} className="slide-in-right" style={{animationDelay: "250ms"}}>
              <Button size="sm" className="h-10 px-4 btn-hover-effect group relative overflow-hidden whitespace-nowrap bg-gradient-to-r from-primary to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all duration-300">
                <span className="relative z-10">Submit Assignment</span>
                <ArrowRightCircle className="ml-2 h-4 w-4 relative z-10 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
          )}
          
          {isUpcoming && (
            <Button size="sm" disabled className="h-10 px-4 bg-gray-100 text-gray-500 cursor-not-allowed">
              Not Yet Available
            </Button>
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
            {isUpcoming
              ? `Assignment opens on ${formatDate(assignment.availableAt!)}`
              : isActive 
                ? 'Submit before the deadline to receive AI feedback and improve your work.'
                : assignment.status === 'completed' 
                  ? 'Submission deadline has passed.'
                  : 'Assignment is not currently accepting submissions.'}
          </div>
        )}
      </div>
    </Card>
  );
}
