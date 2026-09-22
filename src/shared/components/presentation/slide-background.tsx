'use client'

import type { PresentationBackground, PresentationFrame } from '@/shared/components/presentation/types'
import { Scrim } from '@/shared/components/presentation/scrim'
import { SlideImage } from '@/shared/components/presentation/slide-image'

interface SlideBackgroundProps {
  background: PresentationBackground
  frame: PresentationFrame
  /** Fetch eagerly; set on the presentation's first slide. */
  priority?: boolean
}

/**
 * The photo behind a slide and the scrim that keeps its copy legible. A `full` slide's photo
 * spans the presentation; a `column` slide's fills only its own box beside the heading
 * column (C35), so `sizes` and the scrim follow the frame (L7, U9).
 */
export function SlideBackground({ background, frame, priority = false }: SlideBackgroundProps) {
  return (
    <>
      <SlideImage
        alt={background.alt}
        priority={priority}
        sizes={frame === 'full' ? '100vw' : '(min-width: 1024px) 62vw, 100vw'}
        src={background.src}
      />
      <Scrim variant={frame === 'full' ? 'center' : 'radial'} />
    </>
  )
}
