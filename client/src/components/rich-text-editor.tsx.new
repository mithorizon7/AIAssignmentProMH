import React from 'react';
import { QuillEditor } from './quill-editor';

// This component is a wrapper around the QuillEditor component to maintain 
// compatibility with the existing RichTextEditor component
export function RichTextEditor(props: {
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  isDarkBg?: boolean;
}) {
  return (
    <QuillEditor
      value={props.value}
      onChange={props.onChange}
      placeholder={props.placeholder}
      className={props.className}
      isDarkBg={props.isDarkBg}
    />
  );
}