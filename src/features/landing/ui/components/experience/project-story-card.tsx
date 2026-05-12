'use client'

import type { ProjectStorySlide } from '@/features/landing/lib/experience-project-stories'
import { ArrowUpRight } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { SLIDE_CONTENT_CHILD, SLIDE_CONTENT_STAGGER } from '@/features/landing/constants/experience-motion'
import { DrawnUnderline } from './drawn-underline'

interface ProjectStoryCardProps {
  slide: ProjectStorySlide
  index: number
  isActive?: boolean
}

export function ProjectStoryCard({ slide, index, isActive = true }: ProjectStoryCardProps) {
  const slideNumber = String(index + 1).padStart(2, '0')
  const prefersReduced = useReducedMotion()

  return (
    <Link href={slide.href} className="block group h-full">
      <article className="grid grid-cols-1 lg:grid-cols-12 gap-0 bg-foreground/[0.02] border border-foreground/[0.06] overflow-hidden transition-colors duration-500 hover:border-foreground/[0.12]">

        <div className="relative aspect-[3/2] lg:col-span-8 overflow-hidden bg-card">
          <Image
            src={slide.imageUrl}
            alt={slide.imageAlt}
            fill
            sizes="(max-width: 1024px) 100vw, 66vw"
            className="object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
          />
          <span
            aria-hidden
            className="absolute top-4 right-5 font-serif italic text-xl text-foreground/20 select-none"
          >
            {slideNumber}
          </span>
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background/30 via-transparent to-transparent pointer-events-none" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background/25 via-transparent to-transparent pointer-events-none opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        </div>

        <motion.div
          key={isActive ? `active-${index}` : `idle-${index}`}
          variants={prefersReduced ? undefined : SLIDE_CONTENT_STAGGER}
          initial={prefersReduced ? 'visible' : 'hidden'}
          animate={isActive ? 'visible' : 'hidden'}
          className="relative lg:col-span-4 flex flex-col items-center text-center lg:items-start lg:text-left justify-center px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-14 xl:px-12 xl:py-16 gap-5 lg:gap-7"
        >

          <span
            aria-hidden
            className="pointer-events-none absolute -top-4 lg:top-4 left-1/2 -translate-x-1/2 lg:left-6 lg:translate-x-0 font-serif italic text-[8rem] lg:text-[11rem] leading-none text-primary/[0.05] select-none"
          >
            &ldquo;
          </span>

          <motion.div variants={prefersReduced ? undefined : SLIDE_CONTENT_CHILD} className="relative inline-flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            <span aria-hidden className="h-px w-6 bg-primary" />
            <span>Project Story</span>
          </motion.div>

          <motion.blockquote variants={prefersReduced ? undefined : SLIDE_CONTENT_CHILD} className="relative font-serif italic text-lg sm:text-xl lg:text-2xl xl:text-[1.625rem] leading-[1.45] text-foreground/90 max-w-[28ch] line-clamp-4 lg:line-clamp-5">
            {slide.quote}
          </motion.blockquote>

          <motion.div variants={prefersReduced ? undefined : SLIDE_CONTENT_CHILD} className="relative space-y-0.5">
            <div className="text-sm font-medium text-foreground/80 tracking-wide">{slide.homeowner}</div>
            {slide.meta
              ? <div className="text-xs text-muted-foreground">{slide.meta}</div>
              : null}
          </motion.div>

          <motion.div variants={prefersReduced ? undefined : SLIDE_CONTENT_CHILD} className="relative pt-2">
            <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
              <DrawnUnderline>View This Project</DrawnUnderline>
              <ArrowUpRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          </motion.div>
        </motion.div>
      </article>
    </Link>
  )
}
