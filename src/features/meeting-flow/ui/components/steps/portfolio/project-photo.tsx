'use client'

import type { ProjectMediaFile } from '@/shared/db/schema'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { PORTFOLIO_COPY } from '@/features/meeting-flow/constants/portfolio-step'
import { SHOWCASE_CROSSFADE } from '@/features/meeting-flow/constants/showcase'
import { usePreloadPhoto } from '@/features/meeting-flow/hooks/use-preload-photo'
import { OptimizedImage } from '@/shared/components/optimized-image'

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
  const reduceMotion = useReducedMotion()

  return (
    <>
      <AnimatePresence initial={false}>
        <motion.div
          key={file.id}
          animate={{ opacity: 1 }}
          className="absolute inset-0"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          transition={reduceMotion ? { duration: 0 } : SHOWCASE_CROSSFADE}
        >
          <OptimizedImage alt={alt} className="object-cover" fill file={file} priority sizes="100vw" />
        </motion.div>
      </AnimatePresence>
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
