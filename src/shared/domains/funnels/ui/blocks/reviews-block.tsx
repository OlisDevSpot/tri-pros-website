import type { FunnelContext, ReviewsBlockContent } from '@/shared/domains/funnels/types'
import { ReviewCard } from '@/shared/components/reviews/review-card'
import { testimonials } from '@/shared/constants/company'

export function ReviewsBlock({ content }: { content: ReviewsBlockContent, ctx: FunnelContext }) {
  return (
    <section className="flex flex-col items-center gap-6 py-10">
      {content.label ? <h2 className="text-foreground text-center text-2xl font-semibold">{content.label}</h2> : null}
      <div className="grid w-full max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.map(t => (
          <ReviewCard key={t.name} name={t.name} text={t.text} rating={t.rating} location={t.location} platform="Google" image={t.image} />
        ))}
      </div>
    </section>
  )
}
