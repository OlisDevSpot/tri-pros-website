import type { FunnelContext, TestimonialItem, TestimonialsBlockContent } from '@/shared/domains/funnels/types'

import { Star } from 'lucide-react'

import { testimonials } from '@/shared/constants/company/testimonials'

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
    <section className="flex flex-col gap-6 py-10">
      {content.title ? <h2 className="text-center text-2xl font-semibold">{content.title}</h2> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(item => (
          <figure key={item.name} className="border-border flex flex-col gap-3 rounded-xl border p-5">
            <div className="flex items-center gap-1">
              {Array.from({ length: item.rating }, (_, i) => (
                <Star key={i} className="fill-primary text-primary size-4" />
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
    </section>
  )
}
