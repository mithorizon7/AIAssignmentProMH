import { format, formatDistanceToNow, formatDistance, isPast } from 'date-fns';

export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'MMM d, yyyy - h:mm a');
}

export function formatShortDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'MMM d, yyyy');
}

export function formatTimeRemaining(dueDate: string | Date): string {
  const dateObj = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  
  if (isPast(dateObj)) {
    return 'Past due';
  }
  
  const timeRemaining = formatDistance(dateObj, new Date(), { addSuffix: false });
  return `${timeRemaining} remaining`;
}

export function getTimeAgo(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(dateObj, { addSuffix: true });
}

export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatProcessingTime(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }
  return `${(milliseconds / 1000).toFixed(1)}s`;
}

export function getUserInitials(name: string): string {
  if (!name) return '';
  
  const parts = name.split(' ');
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// formatFileSize has been moved to utils/file.ts to avoid duplication
