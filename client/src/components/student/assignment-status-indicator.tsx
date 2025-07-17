import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, AlertTriangle, CheckCircle, Calendar } from "lucide-react";

interface AssignmentStatusIndicatorProps {
  effectiveStatus: 'upcoming' | 'active' | 'completed';
  manualStatus: string;
  calculatedStatus: 'upcoming' | 'active' | 'completed';
  dueDate: string;
  showDetails?: boolean;
}

export function AssignmentStatusIndicator({ 
  effectiveStatus, 
  manualStatus, 
  calculatedStatus, 
  dueDate,
  showDetails = false 
}: AssignmentStatusIndicatorProps) {
  const hasStatusMismatch = manualStatus !== calculatedStatus;
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'upcoming':
        return <Calendar className="h-3 w-3" />;
      case 'active':
        return <Clock className="h-3 w-3" />;
      case 'completed':
        return <CheckCircle className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'completed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return `${Math.abs(diffDays)} days overdue`;
    } else if (diffDays === 0) {
      return 'Due today';
    } else if (diffDays === 1) {
      return 'Due tomorrow';
    } else if (diffDays <= 7) {
      return `Due in ${diffDays} days`;
    } else {
      return `Due ${date.toLocaleDateString()}`;
    }
  };

  const statusDisplay = (
    <div className="flex items-center gap-2">
      <Badge 
        variant="outline" 
        className={`${getStatusColor(effectiveStatus)} flex items-center gap-1 text-xs font-medium`}
      >
        {getStatusIcon(effectiveStatus)}
        {effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1)}
      </Badge>
      
      {hasStatusMismatch && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-sm">
                <p className="font-medium">Status Mismatch</p>
                <p>Manual: {manualStatus}</p>
                <p>Calculated: {calculatedStatus}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Showing calculated status based on due date
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );

  if (!showDetails) {
    return statusDisplay;
  }

  return (
    <div className="space-y-2">
      {statusDisplay}
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {formatDueDate(dueDate)}
      </div>
      {hasStatusMismatch && (
        <div className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded border border-amber-200">
          <span className="font-medium">Note:</span> Manual status ({manualStatus}) differs from calculated status ({calculatedStatus})
        </div>
      )}
    </div>
  );
}