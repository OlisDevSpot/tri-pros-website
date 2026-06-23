import type { CSSProperties } from 'react'
import type { CalloutBlockContent, FunnelContext } from '@/shared/domains/funnels/types'
import { ArrowRight } from 'lucide-react'
import Image from 'next/image'
import { CredentialStrip } from '@/shared/components/trust/credential-strip'
import { Block } from '@/shared/domains/funnels/ui/block/block'

const POINT_DOT_STYLE: CSSProperties = { background: 'var(--primary)' }
const POINT_TEXT_STYLE: CSSProperties = { color: 'var(--body-text)' }
const ARROW_STYLE: CSSProperties = { color: 'var(--primary)' }
const DEFAULT_IMAGE = { src: '/portfolio-photos/modern-kitchen-1.jpeg', alt: 'Remodeled Showcase kitchen' }

/**
 * "Blueprint Authority" financing callout — the canonical media block:
 * a cream content card floats over a full-bleed kitchen photo (brand-blue decor
 * riding the photo). Desktop = overlap composition; mobile = photo banner then
 * content. All width/surface/rhythm come from the shared <Block> shell.
 */
export function CalloutBlock({ content }: { content: CalloutBlockContent, ctx: FunnelContext }) {
  const image = content.image ?? DEFAULT_IMAGE
  return (
    <Block media="right" align="left">
      <Block.Content>
        <Block.Eyebrow>{content.eyebrow ?? 'Financing · in writing'}</Block.Eyebrow>
        <Block.Headline>{content.headline}</Block.Headline>
        <Block.Body>{content.body}</Block.Body>
        {content.points?.length
          ? (
              <ul className="flex flex-col gap-2">
                {content.points.map(point => (
                  <li key={point} className="flex items-center gap-2 text-[14.5px]" style={POINT_TEXT_STYLE}>
                    <span className="size-1.5 shrink-0 rotate-45 rounded-[1px]" style={POINT_DOT_STYLE} />
                    {point}
                  </li>
                ))}
              </ul>
            )
          : null}
        <Block.Trust><CredentialStrip /></Block.Trust>
        <Block.Actions>
          <button type="button" className="bg-foreground text-card inline-flex items-center gap-2.5 rounded-[3px] px-6 py-3.5 text-[14.5px] font-bold">
            {content.ctaLabel ?? 'See what you qualify for'}
            <ArrowRight className="size-4" style={ARROW_STYLE} />
          </button>
        </Block.Actions>
      </Block.Content>
      <Block.Media side="right">
        <Image src={image.src} alt={image.alt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
      </Block.Media>
    </Block>
  )
}
