import type { FunnelContext, TestimonialItem, TestimonialsBlockContent } from '@/shared/domains/funnels/types'

import { Star } from 'lucide-react'

import { testimonials } from '@/shared/constants/company/testimonials'
import { Block } from '@/shared/domains/funnels/ui/block/block'

const DEFAULT_ITEMS: TestimonialItem[] = testimonials.map(t => ({
  image: t.image,
  location: t.location,
  name: t.name,
  rating: t.rating,
  text: t.text,
}))

export function TestimonialsBlock({ content }: { content: TestimonialsBlockContent, ctx: FunnelContext }) {
  const items = content.items ?? DEFAULT_ITEMS
  return (
    <Block surface="plain" align="center">
      <Block.Content>
        {content.title ? <Block.Headline>{content.title}</Block.Headline> : null}
        <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(item => (
            <figure key={item.name} className="border-border bg-card flex flex-col gap-3 rounded-md border p-5 text-left shadow-sm">
              <div className="flex items-center gap-1">
                {Array.from({ length: item.rating }, (_, i) => (
                  <Star key={i} className="fill-yellow-500 text-yellow-500 size-4" />
                ))}
              </div>
              <blockquote className="text-sm">{item.text}</blockquote>
              <figcaption className="text-muted-foreground text-xs">
                {item.name}
                {' · '}
                {item.location}
              </figcaption>
            </figure>
          ))}
        </div>
      </Block.Content>
    </Block>
  )
}
