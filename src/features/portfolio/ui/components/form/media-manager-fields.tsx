'use client'

import type { MediaFile } from '@/shared/db/schema'
import { ProjectMediaManager } from '@/shared/components/portfolio/project-media-manager'

interface Props {
  projectId: string
  mediaFiles: MediaFile[]
  onUpdate: () => void
}

export function MediaManagerFields({ projectId, mediaFiles, onUpdate }: Props) {
  return (
    <ProjectMediaManager
      projectId={projectId}
      mediaFiles={mediaFiles}
      onUpdate={onUpdate}
    />
  )
}
