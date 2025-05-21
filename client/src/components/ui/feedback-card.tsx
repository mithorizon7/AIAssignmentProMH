import { Button } from "@/components/ui/button";
import { formatProcessingTime } from "@/lib/utils/format";
import { Feedback } from "@/lib/types"; 
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  AlertTriangle, 
  Lightbulb, 
  ChevronDown, 
  ChevronUp, 
  Clock,
  Bot
} from "lucide-react";
import { useState } from "react";

interface FeedbackCardProps {
  feedback: Feedback;
  expanded?: boolean;
  onToggle?: () => void;
}

export function FeedbackCard({ feedback, expanded = true, onToggle }: FeedbackCardProps) {
  const [showFullSummary, setShowFullSummary] = useState(false);
  
  // Format score as a percentage if it exists
  const scorePercentage = feedback.score !== undefined 
    ? `${feedback.score}%` 
    : undefined;

  // Determine score color based on value
  const getScoreColor = (score?: number) => {
    if (score === undefined) return "bg-gray-200";
    if (score >= 90) return "text-green-700";
    if (score >= 75) return "text-green-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  };
  
  // Collapsed state
  if (!expanded) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-4 transition-all">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <div className="h-6 w-6 mr-2 rounded-full bg-blue-50 flex items-center justify-center">
              <Bot className="h-4 w-4 text-blue-600" />
            </div>
            <h4 className="font-medium text-gray-900">AI Feedback</h4>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors font-medium"
            onClick={onToggle}
          >
            <ChevronDown className="h-4 w-4 mr-1" />
            Show Feedback
          </Button>
        </div>
      </div>
    );
  }
  
  // Truncate summary text if it's too long
  const summaryText = feedback.summary || "";
  const truncatedSummary = summaryText.length > 200 && !showFullSummary
    ? summaryText.substring(0, 200) + "..."
    : summaryText;
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 mb-4 transition-all">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-4">
        <div className="flex items-center">
          <div className="h-7 w-7 mr-2 rounded-full bg-blue-50 flex items-center justify-center">
            <Bot className="h-5 w-5 text-blue-600" />
          </div>
          <h4 className="font-semibold text-gray-900">AI Feedback</h4>
          
          {scorePercentage && (
            <Badge className="ml-3 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200">
              Score: <span className={`ml-1 font-semibold ${getScoreColor(feedback.score)}`}>{scorePercentage}</span>
            </Badge>
          )}
        </div>
        <div className="flex items-center text-xs text-gray-500">
          <Clock className="h-3.5 w-3.5 mr-1" />
          Generated in {formatProcessingTime(feedback.processingTime)}
        </div>
      </div>
      
      {/* Criteria Scores if available */}
      {feedback.criteriaScores && feedback.criteriaScores.length > 0 && (
        <div className="bg-gray-50 rounded-md p-4 mb-5 border border-gray-200">
          <h5 className="text-sm font-semibold text-gray-800 mb-3">Assessment by Criteria</h5>
          <div className="grid gap-y-3">
            {feedback.criteriaScores.map((criterion) => (
              <div key={criterion.criteriaId}>
                <div className="flex justify-between text-sm mb-1">
                  <div className="font-medium text-gray-700">
                    {/* Try to convert numeric criteriaId to a more readable format if it's just a number */}
                    {criterion.criteriaName || getCriterionDisplayName(criterion.criteriaId)}
                  </div>
                  <div className="font-semibold">
                    <span className={getScoreColor(criterion.score)}>{criterion.score}%</span>
                  </div>
                </div>
                <Progress 
                  value={criterion.score} 
                  className="h-2" 
                  // Color based on score
                  indicatorClassName={`${
                    criterion.score >= 90 ? "bg-green-500" : 
                    criterion.score >= 75 ? "bg-green-400" : 
                    criterion.score >= 60 ? "bg-amber-500" : 
                    "bg-red-500"
                  }`}
                />
                {criterion.feedback && (
                  <p className="text-xs text-gray-600 mt-1">{criterion.feedback}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Feedback Sections */}
      <div className="space-y-4">
        {/* Strengths Section */}
        {feedback.strengths && feedback.strengths.length > 0 && (
          <div className="rounded-md p-4 bg-green-50 border-l-4 border-l-green-400">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <h5 className="font-semibold text-green-800 text-sm mb-2">Strengths</h5>
                <ul className="space-y-2">
                  {feedback.strengths.map((strength, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-green-700">
                      <span className="select-none mt-0.5">•</span>
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
        
        {/* Improvements Section */}
        {feedback.improvements && feedback.improvements.length > 0 && (
          <div className="rounded-md p-4 bg-amber-50 border-l-4 border-l-amber-400">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <h5 className="font-semibold text-amber-800 text-sm mb-2">Areas for Improvement</h5>
                <ul className="space-y-2">
                  {feedback.improvements.map((improvement, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-amber-700">
                      <span className="select-none mt-0.5">•</span>
                      <span>{improvement}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
        
        {/* Suggestions Section */}
        {feedback.suggestions && feedback.suggestions.length > 0 && (
          <div className="rounded-md p-4 bg-blue-50 border-l-4 border-l-blue-400">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <h5 className="font-semibold text-blue-800 text-sm mb-2">Suggestions</h5>
                <ul className="space-y-2">
                  {feedback.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-blue-700">
                      <span className="select-none mt-0.5">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Summary Section */}
      {feedback.summary && (
        <div className="mt-5 pt-4 border-t border-gray-200">
          <div className="flex justify-between items-start mb-2">
            <h5 className="font-semibold text-gray-800 text-sm">Summary</h5>
            {summaryText.length > 200 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs h-auto p-1 text-gray-500 hover:text-gray-700"
                onClick={() => setShowFullSummary(!showFullSummary)}
              >
                {showFullSummary ? (
                  <>Less <ChevronUp className="h-3 w-3 ml-1" /></>
                ) : (
                  <>More <ChevronDown className="h-3 w-3 ml-1" /></>
                )}
              </Button>
            )}
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{truncatedSummary}</p>
        </div>
      )}
      
      {/* Toggle Button */}
      {onToggle && (
        <div className="text-right mt-5">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
            onClick={onToggle}
          >
            <ChevronUp className="h-4 w-4 mr-1" />
            Hide Feedback
          </Button>
        </div>
      )}
    </div>
  );
}
