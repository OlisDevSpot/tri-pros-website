'use client'

import type { MediaFile } from '@/shared/db/schema'
import { OptimizedImage } from '@/shared/components/optimized-image'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'

interface Props {
  file: MediaFile
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PhotoDetailDialog({ file, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{file.name}</DialogTitle>
        </DialogHeader>

        <div className="relative aspect-video overflow-hidden rounded-lg">
          <OptimizedImage
            file={file}
            alt={file.name}
            fill
            className="object-contain bg-muted"
            sizes="500px"
          />
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">MIME Type</dt>
          <dd className="text-foreground">{file.mimeType}</dd>

          <dt className="text-muted-foreground">Extension</dt>
          <dd className="text-foreground">{file.fileExtension}</dd>

          <dt className="text-muted-foreground">Phase</dt>
          <dd className="capitalize text-foreground">{file.phase}</dd>

          <dt className="text-muted-foreground">Sort Order</dt>
          <dd className="text-foreground">{file.sortOrder}</dd>

          <dt className="text-muted-foreground">Hero Image</dt>
          <dd className="text-foreground">{file.isHeroImage ? 'Yes' : 'No'}</dd>

          <dt className="text-muted-foreground">Path Key</dt>
          <dd className="truncate text-foreground text-xs" title={file.pathKey}>{file.pathKey}</dd>

          <dt className="text-muted-foreground">Created</dt>
          <dd className="text-foreground">
            {file.createdAt ? new Date(file.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
          </dd>
        </dl>
      </DialogContent>
    </Dialog>
  )
}
