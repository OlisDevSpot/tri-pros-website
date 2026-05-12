'use client'

import { motion } from 'motion/react'
import Image from 'next/image'
import React from 'react'
import { TextWithLine } from '@/shared/components/text-with-line'
import { cn } from '@/shared/lib/utils'

interface Props {
  founderName: string
  founderImgSrc: string
  children: React.ReactNode
  flipOrder?: boolean
  /** When true, text column renders before portrait on all breakpoints (mobile included). */
  mobileTextFirst?: boolean
  isInView: boolean
  Quote?: () => React.ReactNode
}

export function FounderStory({
  founderName,
  flipOrder = false,
  mobileTextFirst = false,
  children,
  founderImgSrc,
  isInView,
  Quote,
}: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-8 lg:gap-16 items-stretch">
      {/* Portrait — stretches to match content column height on lg+ */}
      <motion.div
        initial={{ opacity: 0, x: flipOrder ? 40 : -40 }}
        animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: flipOrder ? 40 : -40 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          'relative h-80 sm:h-96 lg:h-full min-h-full overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/5 dark:ring-white/10 group',
          mobileTextFirst ? 'order-2' : flipOrder && 'lg:order-2',
        )}
      >
        {/*
          object-top anchors the crop to the upper edge so the face stays in
          view regardless of source aspect ratio — works for today's tall
          portraits and tomorrow's square / wider headshots without code changes.
        */}
        <Image
          src={founderImgSrc}
          alt={`${founderName} — founder portrait`}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover object-top grayscale-35 motion-safe:transition-all motion-safe:duration-700 group-hover:grayscale-0 motion-safe:group-hover:scale-[1.02]"
        />
        {/* Soft top-to-bottom gradient so the name plate is readable on any image */}
        <div className="absolute inset-0 bg-linear-to-t from-background/85 via-background/10 to-transparent" aria-hidden />

        {/* Architectural offset accent in the corner */}
        <div
          className={cn(
            'absolute top-4 h-12 w-12 border-t-2 border-l-2 border-secondary/70 pointer-events-none',
            flipOrder ? 'right-4 rotate-90' : 'left-4',
          )}
          aria-hidden
        />

        {/* Name plate */}
        <div className="absolute bottom-0 inset-x-0 p-5 sm:p-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-secondary font-semibold mb-1">
            Founder
          </p>
          <h3 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight whitespace-pre-line">
            {founderName}
          </h3>
        </div>
      </motion.div>

      {/* Story column */}
      <motion.div
        initial={{ opacity: 0, x: flipOrder ? -40 : 40 }}
        animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: flipOrder ? -40 : 40 }}
        transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className={cn('flex flex-col justify-center gap-6', mobileTextFirst ? 'order-1' : flipOrder && 'lg:order-1')}
      >
        <div className="space-y-4 text-foreground/85 leading-relaxed">
          <TextWithLine text="The Founder&apos;s Vision" />
          {children}
        </div>

        {Quote && <Quote />}
      </motion.div>
    </div>
  )
}
