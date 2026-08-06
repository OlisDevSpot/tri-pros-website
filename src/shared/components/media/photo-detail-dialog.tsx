'use client'

import type { ReactNode } from 'react'
import type { MediaItem } from './types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'

interface PhotoDetailDialogProps {
  item: MediaItem
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Owner-specific preview (project: public-bucket image variant with retry UI; proposal: presigned img/video/pdf). Defaults to a plain <img>. */
  renderPreview?: (item: MediaItem) => ReactNode
  /** Owner-specific `<dt>`/`<dd>` metadata rows. Fully DI: the owner supplies EVERY row in its
   *  preferred order (project reproduces the exact source row order). Omit to show only title + preview. */
  renderDetails?: (item: MediaItem) => ReactNode
}

export function PhotoDetailDialog({ item, open, onOpenChange, renderPreview, renderDetails }: PhotoDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
        </DialogHeader>

        <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
          {renderPreview
            ? renderPreview(item)
            // Owner-agnostic default preview; consumers inject an optimized renderer via renderPreview.
            : (
                <img src={item.url} alt={item.name} className="h-full w-full object-contain" />
              )}
        </div>

        {renderDetails && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {renderDetails(item)}
          </dl>
        )}
      </DialogContent>
    </Dialog>
  )
}
