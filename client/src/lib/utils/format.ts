import { format, formatDistanceToNow, formatDistance, isPast } from 'date-fns';

export function formatDate(date: string | Date | undefined | null): string {
  if (!date) return 'Not set';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return 'Invalid date';
    }
    return format(dateObj, 'MMM d, yyyy - h:mm a');
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
}

export function formatShortDate(date: string | Date | undefined | null): string {
  if (!date) return 'Not set';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return 'Invalid date';
    }
    return format(dateObj, 'MMM d, yyyy');
  } catch (error) {
    console.error('Error formatting short date:', error);
    return 'Invalid date';
  }
}

export function formatTimeRemaining(dueDate: string | Date | undefined | null): string {
  if (!dueDate) return 'No due date';
  
  try {
    const dateObj = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return 'Invalid due date';
    }
    
    if (isPast(dateObj)) {
      return 'Past due';
    }
    
    const timeRemaining = formatDistance(dateObj, new Date(), { addSuffix: false });
    return `${timeRemaining} remaining`;
  } catch (error) {
    console.error('Error formatting time remaining:', error);
    return 'Invalid due date';
  }
}

export function getTimeAgo(date: string | Date | undefined | null): string {
  if (!date) return 'Unknown time';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return 'Invalid date';
    }
    
    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch (error) {
    console.error('Error getting time ago:', error);
    return 'Invalid date';
  }
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
