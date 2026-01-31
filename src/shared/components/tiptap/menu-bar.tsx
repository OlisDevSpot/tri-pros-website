import type { Editor } from '@tiptap/react'
import { Button } from '../ui/button'

interface Props {
  editor: Editor
}

export function TipTapMenuBar({ editor }: Props) {
  if (!editor) {
    return null
  }

  const toggleEditable = () => {
    editor.setEditable(!editor.isEditable)
    editor.view.dispatch(editor.view.state.tr)
  }

  return (
    <div>
      <div>
        <Button
          type="button"
          onClick={toggleEditable}
          className={editor.isEditable ? 'bg-red-500' : editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
        >
          Drag Handle
        </Button>
        <Button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
        >
          H1
        </Button>
        <Button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
        >
          H2
        </Button>
        <Button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}
        >
          H3
        </Button>
        <Button
          type="button"
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={editor.isActive('paragraph') ? 'is-active' : ''}
        >
          Paragraph
        </Button>
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
        <Button
          type="button"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={editor.isActive('highlight') ? 'is-active' : ''}
        >
          Highlight
        </Button>
        <Button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''}
        >
          Left
        </Button>
        <Button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''}
        >
          Center
        </Button>
        <Button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''}
        >
          Right
        </Button>
        <Button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={editor.isActive({ textAlign: 'justify' }) ? 'is-active' : ''}
        >
          Justify
        </Button>
      </div>
    </div>
  )
}
