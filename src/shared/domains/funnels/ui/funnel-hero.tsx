import type { MotionValue } from 'motion/react'
import type { ReactNode, Ref } from 'react'
import type { HeroContent } from '@/shared/domains/funnels/types'
import LogoOnLight from '@public/company/logo/logo-light-right.svg'
import { ArrowDown } from 'lucide-react'
import { motion } from 'motion/react'
import Image from 'next/image'
import { renderHighlightedHeadline } from '@/shared/domains/funnels/lib/highlight-headline'
import { FunnelCta } from '@/shared/domains/funnels/ui/funnel-cta'
import { HeroTrustBadges } from '@/shared/domains/funnels/ui/hero-trust-badges'

export interface HeroScroll {
  contentOpacity: MotionValue<number>
  contentScale: MotionValue<number>
  /** px, negative = up. */
  contentY: MotionValue<number>
  /** px, positive = down. */
  photoY: MotionValue<number>
  photoScale: MotionValue<number>
}

/**
 * The scrim is a real gradient, not `backdrop-filter`: the plate is transformed on scroll, and an
 * animated layer forms a backdrop root that severs the filter from the sibling photo (weak-blur regression).
 * `@container`, not viewport breakpoints, so the hero adapts to its own rail width.
 * `logo-light-*` is hardcoded (colored artwork for light surfaces) instead of the shared Logo component.
 * Trust badges sit inside the hero, directly above the CTA: proof → ask, not ask → proof.
 */
export function FunnelHero({ content, entryQuestion, onCta, ref, scroll }: {
  content: HeroContent
  entryQuestion?: ReactNode
  onCta?: () => void
  ref?: Ref<HTMLElement>
  scroll?: HeroScroll | null
}) {
  const [headLead, headTail] = content.headline.split(/\s+—\s+/)
  return (
    <section ref={ref} className="@container relative isolate overflow-hidden rounded-2xl shadow-(--shadow-hero)">
      {/* Oversized vertically so the downward parallax drift never reveals a gap: `-inset-y-32` must stay ≥ HERO_PHOTO_Y_PX. */}
      {content.media
        ? (
            <motion.div
              style={scroll ? { y: scroll.photoY, scale: scroll.photoScale } : undefined}
              className="absolute inset-x-0 -inset-y-32 -z-10 will-change-transform"
            >
              <Image
                src={content.media.src}
                alt=""
                fill
                priority
                sizes="(max-width: 640px) 100vw, 1024px"
                className="object-cover object-center @3xl:object-[75%_center]"
              />
            </motion.div>
          )
        : null}
      <div className="m-3 flex flex-col gap-4 @3xl:m-4">
        {/* The scrim lives inside the plate (clipped by `overflow-hidden`) so it never washes over the Q1 panel or bare photo, and fades with the plate. */}
        <motion.div
          style={scroll ? { opacity: scroll.contentOpacity, scale: scroll.contentScale, y: scroll.contentY } : undefined}
          className="relative flex flex-col gap-7 overflow-hidden rounded-2xl bg-(--hero-plate) px-6 py-9 shadow-(--shadow-hero) ring-1 ring-(--hero-plate-ring) will-change-[transform,opacity] @3xl:px-11 @3xl:py-12"
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-(image:--hero-scrim)" />
          <div className="relative z-10 self-center">
            <Image src={LogoOnLight} alt="Tri Pros Remodeling" width={200} height={54} priority className="h-12 w-auto @3xl:h-14" />
          </div>
          <div className="relative z-10 flex flex-col items-center gap-5 text-center">
            <h1 className="text-foreground text-balance font-serif text-[2rem] leading-(--lh-headline) font-bold tracking-tight @3xl:text-5xl @5xl:text-6xl">
              {headTail
                ? (
                    <>
                      {renderHighlightedHeadline(`${headLead} — `, content.highlightWords)}
                      <br className="hidden @3xl:block" />
                      {renderHighlightedHeadline(headTail, content.highlightWords)}
                    </>
                  )
                : renderHighlightedHeadline(content.headline, content.highlightWords)}
            </h1>
            <p className="max-w-(--measure-prose) text-balance text-lg font-medium text-(--hero-ink-soft) @3xl:text-xl">{content.subhead}</p>
            {content.scarcityLine
              ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-(--hero-pill-border) bg-white px-3.5 py-1.5 text-sm font-semibold text-(--accent-ink) shadow-sm">
                    <span className="relative flex size-2">
                      <span className="bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-75" />
                      <span className="bg-primary relative inline-flex size-2 rounded-full" />
                    </span>
                    {content.scarcityLine}
                  </span>
                )
              : null}
            <HeroTrustBadges />
          </div>
        </motion.div>

        {/* Kept outside the scroll motion layer so the visitor can keep answering Q1 while the plate scrolls away. */}
        {entryQuestion
          ? (
              <div className="w-full">
                {entryQuestion}
              </div>
            )
          : onCta
            ? (
                <FunnelCta onClick={onCta} className="mx-auto w-full @xs:w-auto">
                  {content.ctaLabel ?? 'See if you qualify'}
                  <ArrowDown className="size-4" />
                </FunnelCta>
              )
            : null}
      </div>
    </section>
  )
}
