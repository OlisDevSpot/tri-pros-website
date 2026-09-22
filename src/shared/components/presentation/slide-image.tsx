'use client'

import { motion } from 'motion/react'
import Image from 'next/image'
import { useSlideInView } from '@/shared/components/presentation/context'
import { IMAGE_SETTLE_VARIANTS } from '@/shared/components/presentation/motion'
import { cn } from '@/shared/lib/utils'

interface SlideImageProps {
  src: string
  alt: string
  /** The `sizes` hint: a `full` slide's photo spans the whole presentation, a `column` slide's only its own box (L7). */
  sizes: string
  /** Set on the first slide so its image is fetched eagerly. */
  priority?: boolean
  /** Position/size overrides for the wrapper (defaults to full bleed). */
  className?: string
  /** `object-position` and similar overrides for the image. */
  imageClassName?: string
}

/** Full-bleed photo that settles from a slight zoom when its slide comes into view. */
export function SlideImage({ src, alt, sizes, priority = false, className, imageClassName }: SlideImageProps) {
  const inView = useSlideInView()
  return (
    <motion.div
      animate={inView ? 'visible' : 'hidden'}
      className={cn('absolute inset-0', className)}
      initial={false}
      variants={IMAGE_SETTLE_VARIANTS}
    >
      <Image
        alt={alt}
        className={cn('object-cover', imageClassName)}
        draggable={false}
        fill
        priority={priority}
        sizes={sizes}
        src={src}
      />
    </motion.div>
  )
}
