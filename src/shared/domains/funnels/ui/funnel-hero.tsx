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

/** Scroll-linked MotionValues handed down from the engine's single useScroll. */
export interface HeroScroll {
  textOpacity: MotionValue<number>
  textY: MotionValue<number>
  logoOpacity: MotionValue<number>
  logoScale: MotionValue<number>
}

/**
 * The offer-aligned landing band that frames the funnel's first question.
 *
 * Photo-forward "showcase" hero that reads BRIGHT, not as a dark island. The
 * brand photo runs full-bleed; the copy rides a translucent warm FROSTED CARD
 * (`--hero-plate` + `backdrop-blur-lg`) so the photo bleeds THROUGH the card,
 * softened, and frames it at the edges — while near-black ink (`--foreground`,
 * `--hero-ink-soft`) keeps senior-grade contrast (≈7:1+) without darkening the
 * image. This is the honest reconciliation of "show the photo" + "fully legible"
 * on a full-width mobile column: a faint wash loses to a photo's highlights, so
 * the text gets a real surface. Accent words inherit `--accent-ink` (brand blue
 * darkened for light surfaces). Promoted from the /test legibility study (V2).
 * Refs: nngroup.com/articles/text-over-images.
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
 * Scroll choreography: the engine owns one `useScroll` on this section and
 * passes derived MotionValues via `scroll`. The logo fades + shrinks and the
 * text group fades + lifts as the hero scrolls past, while the slim sticky
 * header (mounted at the engine root) cross-fades in. When `scroll` is absent
 * (defensive) the hero renders static. Photo/card stay static (refined).
 *
 * Logo note: the `logo-light-*` variant is the COLORED artwork meant for LIGHT
 * backgrounds; we hardcode it here (the hero card is a bright surface) rather
 * than use the shared Logo component.
 *
 * Entry: `entryQuestion` (the funnel's first step) renders IN PLACE OF the CTA,
 * so a first-time visitor answers Q1 directly in the hero — no click to "start".
 * It rides the same text group as the old CTA, so the scroll fade/lift
 * choreography is unchanged. `onCta` is the legacy fallback (scroll-to-question)
 * kept for when no `entryQuestion` is supplied.
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
      {content.media
        ? (
            <Image
              src={content.media.src}
              alt=""
              fill
              priority
              sizes="(max-width: 640px) 100vw, 1024px"
              className="-z-10 object-cover object-center @3xl:object-[75%_center]"
            />
          )
        : null}
      {/* Frosted warm card: the photo bleeds THROUGH (backdrop-blur) and frames
          the card (thin `m` inset all round); near-black ink on `--hero-plate`
          carries senior-grade contrast without darkening the image. Centered,
          full-width at every breakpoint (the card owns the photo). */}
      <div className="m-3 flex flex-col gap-7 rounded-2xl bg-(--hero-plate) px-6 py-9 ring-1 ring-(--hero-plate-ring) backdrop-blur-lg @3xl:m-4 @3xl:px-11 @3xl:py-12">
        <motion.div
          style={scroll ? { opacity: scroll.logoOpacity, scale: scroll.logoScale } : undefined}
          className="self-center"
        >
          <Image src={LogoOnLight} alt="Tri Pros Remodeling" width={200} height={54} priority className="h-12 w-auto @3xl:h-14" />
        </motion.div>
        <motion.div
          style={scroll ? { opacity: scroll.textOpacity, y: scroll.textY } : undefined}
          className="flex flex-col items-center gap-5 text-center"
        >
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
          {entryQuestion
            ? <div className="mt-1 w-full">{entryQuestion}</div>
            : onCta
              ? (
                  <FunnelCta onClick={onCta} className="mt-1 w-full @xs:w-auto">
                    {content.ctaLabel ?? 'See if you qualify'}
                    <ArrowDown className="size-4" />
                  </FunnelCta>
                )
              : null}
          {!entryQuestion && content.prompt
            ? <p className="text-sm font-medium text-(--hero-ink-muted)">{content.prompt}</p>
            : null}
        </motion.div>
      </div>
    </section>
  )
}
