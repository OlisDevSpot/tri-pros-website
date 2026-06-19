import type { HeroContent } from '@/shared/domains/funnels/types'
import LogoDarkInk from '@public/company/logo/logo-light-right.svg'
import { ArrowDown } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/shared/components/ui/button'
import { renderHighlightedHeadline } from '@/shared/domains/funnels/lib/highlight-headline'

/**
 * The offer-aligned landing band that frames the funnel's first question.
 *
 * Rendered as a defined hero card: a brand kitchen photo sits behind a light
 * token-based scrim (`from-card` → translucent) so the photo reads richer
 * toward the bottom while dark `text-foreground` copy stays fully legible up
 * top — the same inherited-color trap as the funnel-wide legibility fix.
 *
 * Logo note: per repo convention the `logo-light-*` variant is the dark-ink
 * artwork meant for LIGHT backgrounds (shown under `dark:hidden`); the
 * `logo-dark-*` variant is white, for dark backgrounds. The funnel is
 * scoped-light, so we hardcode the light variant rather than use the shared
 * Logo component, which switches on `dark:` and would pick the white one.
 *
 * `onCta` scrolls down to the embedded first question (the hero is above it).
 */
export function FunnelHero({ content, onCta }: { content: HeroContent, onCta?: () => void }) {
  return (
    <section className="border-border relative isolate overflow-hidden rounded-3xl border shadow-[0_24px_60px_-15px_rgb(15_23_42/0.35)]">
      {content.media
        ? (
            <Image
              src={content.media.src}
              alt=""
              fill
              priority
              sizes="(max-width: 640px) 100vw, 576px"
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
      <div className="flex flex-col items-center gap-4 px-6 py-12 text-center sm:px-10 sm:py-14">
        <Image src={LogoDarkInk} alt="Tri Pros Remodeling" width={200} height={54} priority className="h-14 w-auto" />
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
      </div>
    </section>
  )
}
