'use client'

import type { ShowcaseMedia as ShowcaseMediaData } from '@/features/meeting-flow/types'
import { AnimatePresence, motion } from 'motion/react'
import Image from 'next/image'
import { SHOWCASE_CROSSFADE } from '@/features/meeting-flow/constants/showcase'
import { OptimizedImage } from '@/shared/components/optimized-image'

interface ShowcaseMediaProps {
  media: ShowcaseMediaData
}

/**
 * The stage photo. Keyed on the media key: a new photo fades in over the old one; the same key
 * never remounts (spec §4.4 budget: the image node changes only when the key changes). The scrim is
 * tall and dense in the band layout (text sits on it) and short at two columns (only the caption).
 */
export function ShowcaseMedia({ media }: ShowcaseMediaProps) {
  return (
    <div className="absolute inset-0">
      <AnimatePresence initial={false}>
        <motion.div
          key={media.key}
          animate={{ opacity: 1 }}
          className="absolute inset-0"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          transition={SHOWCASE_CROSSFADE}
        >
          {media.kind === 'project'
            ? <OptimizedImage alt={media.caption} className="object-cover" fill file={media.file} priority sizes="(min-width: 1024px) 60vw, 100vw" />
            : <Image alt={media.caption} className="object-cover" fill priority sizes="(min-width: 1024px) 60vw, 100vw" src={media.photo.src} />}
        </motion.div>
      </AnimatePresence>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-t from-(--presentation-ground) via-(--presentation-ground)/60 to-transparent @4xl/specialties:h-2/5 @4xl/specialties:from-black/55 @4xl/specialties:via-transparent" />
      <p className="absolute bottom-4 left-5 z-10 hidden text-[13px] text-white [text-shadow:0_1px_8px_rgb(0_0_0/0.6)] @4xl/specialties:block">
        {media.caption}
      </p>
    </div>
  )
}
