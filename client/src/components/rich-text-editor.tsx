import React, { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import CodeBlock from '@tiptap/extension-code-block'
import Code from '@tiptap/extension-code'
import Highlight from '@tiptap/extension-highlight'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Code as CodeIcon,
  Highlighter,
  Link as LinkIcon,
  AlignLeft,
  Heading1,
  Heading2,
  Quote,
  Undo,
  Redo,
} from 'lucide-react'

type RichTextEditorProps = {
  value: string | undefined
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  isDarkBg?: boolean
}

const RichTextEditor = ({
  value,
  onChange,
  placeholder = 'Start typing...',
  className,
  isDarkBg = false,
}: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      Code.configure({
        HTMLAttributes: {
          class: 'bg-muted rounded px-1 py-0.5 font-mono text-sm',
        },
      }),
      CodeBlock.configure({
        HTMLAttributes: {
          class: 'bg-muted rounded-md p-4 font-mono text-sm my-2',
        },
      }),
      Highlight.configure({
        HTMLAttributes: {
          class: 'bg-yellow-100 rounded px-1 py-0.5',
        },
      }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: cn(
          'min-h-32 max-h-96 overflow-y-auto prose prose-sm dark:prose-invert focus:outline-none p-4 rounded-md',
          isDarkBg ? 'prose-invert' : ''
        ),
        placeholder,
      },
    },
  })

  useEffect(() => {
    // Update content when value prop changes (for external updates)
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '')
    }
  }, [value, editor])

  if (!editor) {
    return null
  }

  const ToolbarButton = ({ onClick, icon, active = false, title }: any) => (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={cn('h-8 w-8', active && 'bg-muted')}
      title={title}
    >
      {icon}
    </Button>
  )

  return (
    <div
      className={cn(
        'border rounded-md flex flex-col',
        isDarkBg ? 'border-gray-700 bg-gray-800' : '',
        className
      )}
    >
      <div
        className={cn(
          'flex flex-wrap items-center p-1 gap-1 border-b',
          isDarkBg ? 'border-gray-700' : ''
        )}
      >
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          icon={<Bold className="h-4 w-4" />}
          active={editor.isActive('bold')}
          title="Bold"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          icon={<Italic className="h-4 w-4" />}
          active={editor.isActive('italic')}
          title="Italic"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          icon={<Heading1 className="h-4 w-4" />}
          active={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          icon={<Heading2 className="h-4 w-4" />}
          active={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          icon={<List className="h-4 w-4" />}
          active={editor.isActive('bulletList')}
          title="Bullet List"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          icon={<ListOrdered className="h-4 w-4" />}
          active={editor.isActive('orderedList')}
          title="Ordered List"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          icon={<CodeIcon className="h-4 w-4" />}
          active={editor.isActive('codeBlock')}
          title="Code Block"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          icon={<Highlighter className="h-4 w-4" />}
          active={editor.isActive('highlight')}
          title="Highlight"
        />
        <ToolbarButton
          onClick={() => {
            const url = window.prompt('URL')
            if (url) {
              editor.chain().focus().setLink({ href: url }).run()
            } else {
              editor.chain().focus().unsetLink().run()
            }
          }}
          icon={<LinkIcon className="h-4 w-4" />}
          active={editor.isActive('link')}
          title="Link"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          icon={<Quote className="h-4 w-4" />}
          active={editor.isActive('blockquote')}
          title="Quote"
        />
        <div className="ml-auto flex items-center">
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            icon={<Undo className="h-4 w-4" />}
            title="Undo"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            icon={<Redo className="h-4 w-4" />}
            title="Redo"
          />
        </div>
      </div>
      <EditorContent 
        editor={editor} 
        className={cn(
          'flex-1',
          isDarkBg ? 'bg-gray-900' : ''
        )}
      />
    </div>
  )
}

export { RichTextEditor }