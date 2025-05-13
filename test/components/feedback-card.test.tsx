import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeedbackCard } from '../../client/src/components/ui/feedback-card';
import { Feedback } from '../../client/src/lib/types';

// Mock formatProcessingTime from utils
vi.mock('../../client/src/lib/utils/format', () => ({
  formatProcessingTime: vi.fn().mockReturnValue('2.5 seconds'),
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  CheckCircle: () => <div data-testid="check-circle-icon" />,
  AlertTriangle: () => <div data-testid="alert-triangle-icon" />,
  Lightbulb: () => <div data-testid="lightbulb-icon" />,
  ChevronDown: () => <div data-testid="chevron-down-icon" />,
  ChevronUp: () => <div data-testid="chevron-up-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  Bot: () => <div data-testid="bot-icon" />
}));

// Mock UI components
vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className, indicatorClassName }) => (
    <div data-testid="progress-bar" data-value={value} className={className} data-indicator-class={indicatorClassName} />
  )
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }) => (
    <div data-testid="badge" className={className}>{children}</div>
  )
}));

describe('FeedbackCard Component', () => {
  // Sample feedback data for testing
  const mockFeedback: Feedback = {
    id: 1,
    submissionId: 1,
    strengths: ['Good organization', 'Clear communication'],
    improvements: ['Could improve citations', 'More depth in analysis'],
    suggestions: ['Consider expanding on section 2', 'Add more examples'],
    summary: 'Overall good work with room for improvement',
    score: 85,
    processingTime: 2500,
    createdAt: new Date().toISOString(),
    criteriaScores: [
      { criteriaId: 'Code Quality', score: 90, feedback: 'Excellent code quality' },
      { criteriaId: 'Documentation', score: 75, feedback: 'Good documentation, could be more detailed' }
    ]
  };

  describe('Collapsed state', () => {
    it('should render collapsed view when expanded is false', () => {
      const toggleFn = vi.fn();
      
      render(
        <FeedbackCard 
          feedback={mockFeedback} 
          expanded={false}
          onToggle={toggleFn}
        />
      );
      
      // Check that only the header is visible
      expect(screen.getByText('AI Feedback')).toBeInTheDocument();
      expect(screen.getByText('Show Feedback')).toBeInTheDocument();
      
      // Check that feedback content is not visible
      expect(screen.queryByText('Strengths')).not.toBeInTheDocument();
      expect(screen.queryByText('Areas for Improvement')).not.toBeInTheDocument();
      
      // Test the toggle functionality
      fireEvent.click(screen.getByText('Show Feedback'));
      expect(toggleFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Expanded state', () => {
    it('should render full feedback when expanded is true', () => {
      render(<FeedbackCard feedback={mockFeedback} expanded={true} />);
      
      // Check header
      expect(screen.getByText('AI Feedback')).toBeInTheDocument();
      expect(screen.getByText('Generated in 2.5 seconds')).toBeInTheDocument();
      
      // Check sections are visible with new styling
      expect(screen.getByText('Strengths')).toBeInTheDocument();
      expect(screen.getByText('Areas for Improvement')).toBeInTheDocument();
      expect(screen.getByText('Suggestions')).toBeInTheDocument();
      expect(screen.getByText('Summary')).toBeInTheDocument();
      
      // Check content is visible
      expect(screen.getByText('Good organization')).toBeInTheDocument();
      expect(screen.getByText('Could improve citations')).toBeInTheDocument();
      expect(screen.getByText('Consider expanding on section 2')).toBeInTheDocument();
      expect(screen.getByText('Overall good work with room for improvement')).toBeInTheDocument();
      
      // Check score badge is displayed
      expect(screen.getByText('Score:')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
    });
    
    it('should render criteria scores when provided', () => {
      render(<FeedbackCard feedback={mockFeedback} expanded={true} />);
      
      // Check criteria section title is visible
      expect(screen.getByText('Assessment by Criteria')).toBeInTheDocument();
      
      // Check criteria items are visible
      expect(screen.getByText('Code Quality')).toBeInTheDocument();
      expect(screen.getByText('Documentation')).toBeInTheDocument();
      expect(screen.getByText('90%')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('Excellent code quality')).toBeInTheDocument();
      expect(screen.getByText('Good documentation, could be more detailed')).toBeInTheDocument();
      
      // Check progress bars exist
      expect(screen.getAllByTestId('progress-bar').length).toBe(2);
    });
    
    it('should handle toggle callback when provided', () => {
      const toggleFn = vi.fn();
      
      render(
        <FeedbackCard 
          feedback={mockFeedback} 
          expanded={true}
          onToggle={toggleFn}
        />
      );
      
      // Verify toggle button is present
      const hideButton = screen.getByText('Hide Feedback');
      expect(hideButton).toBeInTheDocument();
      
      // Test the toggle functionality
      fireEvent.click(hideButton);
      expect(toggleFn).toHaveBeenCalledTimes(1);
    });
    
    it('should not show hide button when no toggle callback provided', () => {
      render(<FeedbackCard feedback={mockFeedback} expanded={true} />);
      
      // Verify hide button is not present
      expect(screen.queryByText('Hide Feedback')).not.toBeInTheDocument();
    });
  });
  
  describe('Empty feedback sections', () => {
    it('should not render sections with empty arrays', () => {
      const emptyFeedback: Feedback = {
        ...mockFeedback,
        strengths: [],
        improvements: [],
        suggestions: [],
        criteriaScores: []
      };
      
      render(<FeedbackCard feedback={emptyFeedback} expanded={true} />);
      
      // Check that empty sections are not rendered
      expect(screen.queryByText('Strengths')).not.toBeInTheDocument();
      expect(screen.queryByText('Areas for Improvement')).not.toBeInTheDocument();
      expect(screen.queryByText('Suggestions')).not.toBeInTheDocument();
      expect(screen.queryByText('Assessment by Criteria')).not.toBeInTheDocument();
      
      // Summary should still be visible
      expect(screen.getByText('Summary')).toBeInTheDocument();
    });
    
    it('should not render summary section when empty', () => {
      const noSummaryFeedback: Feedback = {
        ...mockFeedback,
        summary: '',
      };
      
      render(<FeedbackCard feedback={noSummaryFeedback} expanded={true} />);
      
      // Summary section should not be visible
      expect(screen.queryByText('Summary')).not.toBeInTheDocument();
    });
    
    it('should handle missing criteriaScores gracefully', () => {
      const feedbackWithoutCriteria: Feedback = {
        ...mockFeedback,
        criteriaScores: undefined
      };
      
      render(<FeedbackCard feedback={feedbackWithoutCriteria} expanded={true} />);
      
      // Criteria section should not be visible
      expect(screen.queryByText('Assessment by Criteria')).not.toBeInTheDocument();
    });
  });
  
  describe('UI interaction for long summaries', () => {
    it('should truncate long summaries and show More/Less buttons', () => {
      const longSummaryFeedback: Feedback = {
        ...mockFeedback,
        summary: 'A'.repeat(300) // Create a string longer than 200 characters
      };
      
      render(<FeedbackCard feedback={longSummaryFeedback} expanded={true} />);
      
      // Check More button exists
      expect(screen.getByText('More')).toBeInTheDocument();
      
      // Click More to expand
      fireEvent.click(screen.getByText('More'));
      
      // Now Less button should be visible
      expect(screen.getByText('Less')).toBeInTheDocument();
    });
  });
});