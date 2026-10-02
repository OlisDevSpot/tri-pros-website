'use client'

import type { ProjectMediaFile } from '@/shared/db/schema'
import { PORTFOLIO_COPY } from '@/features/meeting-flow/constants/portfolio-step'
import { usePreloadPhoto } from '@/features/meeting-flow/hooks/use-preload-photo'
import { CrossfadeImage } from '@/shared/modules/media/core/components/display/crossfade-image'

interface ProjectPhotoProps {
  file: ProjectMediaFile
  alt: string
  /** The photo Space shows next; fetched now so the crossfade never lands on a blank frame. */
  upcoming: ProjectMediaFile | null
  canAdvance: boolean
  onAdvance: () => void
}

export function ProjectPhoto({ file, alt, upcoming, canAdvance, onAdvance }: ProjectPhotoProps) {
  usePreloadPhoto(upcoming)

  return (
    <>
      <CrossfadeImage alt={alt} className="object-cover" image={{ file }} priority sizes="100vw" />
      {/* Empty overlay: a labelled button whose children are presentational would swallow the photo's own alt text from screen readers. */}
      <button
        aria-label={PORTFOLIO_COPY.nextPhoto}
        className="absolute inset-0 cursor-pointer outline-none focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white disabled:cursor-default"
        disabled={!canAdvance}
        type="button"
        onClick={onAdvance}
      />
    </>
  )
}
