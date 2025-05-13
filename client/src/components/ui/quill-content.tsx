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
      className={`prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
}