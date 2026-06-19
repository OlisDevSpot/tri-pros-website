import type { FunnelContext, ReviewsBlockContent } from '@/shared/domains/funnels/types'
import { FaGoogle, FaYelp } from 'react-icons/fa'
import { PlatformBadge } from '@/shared/components/reviews/platform-badge'
import { ReviewCard } from '@/shared/components/reviews/review-card'
import { StarRating } from '@/shared/components/reviews/star-rating'
import { socials, stats, testimonials } from '@/shared/constants/company'

export function ReviewsBlock({ content }: { content: ReviewsBlockContent, ctx: FunnelContext }) {
  const googleHref = socials.find(s => s.name === 'google')?.href
  const yelpHref = socials.find(s => s.name === 'yelp')?.href
  const bbb = stats.find(s => s.label === 'BBB Rating')

  return (
    <section className="flex flex-col items-center gap-8 py-10">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <PlatformBadge platform="Google" href={googleHref} icon={<FaGoogle className="size-4" />}>
          <StarRating rating={content.rating} count={content.count} size={14} />
        </PlatformBadge>
        <PlatformBadge platform="Yelp" href={yelpHref} icon={<FaYelp className="size-4" />}>
          <span className="text-muted-foreground text-sm">Verified</span>
        </PlatformBadge>
        <PlatformBadge platform="BBB">
          <span className="text-foreground text-sm font-semibold">{bbb?.number ?? 'A+'}</span>
        </PlatformBadge>
      </div>
      <div className="grid w-full max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.map(t => (
          <ReviewCard
            key={t.name}
            name={t.name}
            text={t.text}
            rating={t.rating}
            location={t.location}
            platform="Google"
            image={t.image}
          />
        ))}
      </div>
    </section>
  )
}
