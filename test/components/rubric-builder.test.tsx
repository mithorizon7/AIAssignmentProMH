import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RubricBuilder } from '../../client/src/components/instructor/rubric-builder';
import { Rubric } from '@shared/schema';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  PlusCircle: () => <div data-testid="plus-circle-icon" />,
  Trash2: () => <div data-testid="trash-icon" />
}));

describe('RubricBuilder Component', () => {
  // Sample rubric data for testing
  const mockRubric: Rubric = {
    criteria: [
      {
        id: '1',
        name: 'Code Structure',
        description: 'How well the code is organized',
        weight: 30,
        maxScore: 100,
        type: 'code_quality'
      }
    ],
    passingThreshold: 70
  };

  it('should render rubric with proper passing threshold and criteria', () => {
    const setRubric = vi.fn();
    
    render(
      <RubricBuilder 
        rubric={mockRubric} 
        setRubric={setRubric}
      />
    );
    
    // Check that passing threshold is displayed correctly
    const thresholdInput = screen.getByLabelText('Passing Threshold');
    expect(thresholdInput).toHaveValue(70);
    
    // Check that criterion name is displayed
    expect(screen.getByDisplayValue('Code Structure')).toBeInTheDocument();
    
    // Check that criterion weight is displayed
    expect(screen.getByDisplayValue('30')).toBeInTheDocument();
    
    // Check that criterion max score is displayed
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
    
    // Check that criterion description is displayed
    expect(screen.getByDisplayValue('How well the code is organized')).toBeInTheDocument();
  });
  
  it('should add a new criterion when "Add Criterion" button is clicked', () => {
    const setRubric = vi.fn();
    
    render(
      <RubricBuilder 
        rubric={mockRubric} 
        setRubric={setRubric}
      />
    );
    
    // Click the add criterion button
    fireEvent.click(screen.getByText('Add Criterion'));
    
    // Check that setRubric was called with a new criterion added
    expect(setRubric).toHaveBeenCalled();
    
    // Verify the structure of the new criterion
    const updatedRubric = setRubric.mock.calls[0][0](mockRubric);
    expect(updatedRubric.criteria.length).toBe(2);
    expect(updatedRubric.criteria[1]).toMatchObject({
      name: '',
      description: '',
      weight: 10,
      type: 'code_quality',
      maxScore: 100
    });
  });
  
  it('should remove a criterion when the remove button is clicked', () => {
    const setRubric = vi.fn();
    
    render(
      <RubricBuilder 
        rubric={{
          ...mockRubric,
          criteria: [
            ...mockRubric.criteria,
            {
              id: '2',
              name: 'Second Criterion',
              description: 'Another criterion',
              weight: 20,
              maxScore: 100,
              type: 'code_quality'
            }
          ]
        }} 
        setRubric={setRubric}
      />
    );
    
    // Get all remove buttons and click the first one
    const removeButtons = screen.getAllByText('Remove');
    fireEvent.click(removeButtons[0]);
    
    // Check that setRubric was called with the first criterion removed
    expect(setRubric).toHaveBeenCalled();
    
    // Verify the structure after removal
    const updatedRubric = setRubric.mock.calls[0][0](mockRubric);
    expect(updatedRubric.criteria.length).toBe(0);
  });
  
  it('should update criterion name when input changes', () => {
    const setRubric = vi.fn();
    
    render(
      <RubricBuilder 
        rubric={mockRubric} 
        setRubric={setRubric}
      />
    );
    
    // Find the criterion name input and change its value
    const nameInput = screen.getByDisplayValue('Code Structure');
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } });
    
    // Check that setRubric was called with updated name
    expect(setRubric).toHaveBeenCalled();
    
    // Verify the updated criterion
    const updatedRubric = setRubric.mock.calls[0][0](mockRubric);
    expect(updatedRubric.criteria[0].name).toBe('Updated Name');
  });
  
  it('should update criterion weight when input changes', () => {
    const setRubric = vi.fn();
    
    render(
      <RubricBuilder 
        rubric={mockRubric} 
        setRubric={setRubric}
      />
    );
    
    // Find the criterion weight input and change its value
    const weightInput = screen.getByDisplayValue('30');
    fireEvent.change(weightInput, { target: { value: '50' } });
    
    // Check that setRubric was called with updated weight
    expect(setRubric).toHaveBeenCalled();
    
    // Verify the updated criterion
    const updatedRubric = setRubric.mock.calls[0][0](mockRubric);
    expect(updatedRubric.criteria[0].weight).toBe(50);
  });
  
  it('should update criterion max score when input changes', () => {
    const setRubric = vi.fn();
    
    render(
      <RubricBuilder 
        rubric={mockRubric} 
        setRubric={setRubric}
      />
    );
    
    // Find the criterion max score input and change its value
    const maxScoreInput = screen.getByDisplayValue('100');
    fireEvent.change(maxScoreInput, { target: { value: '200' } });
    
    // Check that setRubric was called with updated max score
    expect(setRubric).toHaveBeenCalled();
    
    // Verify the updated criterion
    const updatedRubric = setRubric.mock.calls[0][0](mockRubric);
    expect(updatedRubric.criteria[0].maxScore).toBe(200);
  });
  
  it('should update criterion description when input changes', () => {
    const setRubric = vi.fn();
    
    render(
      <RubricBuilder 
        rubric={mockRubric} 
        setRubric={setRubric}
      />
    );
    
    // Find the criterion description input and change its value
    const descriptionInput = screen.getByDisplayValue('How well the code is organized');
    fireEvent.change(descriptionInput, { target: { value: 'Updated description' } });
    
    // Check that setRubric was called with updated description
    expect(setRubric).toHaveBeenCalled();
    
    // Verify the updated criterion
    const updatedRubric = setRubric.mock.calls[0][0](mockRubric);
    expect(updatedRubric.criteria[0].description).toBe('Updated description');
  });
  
  it('should update passing threshold when input changes', () => {
    const setRubric = vi.fn();
    
    render(
      <RubricBuilder 
        rubric={mockRubric} 
        setRubric={setRubric}
      />
    );
    
    // Find the passing threshold input and change its value
    const thresholdInput = screen.getByDisplayValue('70');
    fireEvent.change(thresholdInput, { target: { value: '60' } });
    
    // Check that setRubric was called with updated threshold
    expect(setRubric).toHaveBeenCalled();
    
    // Verify the updated threshold
    const updatedRubric = setRubric.mock.calls[0][0](mockRubric);
    expect(updatedRubric.passingThreshold).toBe(60);
  });
  
  it('should show empty state message when no criteria are defined', () => {
    const setRubric = vi.fn();
    
    render(
      <RubricBuilder 
        rubric={{ criteria: [], passingThreshold: 70 }} 
        setRubric={setRubric}
      />
    );
    
    // Check that empty state message is displayed
    expect(screen.getByText('No criteria defined yet. Add your first criterion to get started.')).toBeInTheDocument();
  });
});