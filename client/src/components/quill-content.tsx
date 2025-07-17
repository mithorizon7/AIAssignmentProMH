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
  
  // Check if content contains meaningful HTML tags (not just wrapped paragraphs)
  // Always treat content as HTML for consistent rendering
  const isHtmlContent = true;
  
  return (
    <div 
      className={cn(
        'prose prose-sm max-w-none',
        // Enhanced prose styling for better readability
        'prose-gray dark:prose-invert',
        'prose-headings:font-semibold prose-headings:text-foreground',
        'prose-p:text-muted-foreground prose-p:leading-relaxed',
        'prose-strong:text-foreground prose-strong:font-medium',
        'prose-em:text-muted-foreground prose-em:italic',
        'prose-ul:text-muted-foreground prose-ol:text-muted-foreground',
        'prose-li:text-muted-foreground prose-li:leading-relaxed',
        // Handle both HTML and plain text content
        isHtmlContent ? '' : 'whitespace-pre-wrap',
        isDarkBg ? 'prose-invert' : '',
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
};

export { QuillContent };