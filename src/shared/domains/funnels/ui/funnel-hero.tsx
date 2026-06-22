import type { MotionValue } from 'motion/react'
import type { Ref } from 'react'
import type { HeroContent } from '@/shared/domains/funnels/types'
import LogoOnDark from '@public/company/logo/logo-dark-right.svg'
import { ArrowDown } from 'lucide-react'
import { motion } from 'motion/react'
import Image from 'next/image'
import { Button } from '@/shared/components/ui/button'
import { renderHighlightedHeadline } from '@/shared/domains/funnels/lib/highlight-headline'

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
 * Photo-forward "showcase" hero: the brand kitchen photo runs full-bleed and
 * vivid, with a genuine BLACK scrim over it (NOT a light cream tint — a
 * translucent cream wash over a photo's midtones produces muddy yellow-grey;
 * legibility comes from darken-and-go-light, never from a light wash). The
 * scrim is heaviest at the top (behind the logo + headline) and grounded at
 * the bottom (behind the CTA), so white copy clears contrast across the whole
 * text column while the photo still reads as a rich, moody backdrop. Accent
 * words inherit `text-primary` (brand blue) and pop against the dark.
 * Refs: nngroup.com/articles/text-over-images, smashingmagazine accessible-text-over-images.
 *
 * This is the funnel's one intentional dark moment; every content block below
 * stays on the light marketing theme.
 *
 * Scroll choreography: the engine owns one `useScroll` on this section and
 * passes derived MotionValues via `scroll`. The big logo fades + shrinks and
 * the text group fades + lifts as the hero scrolls past, while the slim sticky
 * header (mounted at the engine root) cross-fades in. When `scroll` is absent
 * (defensive) the hero renders static. Photo/scrims stay static (refined).
 *
 * Logo note: the `logo-dark-*` variant is the WHITE artwork meant for DARK
 * backgrounds; we hardcode it here (the hero is a dark island inside the
 * scoped-light funnel) rather than use the shared Logo component.
 *
 * `onCta` scrolls down to the embedded first question (the hero is above it).
 */
export function FunnelHero({ content, onCta, ref, scroll }: {
  content: HeroContent
  onCta?: () => void
  ref?: Ref<HTMLElement>
  scroll?: HeroScroll | null
}) {
  return (
    <section ref={ref} className="relative isolate overflow-hidden rounded-xl shadow-[0_30px_64px_-20px_rgb(0_0_0/0.55),0_12px_28px_-14px_rgb(0_0_0/0.4)]">
      {content.media
        ? (
            <Image
              src={content.media.src}
              alt=""
              fill
              priority
              sizes="(max-width: 640px) 100vw, 1024px"
              className="-z-20 object-cover"
            />
          )
        : null}
      {/* Base tint: tames the bright kitchen overall so it reads as a rich,
          moody backdrop rather than glare — vivid, not washed. */}
      <div className="absolute inset-0 -z-10 bg-neutral-950/45" />
      {/* Legibility scrim: a real BLACK gradient, heaviest at the top (logo +
          headline), grounded at the bottom (CTA + prompt), lighter through the
          middle so the photo breathes. This is what makes white copy clear
          contrast — darken-and-go-light, never a light tint over the photo. */}
      <div className="absolute inset-0 -z-10 bg-linear-to-b from-black/70 via-black/40 to-black/55" />
      <div className="flex flex-col gap-6 px-6 py-12 sm:px-10 sm:py-14">
        <motion.div
          style={scroll ? { opacity: scroll.logoOpacity, scale: scroll.logoScale } : undefined}
          className="self-center sm:self-start"
        >
          <Image src={LogoOnDark} alt="Tri Pros Remodeling" width={200} height={54} priority className="h-14 w-auto" />
        </motion.div>
        <motion.div
          style={scroll ? { opacity: scroll.textOpacity, y: scroll.textY } : undefined}
          className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center [text-shadow:0_1px_24px_rgb(0_0_0/0.35)]"
        >
          <h1 className="text-balance font-serif text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {renderHighlightedHeadline(content.headline, content.highlightWords)}
          </h1>
          <p className="text-balance text-lg text-white/85">{content.subhead}</p>
          <p className="text-sm font-medium text-white">{content.scarcityLine}</p>
          {onCta
            ? (
                <Button size="lg" onClick={onCta} className="mt-1 shadow-lg">
                  {content.ctaLabel ?? 'See if you qualify'}
                  <ArrowDown className="size-4" />
                </Button>
              )
            : null}
          {content.prompt ? <p className="text-sm text-white/70">{content.prompt}</p> : null}
        </motion.div>
      </div>
    </section>
  )
}
