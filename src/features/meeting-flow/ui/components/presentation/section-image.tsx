'use client'

import { motion } from 'motion/react'
import Image from 'next/image'
import { IMAGE_SETTLE_VARIANTS } from '@/features/meeting-flow/constants/presentation-motion'
import { useSectionInView } from '@/features/meeting-flow/contexts/presentation-context'
import { cn } from '@/shared/lib/utils'

interface SectionImageProps {
  src: string
  alt: string
  /** Set on the first section so its image is fetched eagerly. */
  priority?: boolean
  /** Position/size overrides for the wrapper (defaults to full bleed). */
  className?: string
  /** `object-position` and similar overrides for the image. */
  imageClassName?: string
}

/** Full-bleed photo that settles from a slight zoom when its section comes into view. */
export function SectionImage({ src, alt, priority = false, className, imageClassName }: SectionImageProps) {
  const inView = useSectionInView()
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
        sizes="(min-width: 1024px) 62vw, 100vw"
        src={src}
      />
    </motion.div>
  )
}
