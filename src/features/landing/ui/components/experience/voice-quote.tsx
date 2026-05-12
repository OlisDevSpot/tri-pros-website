'use client'

import { motion } from 'motion/react'
import { STAGGER_CHILD } from '@/features/landing/constants/experience-motion'

interface Testimonial {
  name: string
  project: string
  text: string
  location: string
}

interface VoiceQuoteProps {
  testimonial: Testimonial
}

export function VoiceQuote({ testimonial }: VoiceQuoteProps) {
  return (
    <motion.figure variants={STAGGER_CHILD} className="relative py-12 lg:py-16 first:pt-0 last:pb-0">
      <span
        aria-hidden
        className="absolute -top-2 left-0 font-serif italic text-7xl lg:text-8xl leading-none text-primary/20 select-none"
      >
        &ldquo;
      </span>

      <blockquote className="font-serif italic text-xl sm:text-2xl lg:text-3xl leading-[1.45] text-foreground pl-10 lg:pl-16">
        {testimonial.text}
      </blockquote>

      <figcaption className="mt-6 pl-10 lg:pl-16 flex items-center gap-4">
        <span aria-hidden className="h-px w-8 bg-primary shrink-0" />
        <div className="flex flex-col text-[11px] uppercase tracking-[0.2em]">
          <span className="text-foreground font-medium">{testimonial.name}</span>
          <span className="text-muted-foreground mt-1 normal-case tracking-normal text-xs">
            {testimonial.project}
            {' '}
            ·
            {' '}
            {testimonial.location}
          </span>
        </div>
      </figcaption>
    </motion.figure>
  )
}
