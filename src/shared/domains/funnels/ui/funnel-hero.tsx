import type { HeroContent } from '@/shared/domains/funnels/types'
import LogoDarkInk from '@public/company/logo/logo-light-right.svg'
import Image from 'next/image'
import { renderHighlightedHeadline } from '@/shared/domains/funnels/lib/highlight-headline'

/**
 * The offer-aligned landing band that frames the funnel's first question.
 * Renders the dark-ink logo directly. Per the repo convention the `logo-light-*`
 * variant is the dark-ink artwork meant for LIGHT backgrounds (it's the one shown
 * under `dark:hidden`); the `logo-dark-*` variant is white, for dark backgrounds.
 * The funnel is scoped-light, so we hardcode the light variant rather than use the
 * shared Logo component, which switches on `dark:` and would pick the white one.
 */
export function FunnelHero({ content }: { content: HeroContent }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Image src={LogoDarkInk} alt="Tri Pros Remodeling" width={180} height={48} priority className="h-12 w-auto" />
      {content.media
        ? <Image src={content.media.src} alt={content.media.alt} width={640} height={360} priority className="h-auto w-full rounded-2xl object-cover" />
        : null}
      <h1 className="text-foreground text-balance font-serif text-3xl font-bold tracking-tight sm:text-4xl">
        {renderHighlightedHeadline(content.headline, content.highlightWords)}
      </h1>
      <p className="text-muted-foreground text-balance text-lg">{content.subhead}</p>
      <p className="text-primary text-sm font-medium">{content.scarcityLine}</p>
      {content.prompt ? <p className="text-muted-foreground mt-2 text-sm">{content.prompt}</p> : null}
    </div>
  )
}
