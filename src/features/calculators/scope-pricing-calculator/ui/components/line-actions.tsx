'use client'

import { CopyIcon, Trash2Icon } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'

interface Props {
  onDuplicate: () => void
  onRemove: () => void
}

export function LineActions({ onDuplicate, onRemove }: Props) {
  return (
    <div className="flex justify-end gap-1">
      <Button aria-label="Duplicate line" className="size-11" onClick={onDuplicate} size="icon" type="button" variant="ghost">
        <CopyIcon />
      </Button>
      <Button aria-label="Remove line" className="size-11" onClick={onRemove} size="icon" type="button" variant="ghost">
        <Trash2Icon />
      </Button>
    </div>
  )
}
