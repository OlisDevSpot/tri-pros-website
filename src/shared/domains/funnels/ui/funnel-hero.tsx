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

/**
 * Scroll-linked MotionValues handed down from the landing's single useScroll.
 *
 * The hero exits as a layered PARALLAX: the foreground group (card + Q1 + scrim)
 * LEADS — fades + lifts up faster — while the background photo TRAILS slower
 * (`photo*`). It all scrolls away in normal flow, so nothing collapses in place
 * and no dead container is left behind. see ../constants/funnel-motion.ts.
 */
export interface HeroScroll {
  /** Foreground content group (card + first-question) — fades fully (leads). */
  contentOpacity: MotionValue<number>
  /** Slight scale-down of the content group for depth. */
  contentScale: MotionValue<number>
  /** Upward lift of the content group, in px (leads the photo). */
  contentY: MotionValue<number>
  /** Radial legibility scrim — fades with the content (its own layer). */
  scrimOpacity: MotionValue<number>
  /** Background photo parallax drift (px DOWN — sinks/lags, revealing more image). */
  photoY: MotionValue<number>
  /** Subtle push-in zoom / perspective of the photo as it trails away. */
  photoScale: MotionValue<number>
}

/**
 * The offer-aligned landing band that frames the funnel's first question.
 *
 * Photo-forward "showcase" hero that reads BRIGHT, not as a dark island. The
 * brand photo runs full-bleed; legibility comes from a centered RADIAL SCRIM
 * (`.hero-scrim` / `--hero-scrim`) painted over the photo — near-opaque warm at
 * the core, feathering to transparent before the corners so the photo still
 * shows at the edges. The copy then rides a translucent warm card
 * (`--hero-plate` + ring + `--shadow-hero`) as a structural frame, with near-black
 * ink (`--foreground`, `--hero-ink-soft`) keeping senior-grade contrast (≈7:1+).
 * The scrim is a REAL gradient, not `backdrop-filter`: the card is transformed +
 * faded on scroll, and an animated layer forms a "backdrop root" that would sever
 * a `backdrop-filter` from the sibling photo (that was the weak-blur regression).
 * Accent words inherit `--accent-ink`. Refs: nngroup.com/articles/text-over-images.
 *
 * On wide containers (`@3xl`) the card hugs the left (`mr-auto max-w-*`) so the
 * raw photo shows clean on the right; on narrow ones it sits centered.
 *
 * Social proof (`HeroTrustBadges`: Google / Yelp / BBB) sits INSIDE the hero,
 * directly above the CTA — proof → ask, not ask → proof. The longer credential
 * chips stay below the hero (`TrustBar`). The funnel's one intentional DARK
 * moment now lives on the first question, not here.
 *
 * Responsive via `@container` (container queries), NOT viewport breakpoints, so
 * the hero adapts to its own rail width regardless of the surrounding layout.
 *
 * Scroll choreography (layered parallax scroll-away): the landing owns one
 * `useScroll` on this section and passes derived MotionValues via `scroll`. The
 * foreground group (card + Q1 + scrim) LEADS — fades fully + lifts up faster than
 * the scroll — while the background photo TRAILS slower with a subtle zoom. It all
 * scrolls away in normal flow, so nothing collapses in place and no dead container
 * is left behind (the marketing content below rises naturally). The slim sticky
 * header cross-fades in. Every animated value is compositor-only (opacity /
 * transform), never layout width/height. The photo layer is OVERSIZED vertically
 * so its parallax drift never reveals a gap. When `scroll` is absent (defensive)
 * the hero renders static. see ../constants/funnel-motion.ts
 *
 * Logo note: the `logo-light-*` variant is the COLORED artwork meant for LIGHT
 * backgrounds; we hardcode it here (the hero card is a bright surface) rather
 * than use the shared Logo component.
 *
 * Entry: `entryQuestion` (the funnel's first step) renders as a SIBLING of the
 * frosted plate — its own panel on the photo, below the content — so a first-time
 * visitor answers Q1 directly in the hero with no click to "start". It fades with
 * the hero on scroll. `onCta` is the legacy fallback (scroll-to-question) kept for
 * when no `entryQuestion` is supplied.
 */
export function FunnelHero({ content, entryQuestion, onCta, ref, scroll }: {
  content: HeroContent
  entryQuestion?: ReactNode
  onCta?: () => void
  ref?: Ref<HTMLElement>
  scroll?: HeroScroll | null
}) {
  // On wide containers the headline breaks at the em-dash into a clean two-line
  // lockup; on narrow ones it stays one logical string and wraps naturally.
  const [headLead, headTail] = content.headline.split(/\s+—\s+/)
  return (
    <section ref={ref} className="@container relative isolate overflow-hidden rounded-2xl shadow-(--shadow-hero)">
      {/* Photo layer — the lagging parallax layer. Oversized vertically
          (`-inset-y-32`) so its DOWNWARD drift never reveals a gap at the top
          edge; the section's own `overflow-hidden` clips the overflow. As you
          scroll, it sinks slower than the page (revealing more of the image) with
          a subtle zoom. Oversize must stay ≥ HERO_PHOTO_Y_PX. */}
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
      {/* Radial luminous scrim — the legibility layer (replaces backdrop-blur).
          Over the photo, under the content; fades with the hero on scroll. */}
      <motion.div
        aria-hidden="true"
        style={scroll ? { opacity: scroll.scrimOpacity } : undefined}
        className="hero-scrim pointer-events-none absolute inset-0"
      />
      {/* The whole content group is ONE motion layer: frosted plate + Q1 recede
          together (fade + scale + lift) so the plate's translucent background
          leaves WITH its contents — no empty ghost card. The two children share
          one `m` inset; the gap between them reveals a band of the photo, so the
          question reads as its own section sitting ON the image. */}
      <motion.div
        style={scroll ? { opacity: scroll.contentOpacity, scale: scroll.contentScale, y: scroll.contentY } : undefined}
        className="m-3 flex flex-col gap-4 will-change-[transform,opacity] @3xl:m-4"
      >
        {/* Warm content plate: a structural frame (fill + ring + shadow) riding on
            the radial scrim — legibility is the scrim's job, not backdrop-blur. */}
        <div className="flex flex-col gap-7 rounded-2xl bg-(--hero-plate) px-6 py-9 shadow-(--shadow-hero) ring-1 ring-(--hero-plate-ring) @3xl:px-11 @3xl:py-12">
          <div className="self-center">
            <Image src={LogoOnLight} alt="Tri Pros Remodeling" width={200} height={54} priority className="h-12 w-auto @3xl:h-14" />
          </div>
          <div className="flex flex-col items-center gap-5 text-center">
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
        </div>

        {/* First-question panel — a sibling sitting on the photo, inside the same
            receding group so it dissolves with the card. */}
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
      </motion.div>
    </section>
  )
}
