'use client'

import type { ReactNode } from 'react'
import { motion, useInView } from 'motion/react'
import { useRef } from 'react'
import { DRAW_X, VIEWPORT_MARGIN } from '@/features/landing/constants/experience-motion'
import { cn } from '@/shared/lib/utils'

interface EditorialEyebrowProps {
  children: ReactNode
  chapter?: string
  className?: string
}

export function EditorialEyebrow({ children, chapter, className }: EditorialEyebrowProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: VIEWPORT_MARGIN })

  return (
    <div
      className={cn(
        'inline-flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground',
        className,
      )}
    >
      <motion.span
        ref={ref}
        aria-hidden
        variants={DRAW_X}
        initial="hidden"
        animate={isInView ? 'visible' : 'hidden'}
        className="h-px w-8 bg-primary origin-left"
      />
      {chapter
        ? (
            <>
              <span className="text-primary font-serif italic normal-case text-sm tracking-normal lowercase">
                {chapter}
              </span>
              <span className="text-foreground/30">—</span>
            </>
          )
        : null}
      <span>{children}</span>
    </div>
  )
}
