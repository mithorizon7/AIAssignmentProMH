import { FILE_TYPES } from '../constants';
import { 
  Code, FileCode, FileText, FileImage, 
  File, FileJson, Archive, 
  Music, Video
} from 'lucide-react';

export type FileIconType = typeof Code;

export function isValidFileType(file: File): boolean {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  return FILE_TYPES.ALLOWED.includes(extension);
}

export function isValidFileSize(file: File): boolean {
  return file.size <= FILE_TYPES.MAX_SIZE;
}

export function getFileErrorMessage(file: File): string | null {
  if (!isValidFileType(file)) {
    return `File type not supported. Please upload one of: ${FILE_TYPES.ALLOWED.join(', ')}`;
  }
  
  if (!isValidFileSize(file)) {
    return `File too large. Maximum size is ${FILE_TYPES.MAX_SIZE / (1024 * 1024)}MB`;
  }
  
  return null;
}

export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function getFileIconByExtension(filename: string): FileIconType {
  const extension = filename.split('.').pop()?.toLowerCase();
  
  // Map file extensions to Lucide icons
  const iconMap: Record<string, FileIconType> = {
    // Code files
    'py': FileCode,
    'java': FileCode,
    'cpp': FileCode,
    'c': FileCode,
    'cs': FileCode,
    'js': FileCode,
    'ts': FileCode,
    'jsx': FileCode,
    'tsx': FileCode,
    'php': FileCode,
    'rb': FileCode,
    'go': FileCode,
    'rs': FileCode,
    'swift': FileCode,
    'kt': FileCode,
    'html': FileCode,
    'css': FileCode,
    'scss': FileCode,
    'less': FileCode,
    
    // Documents
    'md': FileText,
    'txt': FileText,
    'doc': FileText,
    'docx': FileText,
    'rtf': FileText,
    'odt': FileText,
    
    // PDFs
    'pdf': FileText,
    
    // Archives
    'zip': Archive,
    'rar': Archive,
    'tar': Archive,
    'gz': Archive,
    '7z': Archive,
    
    // Spreadsheets & Data
    'csv': FileJson,
    'xls': FileJson,
    'xlsx': FileJson,
    'ods': FileJson,
    'json': FileJson,
    'xml': FileJson,
    'ipynb': FileJson,
    
    // Images
    'jpg': FileImage,
    'jpeg': FileImage,
    'png': FileImage,
    'gif': FileImage,
    'webp': FileImage,
    'svg': FileImage,
    'bmp': FileImage,
    'tiff': FileImage,
    
    // Audio
    'mp3': Music,
    'wav': Music,
    'ogg': Music,
    'flac': Music,
    'aac': Music,
    'm4a': Music,
    
    // Video
    'mp4': Video,
    'webm': Video,
    'avi': Video,
    'mov': Video,
    'wmv': Video,
    'mkv': Video,
    'flv': Video,
  };
  
  return iconMap[extension || ''] || File;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
