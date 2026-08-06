'use client'

import type { MediaFile } from '@/shared/db/schema'
import { ProjectMediaManager } from './project-media-manager'

interface Props {
  projectId: string
  mediaFiles: MediaFile[]
  onUpdate: () => void
}

export function PhotosTabContent({ projectId, mediaFiles, onUpdate }: Props) {
  return (
    <ProjectMediaManager
      projectId={projectId}
      mediaFiles={mediaFiles}
      onUpdate={onUpdate}
    />
  )
}
