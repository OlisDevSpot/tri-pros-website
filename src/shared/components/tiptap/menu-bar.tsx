import type { Editor } from '@tiptap/react'
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  HighlighterIcon,
  ItalicIcon,
  LockIcon,
  StrikethroughIcon,
  UnlockIcon,
} from 'lucide-react'
import { cn,

} from '@/shared/lib/utils'
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
          size="icon"
          variant="outline"
          type="button"
          onClick={toggleEditable}
          className={cn(
            'rounded-none',
            editor.isEditable ? 'bg-red-500/40' : editor.isActive('heading', { level: 1 }) ? 'is-active' : '',
          )}
        >
          {editor.isEditable ? <UnlockIcon /> : <LockIcon />}
        </Button>
        <Button
          size="icon"
          variant="outline"
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={cn(
            'rounded-none',
            editor.isActive('heading', { level: 1 }) ? 'is-active' : '',
          )}
        >
          <Heading1Icon />
        </Button>
        <Button
          size="icon"
          variant="outline"
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn(
            'rounded-none',
            editor.isActive('heading', { level: 2 }) ? 'is-active' : '',
          )}
        >
          <Heading2Icon />
        </Button>
        <Button
          size="icon"
          variant="outline"
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={cn(
            'rounded-none',
            editor.isActive('heading', { level: 3 }) ? 'is-active' : '',
          )}
        >
          <Heading3Icon />
        </Button>
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
        <Button
          size="icon"
          variant="outline"
          type="button"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={cn(
            'rounded-none',
            editor.isActive('highlight') ? 'is-active' : '',
          )}
        >
          <HighlighterIcon />
        </Button>
        <Button
          size="icon"
          variant="outline"
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={cn(
            'rounded-none',
            editor.isActive({ textAlign: 'left' }) ? 'is-active' : '',
          )}
        >
          <AlignLeftIcon />
        </Button>
        <Button
          size="icon"
          variant="outline"
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={cn(
            'rounded-none',
            editor.isActive({ textAlign: 'center' }) ? 'is-active' : '',
          )}
        >
          <AlignCenterIcon />
        </Button>
        <Button
          size="icon"
          variant="outline"
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={cn(
            'rounded-none',
            editor.isActive({ textAlign: 'right' }) ? 'is-active' : '',
          )}
        >
          <AlignRightIcon />
        </Button>
        <Button
          size="icon"
          variant="outline"
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={cn(
            'rounded-none',
            editor.isActive({ textAlign: 'justify' }) ? 'is-active' : '',
          )}
        >
          <AlignJustifyIcon />
        </Button>
      </div>
    </div>
  )
}
