'use client'

import DragHandle from '@tiptap/extension-drag-handle-react'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { EditorContent, useEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import { BoldIcon, ItalicIcon, StrikethroughIcon } from 'lucide-react'
import { useImperativeHandle } from 'react'
import { cn } from '@/shared/lib/utils'
import { SpinnerLoader2 } from '../loaders/spinner-loader-2'
import { Button } from '../ui/button'
import { TipTapMenuBar } from './menu-bar'

export interface TiptapHandle {
  appendHTML: (html: string) => void
  insertContent: (content: string) => void
  getHTML: () => string
}

interface Props {
  onChange: ({ html, json }: { html: string, json: any }) => void
  initialValues?: string
  isLoading?: boolean
  loadingMessage?: string
  ref?: React.RefObject<TiptapHandle | null>
}

export function Tiptap({ ref, onChange, initialValues, isLoading, loadingMessage }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign,
      Highlight.configure({
        multicolor: true,
      }),
    ],
    editorProps: {
      handleScrollToSelection: () => {
        return true
      },
    },
    // Don't render immediately on the server to avoid SSR issues
    immediatelyRender: false,
    content: initialValues,
    onUpdate: ({ editor }) => {
      onChange({
        html: editor.getHTML(),
        json: editor.getJSON(),
      })
    },
  })

  useImperativeHandle(ref, () => ({
    appendHTML: (html: string) => {
      if (!editor)
        return
      const endPos = editor.state.doc.content.size
      editor
        .chain()
        .setTextSelection(endPos)
        .focus(undefined, { scrollIntoView: false })
        .insertContent(html)
        .run()
    },
    insertContent: (content: string) => {
      if (!editor)
        return
      const endPos = editor.state.doc.content.size

      editor
        .chain()
        .setTextSelection(endPos)
        .focus(undefined, { scrollIntoView: false })
        .insertContent(content)
        .run()
    },
    getHTML: () => editor?.getHTML() ?? '',
    getJSON: () => editor?.getJSON() ?? {},
  }), [editor])

  if (!editor) {
    return null
  }

  return (
    <>
      <BubbleMenu className="bubble-menu" editor={editor}>
        <Button
          size="icon"
          variant="outline"
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(
            'rounded-none',
            editor.isActive('bold') ? 'is-active' : '',
          )}
        >
          <BoldIcon />
        </Button>
        <Button
          size="icon"
          variant="outline"
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(
            'rounded-none',
            editor.isActive('italic') ? 'is-active' : '',
          )}
        >
          <ItalicIcon />
        </Button>
        <Button
          size="icon"
          variant="outline"
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={cn(
            'rounded-none',
            editor.isActive('strike') ? 'is-active' : '',
          )}
        >
          <StrikethroughIcon />
        </Button>
      </BubbleMenu>
      <div className="tiptap w-full min-h-62.5 flex flex-col relative">
        <div className="min-h-10 w-full shrink-0">
          <TipTapMenuBar editor={editor} />
        </div>
        <DragHandle editor={editor}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
          </svg>
        </DragHandle>
        <EditorContent editor={editor} className="grow" />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-xs rounded-md z-10">
            <div className="flex items-center gap-2 text-muted-foreground">
              <SpinnerLoader2 />
              <span className="text-sm">{loadingMessage ?? 'Loading template...'}</span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
