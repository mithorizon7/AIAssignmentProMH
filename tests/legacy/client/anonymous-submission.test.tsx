import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import SubmitAssignment from '../../client/src/pages/submit';

// Mock the API hooks and context providers
vi.mock('../../client/src/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

vi.mock('../../client/src/lib/auth', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false
  })
}));

vi.mock('wouter', () => ({
  useRoute: () => [true, { code: 'TEST123' }],
  useLocation: () => ['/submit/TEST123', vi.fn()]
}));

// Mock fetch for API calls
global.fetch = vi.fn();

describe('SubmitAssignment Component with ShareableCode Validation', () => {
  beforeEach(() => {
    // Mock successful assignment lookup
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 123,
        title: 'Test Assignment',
        description: 'Test description',
        courseCode: 'TEST101',
        courseName: 'Test Course',
        dueDate: new Date().toISOString(),
        shareableCode: 'TEST123'
      })
    });
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  it('should validate assignment has a shareable code', async () => {
    // Mock assignment without shareable code
    (global.fetch as any).mockReset();
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 123,
        title: 'Test Assignment',
        description: 'Test description',
        courseCode: 'TEST101',
        courseName: 'Test Course',
        dueDate: new Date().toISOString()
        // No shareableCode
      })
    });
    
    render(<SubmitAssignment />);
    
    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText('Invalid assignment link')).toBeInTheDocument();
    });
  });
  
  it('should include shareableCode in submission request', async () => {
    // Reset mocks
    (global.fetch as any).mockReset();
    
    // Mock successful assignment lookup
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 123,
        title: 'Test Assignment',
        description: 'Test description',
        courseCode: 'TEST101',
        courseName: 'Test Course',
        dueDate: new Date().toISOString(),
        shareableCode: 'TEST123'
      })
    });
    
    // Mock successful submission
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Submission received successfully' })
    });
    
    render(<SubmitAssignment />);
    
    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByText('Test Assignment')).toBeInTheDocument();
    });
    
    // Fill out form
    fireEvent.change(screen.getByLabelText(/Your Name/i), {
      target: { value: 'Test User' }
    });
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: 'test@example.com' }
    });
    
    // Select code tab and add code
    fireEvent.click(screen.getByText('Code'));
    fireEvent.change(screen.getByPlaceholderText(/Paste your code here/i), {
      target: { value: 'console.log("Hello world");' }
    });
    
    // Submit form
    fireEvent.click(screen.getByText('Submit Assignment'));
    
    // Check that shareableCode was included in form data
    await waitFor(() => {
      const formDataMock = (global.fetch as any).mock.calls[1][1].body;
      expect(formDataMock.get('shareableCode')).toBe('TEST123');
    });
  });
  
  it('should handle 403 error from missing or invalid shareableCode', async () => {
    // Reset mocks
    (global.fetch as any).mockReset();
    
    // Mock successful assignment lookup
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 123,
        title: 'Test Assignment',
        description: 'Test description',
        courseCode: 'TEST101',
        courseName: 'Test Course',
        dueDate: new Date().toISOString(),
        shareableCode: 'TEST123'
      })
    });
    
    // Mock 403 error response
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden'
    });
    
    render(<SubmitAssignment />);
    
    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByText('Test Assignment')).toBeInTheDocument();
    });
    
    // Fill out minimal form
    fireEvent.change(screen.getByLabelText(/Your Name/i), {
      target: { value: 'Test User' }
    });
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: 'test@example.com' }
    });
    
    // Select code tab and add code
    fireEvent.click(screen.getByText('Code'));
    fireEvent.change(screen.getByPlaceholderText(/Paste your code here/i), {
      target: { value: 'console.log("Hello world");' }
    });
    
    // Submit form
    fireEvent.click(screen.getByText('Submit Assignment'));
    
    // Check that error message is shown
    await waitFor(() => {
      expect(screen.getByText(/Access denied/i)).toBeInTheDocument();
    });
  });
  
  it('should handle 429 error from rate limiting', async () => {
    // Reset mocks
    (global.fetch as any).mockReset();
    
    // Mock successful assignment lookup
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 123,
        title: 'Test Assignment',
        description: 'Test description',
        courseCode: 'TEST101',
        courseName: 'Test Course',
        dueDate: new Date().toISOString(),
        shareableCode: 'TEST123'
      })
    });
    
    // Mock 429 error response
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests'
    });
    
    render(<SubmitAssignment />);
    
    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByText('Test Assignment')).toBeInTheDocument();
    });
    
    // Fill out minimal form
    fireEvent.change(screen.getByLabelText(/Your Name/i), {
      target: { value: 'Test User' }
    });
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: 'test@example.com' }
    });
    
    // Select code tab and add code
    fireEvent.click(screen.getByText('Code'));
    fireEvent.change(screen.getByPlaceholderText(/Paste your code here/i), {
      target: { value: 'console.log("Hello world");' }
    });
    
    // Submit form
    fireEvent.click(screen.getByText('Submit Assignment'));
    
    // Check that error message is shown
    await waitFor(() => {
      expect(screen.getByText(/Too Many Requests/i)).toBeInTheDocument();
    });
  });
});