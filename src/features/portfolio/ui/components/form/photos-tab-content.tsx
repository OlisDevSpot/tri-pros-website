'use client'

import type { MediaFile } from '@/shared/db/schema'
import { SortableMediaManager } from '@/shared/components/portfolio/sortable-media-manager'

interface Props {
  projectId: string
  mediaFiles: MediaFile[]
  onUpdate: () => void
}

export function PhotosTabContent({ projectId, mediaFiles, onUpdate }: Props) {
  return (
    <SortableMediaManager
      projectId={projectId}
      mediaFiles={mediaFiles}
      onUpdate={onUpdate}
    />
  )
}
