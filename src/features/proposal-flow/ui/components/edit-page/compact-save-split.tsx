'use client'

import { ChevronDownIcon, SaveIcon } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  isLoading: boolean
  onSave: () => void
  onSaveAndPreview: () => void
}

export function CompactSaveSplit({ open, onOpenChange, isLoading, onSave, onSaveAndPreview }: Props) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={isLoading}
          aria-label="Save"
          className="inline-flex items-center gap-0.5 px-1.5 lg:hidden"
        >
          <SaveIcon className="size-3.5" />
          <ChevronDownIcon className="size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="end">
        <div className="flex flex-col">
          <Button type="button" variant="ghost" size="sm" className="justify-start" onClick={onSave}>Save</Button>
          <Button type="button" variant="ghost" size="sm" className="justify-start" onClick={onSaveAndPreview}>Save & Preview</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
