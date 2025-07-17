import React from "react";
import DOMPurify from "dompurify";

interface QuillContentProps {
  content: string;
  className?: string;
}

export function QuillContent({ content, className = "" }: QuillContentProps) {
  // Safely render HTML content from the Quill editor
  const sanitizedContent = DOMPurify.sanitize(content);
  
  return (
    <div 
      className={`prose prose-sm max-w-none prose-gray dark:prose-invert prose-headings:font-semibold prose-headings:text-foreground prose-p:text-muted-foreground prose-p:leading-relaxed prose-strong:text-foreground prose-strong:font-medium prose-em:text-muted-foreground prose-em:italic prose-ul:text-muted-foreground prose-ol:text-muted-foreground prose-li:text-muted-foreground prose-li:leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
}