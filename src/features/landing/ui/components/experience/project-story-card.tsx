'use client'

import type { ProjectStorySlide } from '@/features/landing/lib/experience-project-stories'
import { ArrowUpRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { DrawnUnderline } from './drawn-underline'

interface ProjectStoryCardProps {
  slide: ProjectStorySlide
  index: number
}

export function ProjectStoryCard({ slide, index }: ProjectStoryCardProps) {
  const slideNumber = String(index + 1).padStart(2, '0')

  return (
    <Link href={slide.href} className="block group h-full">
      <article className="grid grid-cols-1 lg:grid-cols-12 gap-0 bg-foreground/[0.02] border border-foreground/10 overflow-hidden">

        <div className="relative aspect-[16/10] sm:aspect-[3/2] lg:aspect-auto lg:col-span-7 overflow-hidden bg-card">
          <Image
            src={slide.imageUrl}
            alt={slide.imageAlt}
            fill
            sizes="(max-width: 1024px) 100vw, 60vw"
            className="object-cover transition-transform duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
          />
          <span
            aria-hidden
            className="absolute top-5 right-5 font-serif italic text-2xl text-background/90 mix-blend-difference invert"
          >
            {slideNumber}
          </span>
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent pointer-events-none" />
        </div>

        <div className="relative lg:col-span-5 flex flex-col items-center text-center lg:items-start lg:text-left justify-center p-8 sm:p-10 lg:p-12 xl:p-14 gap-6 lg:gap-8">

          <span
            aria-hidden
            className="pointer-events-none absolute -top-6 lg:top-2 left-1/2 -translate-x-1/2 lg:left-8 lg:translate-x-0 font-serif italic text-[10rem] lg:text-[14rem] leading-none text-primary/[0.07] select-none"
          >
            &ldquo;
          </span>

          <div className="relative inline-flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            <span aria-hidden className="h-px w-6 bg-primary" />
            <span>Project Story</span>
          </div>

          <blockquote className="relative font-serif italic text-xl sm:text-2xl leading-[1.4] text-foreground max-w-prose">
            {slide.quote}
          </blockquote>

          <div className="relative space-y-1">
            <div className="text-sm font-medium text-foreground tracking-wide">{slide.homeowner}</div>
            {slide.meta
              ? <div className="text-xs text-muted-foreground">{slide.meta}</div>
              : null}
          </div>

          <div className="relative pt-2">
            <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-foreground">
              <DrawnUnderline>View This Project</DrawnUnderline>
              <ArrowUpRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}
