import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { processFileForMultimodal } from '../../server/utils/multimodal-processor';

// Mock the file system operations
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn()
  }
}));

describe('Multimodal Processor Utils', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('processFileForMultimodal', () => {
    it('should process text files correctly', async () => {
      // Mock text file content
      const textContent = 'This is a sample text content';
      (fs.promises.readFile as any).mockResolvedValue(Buffer.from(textContent));

      const result = await processFileForMultimodal('/path/to/file.txt', 'file.txt', 'text/plain');
      
      expect(result).toBeDefined();
      expect(result.contentType).toBe('text');
      expect(result.isProcessable).toBe(true);
      expect(result.content).toBe(textContent);
      expect(result.textContent).toBe(textContent);
      expect(result.fileSize).toBe(100);
    });

    it('should process image files correctly', async () => {
      // Mock image file buffer
      const imageBuffer = Buffer.from('mock-image-data');
      (fs.promises.readFile as any).mockResolvedValue(imageBuffer);

      const result = await processFileForMultimodal('/path/to/image.jpg', 'image.jpg', 'image/jpeg');
      
      expect(result).toBeDefined();
      expect(result.contentType).toBe('image');
      expect(result.isProcessable).toBe(true);
      expect(result.content).toBe(imageBuffer);
      expect(result.textContent).toBeUndefined();
      expect(result.fileSize).toBe(200);
    });

    it('should handle null textContent correctly', async () => {
      // Mock document file buffer
      const docBuffer = Buffer.from('mock-document-data');
      (fs.promises.readFile as any).mockResolvedValue(docBuffer);

      const result = await processFileForMultimodal('/path/to/doc.pdf', 'doc.pdf', 'application/pdf');
      
      expect(result).toBeDefined();
      expect(result.contentType).toBe('document');
      expect(result.textContent).toBeUndefined(); // Should convert null to undefined
    });

    it('should default to text content type if not provided', async () => {
      const textContent = 'Default text content';
      (fs.promises.readFile as any).mockResolvedValue(Buffer.from(textContent));

      const result = await processFileForMultimodal(null, '/path/to/unknown.xyz', 'application/octet-stream', 150);
      
      expect(result).toBeDefined();
      expect(result.contentType).toBe('text');
    });

    it('should handle read file errors gracefully', async () => {
      (fs.promises.readFile as any).mockRejectedValue(new Error('File read error'));

      await expect(
        processFileForMultimodal('text', '/path/to/nonexistent.txt', 'text/plain', 100)
      ).rejects.toThrow('Error processing file for multimodal analysis');
    });
  });
});