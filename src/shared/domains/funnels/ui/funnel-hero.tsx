import type { HeroContent } from '@/shared/domains/funnels/types'
import Image from 'next/image'

/**
 * The offer-aligned landing band that frames the funnel's first question.
 * Rendered by the engine shell only while on step 1 (see funnel-engine.tsx).
 */
export function FunnelHero({ content }: { content: HeroContent }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {content.media
        ? (
            <Image
              src={content.media.src}
              alt={content.media.alt}
              width={640}
              height={360}
              priority
              className="h-auto w-full rounded-2xl object-cover"
            />
          )
        : null}
      <h1 className="text-balance text-3xl font-bold tracking-tight">{content.headline}</h1>
      <p className="text-muted-foreground text-balance text-lg">{content.subhead}</p>
      <p className="text-primary text-sm font-medium">{content.scarcityLine}</p>
      {content.prompt ? <p className="text-muted-foreground mt-2 text-sm">{content.prompt}</p> : null}
    </div>
  )
}
