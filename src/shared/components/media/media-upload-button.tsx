'use client'

import { HardDrive, Loader2, Plus, UploadIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'

interface MediaUploadButtonProps {
  onLocalUpload: () => void
  isUploading: boolean
  /** When provided, renders a popover with a second source option (e.g. Google Drive) alongside local upload. */
  onExtraUpload?: () => void
  /** e.g. 'From Google Drive'. */
  extraUploadLabel?: string
  isExtraUploadLoading?: boolean
}

export function MediaUploadButton({
  onLocalUpload,
  isUploading,
  onExtraUpload,
  extraUploadLabel = 'From another source',
  isExtraUploadLoading = false,
}: MediaUploadButtonProps) {
  const [open, setOpen] = useState(false)

  function handleLocalClick() {
    setOpen(false)
    onLocalUpload()
  }

  function handleExtraClick() {
    setOpen(false)
    onExtraUpload?.()
  }

  if (!onExtraUpload) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isUploading}
        onClick={onLocalUpload}
      >
        {isUploading
          ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          : <Plus className="mr-1.5 h-3.5 w-3.5" />}
        Upload
      </Button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isUploading || isExtraUploadLoading}
        >
          {isUploading || isExtraUploadLoading
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
          <UploadIcon className="h-4 w-4 shrink-0" />
          From this device
        </button>
        {/* Hidden on mobile — extra-source pickers (e.g. Google Drive) have known touch/navigation issues */}
        <button
          type="button"
          disabled={isUploading || isExtraUploadLoading}
          className="hidden sm:flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
          onClick={handleExtraClick}
        >
          <HardDrive className="h-4 w-4 shrink-0" />
          {extraUploadLabel}
        </button>
      </PopoverContent>
    </Popover>
  )
}
