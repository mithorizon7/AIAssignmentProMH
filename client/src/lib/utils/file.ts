import { FILE_TYPES } from '../constants';

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

export function getFileIconByExtension(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase();
  
  const iconMap: Record<string, string> = {
    'py': 'code',
    'java': 'code',
    'cpp': 'code',
    'js': 'code',
    'ts': 'code',
    'html': 'html',
    'css': 'css',
    'md': 'article',
    'txt': 'description',
    'pdf': 'picture_as_pdf',
    'zip': 'folder_zip',
    'ipynb': 'science',
  };
  
  return iconMap[extension || ''] || 'description';
}
