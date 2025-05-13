import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QuillEditor } from '../../client/src/components/quill-editor';
import { QuillContent } from '../../client/src/components/quill-content';

// Mock react-quill since it's not easy to test in jsdom environment
jest.mock('react-quill', () => {
  return function MockQuill({ value, onChange, placeholder }: any) {
    return (
      <div data-testid="mock-quill-editor" className="mock-quill">
        <div>{placeholder}</div>
        <textarea 
          data-testid="mock-quill-textarea"
          value={value} 
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="ql-toolbar">
          <button data-testid="mock-bold-button">Bold</button>
          <button data-testid="mock-italic-button">Italic</button>
        </div>
      </div>
    );
  };
});

describe('QuillEditor Component', () => {
  test('renders with correct props', () => {
    const handleChange = jest.fn();
    const placeholderText = 'Type something...';
    
    render(
      <QuillEditor 
        value="Initial content" 
        onChange={handleChange} 
        placeholder={placeholderText}
      />
    );
    
    expect(screen.getByTestId('mock-quill-editor')).toBeInTheDocument();
    expect(screen.getByText(placeholderText)).toBeInTheDocument();
  });
  
  test('calls onChange when content changes', () => {
    const handleChange = jest.fn();
    
    render(
      <QuillEditor 
        value="Initial content" 
        onChange={handleChange} 
      />
    );
    
    const textarea = screen.getByTestId('mock-quill-textarea');
    fireEvent.change(textarea, { target: { value: 'New content' } });
    
    expect(handleChange).toHaveBeenCalledWith('New content');
  });
  
  test('applies custom className', () => {
    render(
      <QuillEditor 
        value="Test" 
        onChange={() => {}} 
        className="custom-class"
      />
    );
    
    const editor = screen.getByTestId('mock-quill-editor');
    expect(editor.parentElement).toHaveClass('custom-class');
  });
});

describe('QuillContent Component', () => {
  test('renders content correctly', () => {
    const htmlContent = '<p>Test content</p>';
    const { container } = render(<QuillContent content={htmlContent} />);
    
    expect(container.innerHTML).toContain('Test content');
  });
  
  test('sanitizes HTML content', () => {
    // This test checks that potentially dangerous HTML is sanitized
    const dangerousHtml = '<p>Safe text</p><script>alert("dangerous")</script>';
    const { container } = render(<QuillContent content={dangerousHtml} />);
    
    expect(container.innerHTML).toContain('Safe text');
    expect(container.innerHTML).not.toContain('script');
    expect(container.innerHTML).not.toContain('alert("dangerous")');
  });

  test('applies custom class names', () => {
    const { container } = render(
      <QuillContent content="<p>Test</p>" className="custom-prose" />
    );
    
    const contentDiv = container.firstChild;
    expect(contentDiv).toHaveClass('custom-prose');
  });
});