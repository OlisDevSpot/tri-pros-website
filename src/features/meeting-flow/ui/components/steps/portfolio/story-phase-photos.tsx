'use client'

import type { ProjectMediaFile } from '@/shared/db/schema'
import { useEffect, useRef } from 'react'
import { OptimizedImage } from '@/shared/components/optimized-image'
import { cn } from '@/shared/lib/utils'

interface StoryPhasePhotosProps {
  photos: ProjectMediaFile[]
  photoIndex: number
  phaseLabel: string
  onSelect: (photoIndex: number) => void
}

export function StoryPhasePhotos({ photos, photoIndex, phaseLabel, onSelect }: StoryPhasePhotosProps) {
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [photoIndex, photos])

  if (photos.length < 2) {
    return null
  }
  return (
    <div className="flex gap-1.5 overflow-x-auto overscroll-contain pb-1">
      {photos.map((photo, index) => (
        <button
          key={photo.id}
          ref={index === photoIndex ? activeRef : undefined}
          aria-current={index === photoIndex ? 'true' : undefined}
          aria-label={`${phaseLabel} photo ${index + 1} of ${photos.length}`}
          className={cn(
            'relative h-12 w-16 shrink-0 overflow-hidden rounded-sm border-2 border-white/30 @5xl/portfolio:h-14 @5xl/portfolio:w-20',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
            index === photoIndex && 'border-white',
          )}
          type="button"
          onClick={() => onSelect(index)}
        >
          <OptimizedImage alt="" className="object-cover" fill file={photo} sizes="80px" />
        </button>
      ))}
    </div>
  )
}
