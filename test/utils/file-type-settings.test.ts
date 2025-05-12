/**
 * @jest-environment node
 */
import { getMimeTypeFromExtension, getContentTypeFromMimeType, isCSVFile } from '../../server/utils/file-type-settings';

describe('File Type Settings', () => {
  describe('getMimeTypeFromExtension', () => {
    test('returns correct mime type for common extensions', () => {
      expect(getMimeTypeFromExtension('jpg')).toBe('image/jpeg');
      expect(getMimeTypeFromExtension('jpeg')).toBe('image/jpeg');
      expect(getMimeTypeFromExtension('png')).toBe('image/png');
      expect(getMimeTypeFromExtension('pdf')).toBe('application/pdf');
      expect(getMimeTypeFromExtension('txt')).toBe('text/plain');
      expect(getMimeTypeFromExtension('html')).toBe('text/html');
      expect(getMimeTypeFromExtension('mp3')).toBe('audio/mpeg');
      expect(getMimeTypeFromExtension('mp4')).toBe('video/mp4');
    });

    test('handles extensions with or without leading dot', () => {
      expect(getMimeTypeFromExtension('.jpg')).toBe('image/jpeg');
      expect(getMimeTypeFromExtension('jpg')).toBe('image/jpeg');
    });

    test('returns default mime type for unknown extensions', () => {
      expect(getMimeTypeFromExtension('unknown')).toBe('application/octet-stream');
      expect(getMimeTypeFromExtension('')).toBe('application/octet-stream');
    });

    test('is case insensitive', () => {
      expect(getMimeTypeFromExtension('JPG')).toBe('image/jpeg');
      expect(getMimeTypeFromExtension('Png')).toBe('image/png');
    });
  });

  describe('getContentTypeFromMimeType', () => {
    test('correctly identifies image mime types', () => {
      expect(getContentTypeFromMimeType('image/jpeg')).toBe('image');
      expect(getContentTypeFromMimeType('image/png')).toBe('image');
      expect(getContentTypeFromMimeType('image/gif')).toBe('image');
      expect(getContentTypeFromMimeType('image/webp')).toBe('image');
    });

    test('correctly identifies document mime types', () => {
      expect(getContentTypeFromMimeType('application/pdf')).toBe('document');
      expect(getContentTypeFromMimeType('application/msword')).toBe('document');
      expect(getContentTypeFromMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('document');
      expect(getContentTypeFromMimeType('application/vnd.ms-excel')).toBe('document');
      expect(getContentTypeFromMimeType('text/csv')).toBe('document'); // Important - CSV should be document not text
    });

    test('correctly identifies audio mime types', () => {
      expect(getContentTypeFromMimeType('audio/mpeg')).toBe('audio');
      expect(getContentTypeFromMimeType('audio/wav')).toBe('audio');
      expect(getContentTypeFromMimeType('audio/webm')).toBe('audio');
    });

    test('correctly identifies video mime types', () => {
      expect(getContentTypeFromMimeType('video/mp4')).toBe('video');
      expect(getContentTypeFromMimeType('video/webm')).toBe('video');
      expect(getContentTypeFromMimeType('video/ogg')).toBe('video');
    });

    test('correctly identifies text mime types', () => {
      expect(getContentTypeFromMimeType('text/plain')).toBe('text');
      expect(getContentTypeFromMimeType('text/html')).toBe('text');
      expect(getContentTypeFromMimeType('text/javascript')).toBe('text');
      expect(getContentTypeFromMimeType('text/markdown')).toBe('text');
      expect(getContentTypeFromMimeType('application/json')).toBe('text');
    });

    test('defaults to text for unknown mime types', () => {
      expect(getContentTypeFromMimeType('unknown/type')).toBe('text');
      expect(getContentTypeFromMimeType('')).toBe('text');
    });
  });

  describe('isCSVFile', () => {
    test('identifies CSV files by mime type', () => {
      expect(isCSVFile('text/csv', 'file.csv')).toBe(true);
      expect(isCSVFile('application/csv', 'file.csv')).toBe(true);
    });

    test('identifies CSV files by extension even with different mime type', () => {
      expect(isCSVFile('text/plain', 'file.csv')).toBe(true);
      expect(isCSVFile('application/octet-stream', 'data.csv')).toBe(true);
    });

    test('correctly identifies non-CSV files', () => {
      expect(isCSVFile('text/plain', 'file.txt')).toBe(false);
      expect(isCSVFile('application/json', 'data.json')).toBe(false);
    });

    test('handles case insensitivity for extensions', () => {
      expect(isCSVFile('text/csv', 'DATA.CSV')).toBe(true);
      expect(isCSVFile('text/plain', 'Report.Csv')).toBe(true);
    });

    test('handles empty or missing inputs', () => {
      expect(isCSVFile('', '')).toBe(false);
      expect(isCSVFile(undefined, 'file.csv')).toBe(false);
      expect(isCSVFile('text/csv', undefined)).toBe(false);
    });
  });
});