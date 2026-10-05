'use client'

import type { ShowcaseMedia as ShowcaseMediaData } from '@/features/meeting-flow/types'
import { CrossfadeImage } from '@/shared/modules/media/core/components/display/crossfade-image'

interface ShowcaseMediaProps {
  media: ShowcaseMediaData
}

/** The scrim is tall and dense in the band layout (text sits on it) and short at two columns (only the caption). */
export function ShowcaseMedia({ media }: ShowcaseMediaProps) {
  return (
    <div className="absolute inset-0">
      <CrossfadeImage
        alt={media.caption}
        className="object-cover"
        image={media.kind === 'project' ? { file: media.file } : { src: media.photo.src }}
        priority
        sizes="(min-width: 1024px) 60vw, 100vw"
      />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-t from-(--presentation-ground) via-(--presentation-ground)/60 to-transparent @4xl/specialties:h-2/5 @4xl/specialties:from-black/55 @4xl/specialties:via-transparent" />
      <p className="absolute bottom-4 left-5 z-10 hidden text-sm text-white [text-shadow:0_1px_8px_rgb(0_0_0/0.6)] @4xl/specialties:block">
        {media.caption}
      </p>
    </div>
  )
}
