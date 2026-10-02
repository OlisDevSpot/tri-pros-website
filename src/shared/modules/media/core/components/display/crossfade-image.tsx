'use client'

import type { OptimizedImageFile } from '@/shared/modules/media/core/components/display/optimized-image'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CROSSFADE_HOLD_MS, CROSSFADE_TRANSITION } from '@/shared/constants/motion'
import { OptimizedImage } from '@/shared/modules/media/core/components/display/optimized-image'
import { decodeImage } from '@/shared/modules/media/core/lib/decode-image'
import { getOptimizedSrc, getOptimizedSrcSet } from '@/shared/modules/media/core/lib/get-optimized-urls'

export type CrossfadeImageSource = { file: OptimizedImageFile } | { src: string }

interface CrossfadeImageProps {
  image: CrossfadeImageSource
  alt: string
  sizes: string
  /** Applied to the <img>: `object-cover` / `object-contain`. */
  className?: string
  persistBlur?: boolean
  priority?: boolean
}

interface ShownImage {
  image: CrossfadeImageSource
  alt: string
}

function imageKey(image: CrossfadeImageSource): string {
  return 'file' in image ? getOptimizedSrc(image.file) : image.src
}

function decode(image: CrossfadeImageSource, sizes: string): Promise<void> {
  if ('src' in image) {
    return decodeImage({ src: image.src })
  }
  const srcSet = getOptimizedSrcSet(image.file)
  return decodeImage({ src: getOptimizedSrc(image.file), srcSet, sizes: srcSet ? sizes : undefined })
}

/**
 * One image at a time, filling its positioned parent. A new image replaces the shown one with a
 * single crossfade once it is decoded, so the swap never lands on a blank or half-loaded frame; if
 * decoding outlasts the hold, it swaps anyway and the new image's blur placeholder sharpens in place.
 */
export function CrossfadeImage({ image, alt, sizes, className, persistBlur = false, priority = false }: CrossfadeImageProps) {
  const [shown, setShown] = useState<ShownImage>({ image, alt })
  const reduceMotion = useReducedMotion()
  const nextKey = imageKey(image)
  const shownKey = imageKey(shown.image)
  // Same image, fresher props (alt text, optimization status): render the live ones without a swap.
  const visible = nextKey === shownKey ? { image, alt } : shown

  // Read in the swap effect without making image/alt/sizes dependencies: Next 15's vendored React has no useEffectEvent yet.
  const latest = useRef({ image, alt, sizes })
  useLayoutEffect(() => {
    latest.current = { image, alt, sizes }
  })

  useEffect(() => {
    if (nextKey === shownKey) {
      return
    }
    let pending = true
    let timer: ReturnType<typeof setTimeout>
    const swap = () => {
      if (pending) {
        pending = false
        clearTimeout(timer)
        setShown({ image: latest.current.image, alt: latest.current.alt })
      }
    }
    timer = setTimeout(swap, CROSSFADE_HOLD_MS)
    // A failed decode (missing variant) swaps at once; OptimizedImage shows the broken image's own state.
    decode(latest.current.image, latest.current.sizes).then(swap, swap)
    return () => {
      pending = false
      clearTimeout(timer)
    }
  }, [nextKey, shownKey])

  const transition = reduceMotion ? { duration: 0 } : CROSSFADE_TRANSITION

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={shownKey}
        animate={{ opacity: 1 }}
        className="absolute inset-0"
        // The outgoing image stays opaque under the incoming one until that has fully faded in; fading
        // both at once lets the background show through mid-way (a quarter of the frame at the midpoint).
        exit={{ opacity: 0, transition: { duration: 0, delay: transition.duration } }}
        initial={{ opacity: 0 }}
        transition={transition}
      >
        {'file' in visible.image
          ? <OptimizedImage alt={visible.alt} className={className} fill file={visible.image.file} persistBlur={persistBlur} priority={priority} sizes={sizes} />
          : <Image alt={visible.alt} className={className} fill priority={priority} sizes={sizes} src={visible.image.src} />}
      </motion.div>
    </AnimatePresence>
  )
}
