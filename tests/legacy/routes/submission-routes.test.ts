import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import multer from 'multer';
import { determineContentType } from '../../server/utils/file-type-settings';
import { isFileTypeAllowed } from '../../server/utils/file-type-settings';
import { processFileForMultimodal } from '../../server/utils/multimodal-processor';

// Mock the dependencies
vi.mock('../../server/utils/file-type-settings', () => ({
  determineContentType: vi.fn(),
  isFileTypeAllowed: vi.fn()
}));

vi.mock('../../server/utils/multimodal-processor', () => ({
  processFileForMultimodal: vi.fn()
}));

vi.mock('../../server/storage', () => ({
  storage: {
    getAssignment: vi.fn(),
    getCourse: vi.fn(),
    getUser: vi.fn(),
    getEnrollment: vi.fn(),
    createSubmission: vi.fn()
  }
}));

vi.mock('../../server/queue/worker', () => ({
  submissionQueue: {
    addSubmission: vi.fn()
  }
}));

describe('Submission Routes', () => {
  let app;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock multer for file uploads
    const upload = multer({ storage: multer.memoryStorage() });
    
    // Add a simplified test route similar to the actual submission route
    app.post('/api/test-submission', upload.single('file'), async (req, res) => {
      try {
        const file = req.file;
        let contentType = null;
        let isAllowed = false;
        
        if (file) {
          const fileExtension = file.originalname.split('.').pop().toLowerCase();
          contentType = determineContentType(fileExtension, file.mimetype);
          isAllowed = await isFileTypeAllowed(contentType, fileExtension, file.mimetype);
          
          if (!isAllowed) {
            return res.status(400).json({ 
              message: `File type ${fileExtension} (${file.mimetype}) is not allowed`
            });
          }
          
          // Return the processed file type information
          return res.status(200).json({
            success: true,
            contentType,
            fileExtension,
            mimeType: file.mimetype,
            fileSize: file.size
          });
        } else {
          // For text/code submissions
          contentType = 'text';
          
          return res.status(200).json({
            success: true,
            contentType,
            isText: true
          });
        }
      } catch (error) {
        console.error('Error in test route:', error);
        return res.status(500).json({ message: 'Internal server error' });
      }
    });
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  it('should correctly process and identify text file uploads', async () => {
    // Mock the file type determination
    (determineContentType as any).mockReturnValue('text');
    (isFileTypeAllowed as any).mockResolvedValue(true);
    
    const response = await request(app)
      .post('/api/test-submission')
      .attach('file', Buffer.from('This is a text file'), {
        filename: 'test.txt',
        contentType: 'text/plain'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.contentType).toBe('text');
    expect(response.body.fileExtension).toBe('txt');
    expect(response.body.mimeType).toBe('text/plain');
  });
  
  it('should correctly process and identify image file uploads', async () => {
    // Mock the file type determination
    (determineContentType as any).mockReturnValue('image');
    (isFileTypeAllowed as any).mockResolvedValue(true);
    
    const response = await request(app)
      .post('/api/test-submission')
      .attach('file', Buffer.from('Mock image data'), {
        filename: 'test.jpg',
        contentType: 'image/jpeg'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.contentType).toBe('image');
    expect(response.body.fileExtension).toBe('jpg');
    expect(response.body.mimeType).toBe('image/jpeg');
  });
  
  it('should reject disallowed file types', async () => {
    // Mock the file type determination
    (determineContentType as any).mockReturnValue('document');
    (isFileTypeAllowed as any).mockResolvedValue(false);
    
    const response = await request(app)
      .post('/api/test-submission')
      .attach('file', Buffer.from('Mock data'), {
        filename: 'test.xyz',
        contentType: 'application/octet-stream'
      });
    
    expect(response.status).toBe(400);
    expect(response.body.message).toContain('not allowed');
  });
  
  it('should handle text submissions without files', async () => {
    const response = await request(app)
      .post('/api/test-submission')
      .send({
        code: 'console.log("Hello, world!");'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.contentType).toBe('text');
    expect(response.body.isText).toBe(true);
  });
});