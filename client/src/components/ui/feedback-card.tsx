import { Button } from "@/components/ui/button";
import { formatProcessingTime } from "@/lib/utils/format";
import { Feedback } from "@/lib/types"; // Still using client-side Feedback interface which imports types from shared

interface FeedbackCardProps {
  feedback: Feedback;
  expanded?: boolean;
  onToggle?: () => void;
}

export function FeedbackCard({ feedback, expanded = true, onToggle }: FeedbackCardProps) {
  if (!expanded) {
    return (
      <div className="bg-neutral-50 rounded-lg p-4 mb-4">
        <div className="flex justify-between items-center">
          <h4 className="font-medium text-neutral-800">AI Feedback</h4>
          <Button 
            variant="link" 
            size="sm" 
            className="text-primary hover:text-primary-dark font-medium h-auto p-0"
            onClick={onToggle}
          >
            Show Feedback
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-blue-50 rounded-lg p-4 mb-4">
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-medium text-neutral-800">AI Feedback</h4>
        <span className="text-xs text-neutral-500">
          Generated in {formatProcessingTime(feedback.processingTime)}
        </span>
      </div>
      
      {feedback.strengths && feedback.strengths.length > 0 && (
        <div className="mb-3">
          <div className="flex items-start mb-1">
            <span className="material-icons text-green-600 mr-2">check_circle</span>
            <div>
              <p className="text-sm font-medium text-neutral-800">Strengths</p>
              <ul className="list-disc list-inside">
                {feedback.strengths.map((strength, index) => (
                  <li key={index} className="text-sm text-neutral-700 ml-4">
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
      
      {feedback.improvements && feedback.improvements.length > 0 && (
        <div className="mb-3">
          <div className="flex items-start mb-1">
            <span className="material-icons text-amber-600 mr-2">info</span>
            <div>
              <p className="text-sm font-medium text-neutral-800">Areas for Improvement</p>
              <ul className="list-disc list-inside">
                {feedback.improvements.map((improvement, index) => (
                  <li key={index} className="text-sm text-neutral-700 ml-4">
                    {improvement}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
      
      {feedback.suggestions && feedback.suggestions.length > 0 && (
        <div className="mb-3">
          <div className="flex items-start mb-1">
            <span className="material-icons text-blue-600 mr-2">lightbulb</span>
            <div>
              <p className="text-sm font-medium text-neutral-800">Suggestions</p>
              <ul className="list-disc list-inside">
                {feedback.suggestions.map((suggestion, index) => (
                  <li key={index} className="text-sm text-neutral-700 ml-4">
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
      
      {feedback.summary && (
        <div className="border-t border-blue-200 mt-3 pt-3">
          <p className="text-sm font-medium text-neutral-800">Summary</p>
          <p className="text-sm text-neutral-700">{feedback.summary}</p>
        </div>
      )}
      
      {onToggle && (
        <div className="text-right mt-3">
          <Button 
            variant="link" 
            size="sm" 
            className="text-primary hover:text-primary-dark font-medium h-auto p-0"
            onClick={onToggle}
          >
            Hide Feedback
          </Button>
        </div>
      )}
    </div>
  );
}
