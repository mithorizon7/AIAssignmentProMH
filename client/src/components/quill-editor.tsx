import React, { useEffect, useRef, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { cn } from '@/lib/utils';

type QuillEditorProps = {
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  isDarkBg?: boolean;
  readOnly?: boolean;
};

// Define the toolbar options
const TOOLBAR_OPTIONS = [
  [{ 'header': [1, 2, 3, false] }],
  ['bold', 'italic', 'underline'],
  [{ 'list': 'ordered' }, { 'list': 'bullet' }],
  ['blockquote', 'code-block'],
  ['link'],
  [{ 'color': [] }, { 'background': [] }],
  ['clean'],
];

const QuillEditor: React.FC<QuillEditorProps> = ({
  value,
  onChange,
  placeholder = 'Start typing...',
  className,
  isDarkBg = false,
  readOnly = false,
}) => {
  const quillRef = useRef<ReactQuill>(null);
  const [internalValue, setInternalValue] = useState(value || '');

  // Update internal value when external value changes
  useEffect(() => {
    if (value !== internalValue) {
      setInternalValue(value || '');
    }
  }, [value]);

  // Handle internal changes and propagate them up
  const handleChange = (content: string) => {
    setInternalValue(content);
    onChange(content);
  };

  const modules = {
    toolbar: readOnly ? false : TOOLBAR_OPTIONS,
    clipboard: {
      matchVisual: false,
    },
  };

  return (
    <div 
      className={cn(
        'quill-container rounded-md',
        isDarkBg ? 'quill-dark-theme' : '',
        className
      )}
    >
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={internalValue}
        onChange={handleChange}
        placeholder={placeholder}
        modules={modules}
        readOnly={readOnly}
        className={cn(
          'min-h-[200px]',
          isDarkBg ? 'text-white' : ''
        )}
      />
    </div>
  );
};

export { QuillEditor };