import type { MotionValue } from 'motion/react'
import type { Ref } from 'react'
import type { HeroContent } from '@/shared/domains/funnels/types'
import LogoDarkInk from '@public/company/logo/logo-light-right.svg'
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
 * Rendered as a defined hero card: a brand kitchen photo sits behind a light
 * token-based scrim (`from-card` → translucent) so the photo reads richer
 * toward the bottom while dark `text-foreground` copy stays fully legible up
 * top — the same inherited-color trap as the funnel-wide legibility fix.
 *
 * Scroll choreography: the engine owns one `useScroll` on this section and
 * passes derived MotionValues via `scroll`. The big logo fades + shrinks and
 * the text group fades + lifts as the hero scrolls past, while the slim sticky
 * header (mounted at the engine root) cross-fades in. When `scroll` is absent
 * (defensive) the hero renders static. Photo/scrims stay static (refined).
 *
 * Logo note: per repo convention the `logo-light-*` variant is the dark-ink
 * artwork meant for LIGHT backgrounds; the funnel is scoped-light, so we
 * hardcode it rather than use the shared Logo component (which switches on
 * `dark:` and would pick the white one).
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
    <section ref={ref} className="border-border relative isolate overflow-hidden rounded-xl border shadow-[0_24px_60px_-15px_rgb(15_23_42/0.35)]">
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
      {/* Knockdown: a dark tint over the photo (strongest toward the bottom,
          where the photo shows most) tames the bright kitchen so it reads as a
          richer backdrop instead of a glare that washes out the copy. */}
      <div className="absolute inset-0 -z-10 bg-linear-to-b from-transparent to-foreground/25" />
      {/* Legibility scrim: opaque at top (logo/headline), opening up toward the
          bottom so the (now-tamed) kitchen photo shows behind the CTA + padding. */}
      <div className="absolute inset-0 -z-10 bg-linear-to-b from-card via-card/92 to-card/50" />
      <div className="flex flex-col gap-6 px-6 py-12 sm:px-10 sm:py-14">
        <motion.div
          style={scroll ? { opacity: scroll.logoOpacity, scale: scroll.logoScale } : undefined}
          className="self-center sm:self-start"
        >
          <Image src={LogoDarkInk} alt="Tri Pros Remodeling" width={200} height={54} priority className="h-14 w-auto" />
        </motion.div>
        <motion.div
          style={scroll ? { opacity: scroll.textOpacity, y: scroll.textY } : undefined}
          className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center"
        >
          <h1 className="text-foreground text-balance font-serif text-3xl font-bold tracking-tight sm:text-4xl">
            {renderHighlightedHeadline(content.headline, content.highlightWords)}
          </h1>
          <p className="text-muted-foreground text-balance text-lg">{content.subhead}</p>
          <p className="text-foreground text-sm font-medium">{content.scarcityLine}</p>
          {onCta
            ? (
                <Button size="lg" onClick={onCta} className="mt-1 shadow-lg">
                  {content.ctaLabel ?? 'See if you qualify'}
                  <ArrowDown className="size-4" />
                </Button>
              )
            : null}
          {content.prompt ? <p className="text-muted-foreground text-sm">{content.prompt}</p> : null}
        </motion.div>
      </div>
    </section>
  )
}
