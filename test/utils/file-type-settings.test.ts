import { describe, it, expect } from 'vitest';
import { determineContentType, ContentType } from '../../server/utils/file-type-settings';

describe('File Type Settings Utils', () => {
  describe('determineContentType', () => {
    it('should correctly identify text files', () => {
      expect(determineContentType('txt', 'text/plain')).toBe('text');
      expect(determineContentType('js', 'application/javascript')).toBe('text');
      expect(determineContentType('html', 'text/html')).toBe('text');
      expect(determineContentType('md', 'text/markdown')).toBe('text');
      expect(determineContentType('json', 'application/json')).toBe('text');
    });

    it('should correctly identify image files', () => {
      expect(determineContentType('jpg', 'image/jpeg')).toBe('image');
      expect(determineContentType('png', 'image/png')).toBe('image');
      expect(determineContentType('svg', 'image/svg+xml')).toBe('image');
      expect(determineContentType('gif', 'image/gif')).toBe('image');
      expect(determineContentType('webp', 'image/webp')).toBe('image');
    });

    it('should correctly identify document files', () => {
      expect(determineContentType('pdf', 'application/pdf')).toBe('document');
      expect(determineContentType('doc', 'application/msword')).toBe('document');
      expect(determineContentType('docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('document');
      expect(determineContentType('csv', 'text/csv')).toBe('document');
    });

    it('should correctly identify audio files', () => {
      expect(determineContentType('mp3', 'audio/mpeg')).toBe('audio');
      expect(determineContentType('wav', 'audio/wav')).toBe('audio');
      expect(determineContentType('ogg', 'audio/ogg')).toBe('audio');
    });

    it('should correctly identify video files', () => {
      expect(determineContentType('mp4', 'video/mp4')).toBe('video');
      expect(determineContentType('webm', 'video/webm')).toBe('video');
      expect(determineContentType('avi', 'video/x-msvideo')).toBe('video');
    });

    it('should fall back to extension analysis when MIME type is not meaningful', () => {
      expect(determineContentType('mp4', 'application/octet-stream')).toBe('video');
      expect(determineContentType('jpg', 'application/octet-stream')).toBe('image');
    });

    it('should default to text for unknown file types', () => {
      expect(determineContentType('xyz', 'application/octet-stream')).toBe('text');
    });

    it('should handle case-insensitive extensions', () => {
      expect(determineContentType('JPG', 'image/jpeg')).toBe('image');
      expect(determineContentType('PDF', 'application/pdf')).toBe('document');
    });

    it('should return valid ContentType values', () => {
      const result: ContentType = determineContentType('jpg', 'image/jpeg');
      expect(['text', 'image', 'audio', 'video', 'document']).toContain(result);
    });
  });
});