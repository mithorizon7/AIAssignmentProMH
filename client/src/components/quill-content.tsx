import React from 'react';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';

type QuillContentProps = {
  content: string;
  className?: string;
  isDarkBg?: boolean;
};

/**
 * Component for safely rendering QuillJS HTML content
 */
const QuillContent: React.FC<QuillContentProps> = ({
  content,
  className,
  isDarkBg = false,
}) => {
  // Sanitize HTML content to prevent XSS attacks
  const sanitizedContent = DOMPurify.sanitize(content);
  
  return (
    <div 
      className={cn(
        'prose prose-sm max-w-none',
        isDarkBg ? 'prose-invert' : '',
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
};

export { QuillContent };