'use client'

import type { ReactNode } from 'react'
import type { SlideProps } from '@/shared/components/presentation/types'
import { useInView } from 'motion/react'
import { useCallback, useEffect, useRef } from 'react'
import { SlideInViewContext, usePresentation } from '@/shared/components/presentation/context'
import { Reveal } from '@/shared/components/presentation/reveal'
import { SlideBackground } from '@/shared/components/presentation/slide-background'

/** What `Slide` takes: a slide component's `SlideProps` minus the content, which arrives as children. */
interface SlideOwnProps extends Omit<SlideProps<unknown>, 'content'> {
  /** The content. On a `column` slide it is everything visible; on a `full` slide it follows the centred heading (reveal from order 2). */
  children?: ReactNode
}

/**
 * One slide: the snap target, the in-view report and the heading in its frame. The
 * <section> box is never transformed: snap areas are computed from the transformed border
 * box, so every reveal lives on an inner element. Rules: see ./DOCS.md#frames
 *
 * In view means crossing the presentation's centre line, not showing half its height.
 * Slides are contiguous, so exactly one crosses at a time, and a slide that never left the
 * view never needs to report again; a slide under a band, or taller than two screens, still
 * reports (spec C §4.5, review F2). See ./DOCS.md#active-slide
 *
 * Height and snap offset both read `--band-h`, which a run publishes only while its heading
 * column is a band; everywhere else, and on every `full` slide, it falls back to 0 (spec C
 * §4.2). The scroll margin is inline on purpose: it also overrides the global
 * `* { scroll-margin-top: 80px }` rule in `src/app/(frontend)/globals.css`, and inline it
 * cannot be lost to Tailwind's class-merge.
 *
 * `full`: the heading centres over the slide (C41), with `safe` centring so a screen too
 * short for the copy clips at the end, never the title (review F6); the accent is colour on
 * a plain line, never serif italic (U9). `column`: the heading shows in the run's column, so
 * the slide renders only a visually hidden <h2> that keeps the section labelled for
 * assistive tech (U1, review F10). `frame` arrives resolved from `groupSlides`; it is never
 * defaulted here.
 */
export function Slide({ index, id, frame, heading, background, children }: SlideOwnProps) {
  const ref = useRef<HTMLElement>(null)
  const { scrollerRef, reportInView, registerSlide } = usePresentation()
  const inView = useInView(ref, { root: scrollerRef, margin: '-50% 0px -50% 0px' })
  const headingId = `${id}-title`

  const setRef = useCallback((el: HTMLElement | null) => {
    ref.current = el
    registerSlide(index, el)
  }, [index, registerSlide])

  useEffect(() => {
    reportInView(index, inView)
  }, [index, inView, reportInView])

  return (
    <SlideInViewContext value={inView}>
      <section
        ref={setRef}
        aria-labelledby={headingId}
        className="relative min-h-[calc(100cqh-var(--band-h,0px))] snap-start snap-always overflow-hidden"
        id={id}
        style={{ scrollMarginTop: 'var(--band-h, 0px)' }}
      >
        {background && <SlideBackground background={background} frame={frame} priority={index === 0} />}
        {frame === 'full'
          ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center-safe gap-presentation-group px-[8cqw] pt-presentation-zone pb-[max(6cqh,var(--presentation-clear-b,0px))] text-center">
                <Reveal order={0}>
                  <h2 className="max-w-[18ch] font-sans text-presentation-display leading-[1.04] font-semibold tracking-tight text-balance" id={headingId}>
                    {heading.title}
                  </h2>
                </Reveal>
                {heading.subheading && (
                  <Reveal order={1}>
                    <p className="max-w-[40ch] text-presentation-lead text-balance text-white/85">
                      {heading.subheading.text}
                      {heading.subheading.accent && (
                        <>
                          {' '}
                          <span className="font-semibold text-(--presentation-accent)">{heading.subheading.accent}</span>
                        </>
                      )}
                    </p>
                  </Reveal>
                )}
                {children}
              </div>
            )
          : (
              <>
                <h2 className="sr-only" id={headingId}>{heading.title}</h2>
                {children}
              </>
            )}
      </section>
    </SlideInViewContext>
  )
}
