import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeedbackCard } from '../../client/src/components/ui/feedback-card';
import { Feedback } from '../../client/src/lib/types';

// Mock formatProcessingTime from utils
vi.mock('../../client/src/lib/utils/format', () => ({
  formatProcessingTime: vi.fn().mockReturnValue('2.5 seconds'),
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
      
      // Check sections are visible
      expect(screen.getByText('Strengths')).toBeInTheDocument();
      expect(screen.getByText('Areas for Improvement')).toBeInTheDocument();
      expect(screen.getByText('Suggestions')).toBeInTheDocument();
      expect(screen.getByText('Summary')).toBeInTheDocument();
      
      // Check content is visible
      expect(screen.getByText('Good organization')).toBeInTheDocument();
      expect(screen.getByText('Could improve citations')).toBeInTheDocument();
      expect(screen.getByText('Consider expanding on section 2')).toBeInTheDocument();
      expect(screen.getByText('Overall good work with room for improvement')).toBeInTheDocument();
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
      };
      
      render(<FeedbackCard feedback={emptyFeedback} expanded={true} />);
      
      // Check that empty sections are not rendered
      expect(screen.queryByText('Strengths')).not.toBeInTheDocument();
      expect(screen.queryByText('Areas for Improvement')).not.toBeInTheDocument();
      expect(screen.queryByText('Suggestions')).not.toBeInTheDocument();
      
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
  });
});