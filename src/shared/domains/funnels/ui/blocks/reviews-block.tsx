import type { FunnelContext, ReviewsBlockContent } from '@/shared/domains/funnels/types'
import { Star } from 'lucide-react'

export function ReviewsBlock({ content }: { content: ReviewsBlockContent, ctx: FunnelContext }) {
  const full = Math.round(content.rating)
  return (
    <section className="flex flex-col items-center gap-2 py-10 text-center">
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={i < full ? 'fill-primary text-primary size-5' : 'text-muted-foreground/40 size-5'} />
        ))}
      </div>
      <p className="text-lg font-semibold">
        {content.rating.toFixed(1)}
        ★
        {' '}
        {content.label ?? `from ${content.count}+ homeowners`}
      </p>
    </section>
  )
}
