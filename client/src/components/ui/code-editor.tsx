import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  placeholder?: string;
  height?: string;
}

export function CodeEditor({ 
  value, 
  onChange, 
  language = "javascript", 
  placeholder = "// Enter your code here...",
  height = "300px" 
}: CodeEditorProps) {
  // For now, we're using a simple textarea with monospace font
  // In a real implementation, you might want to use a more sophisticated code editor
  // like Monaco Editor, CodeMirror, or Ace Editor
  
  return (
    <div className="border rounded-md overflow-hidden">
      <div className="bg-neutral-100 px-4 py-2 text-xs text-neutral-500 border-b">
        {language.charAt(0).toUpperCase() + language.slice(1)}
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="font-mono p-4 resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        style={{ height, minHeight: height }}
      />
    </div>
  );
}
