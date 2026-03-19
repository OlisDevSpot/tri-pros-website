'use client'

import { HardDrive, Loader2, Monitor, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'

interface UploadSourcePopoverProps {
  isPickerLoading: boolean
  isUploading: boolean
  onGoogleDriveUpload: () => void
  onLocalUpload: () => void
}

export function UploadSourcePopover({
  isPickerLoading,
  isUploading,
  onGoogleDriveUpload,
  onLocalUpload,
}: UploadSourcePopoverProps) {
  const [open, setOpen] = useState(false)

  function handleLocalClick() {
    setOpen(false)
    onLocalUpload()
  }

  function handleDriveClick() {
    setOpen(false)
    onGoogleDriveUpload()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isUploading || isPickerLoading}
        >
          {isUploading || isPickerLoading
            ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            : <Plus className="mr-1.5 h-3.5 w-3.5" />}
          Upload
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="end">
        <button
          type="button"
          disabled={isUploading}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
          onClick={handleLocalClick}
        >
          <Monitor className="h-4 w-4 shrink-0" />
          From Computer
        </button>
        <button
          type="button"
          disabled={isUploading || isPickerLoading}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
          onClick={handleDriveClick}
        >
          <HardDrive className="h-4 w-4 shrink-0" />
          From Google Drive
        </button>
      </PopoverContent>
    </Popover>
  )
}
