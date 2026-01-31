'use client'

import DragHandle from '@tiptap/extension-drag-handle-react'
import { EditorContent, useEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import { Button } from '../ui/button'
import { TipTapMenuBar } from './menu-bar'

function Tiptap() {
  const editor = useEditor({
    extensions: [StarterKit],
    // Don't render immediately on the server to avoid SSR issues
    immediatelyRender: false,
    autofocus: true,
  })

  return (
    <>
      {editor && (
        <BubbleMenu className="bubble-menu" editor={editor}>
          <Button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive('bold') ? 'is-active' : ''}
          >
            Bold
          </Button>
          <Button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive('italic') ? 'is-active' : ''}
          >
            Italic
          </Button>
          <Button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={editor.isActive('strike') ? 'is-active' : ''}
          >
            Strike
          </Button>
        </BubbleMenu>
      )}
      {editor && (
        <div className="w-full h-full min-h-62.5 flex flex-col">
          <div className="min-h-10 w-full shrink-0">
            <TipTapMenuBar editor={editor} />
          </div>
          <DragHandle editor={editor}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
            </svg>
          </DragHandle>
          <EditorContent editor={editor} className="grow" />
        </div>
      )}
    </>
  )
}

export default Tiptap
