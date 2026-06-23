import type { FunnelContext, ReviewsBlockContent } from '@/shared/domains/funnels/types'
import { ReviewCard } from '@/shared/components/reviews/review-card'
import { testimonials } from '@/shared/constants/company'
import { Block } from '@/shared/domains/funnels/ui/block/block'

export function ReviewsBlock({ content }: { content: ReviewsBlockContent, ctx: FunnelContext }) {
  return (
    <Block surface="plain" align="center">
      <Block.Content>
        {content.label ? <Block.Headline>{content.label}</Block.Headline> : null}
        <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map(t => (
            <ReviewCard key={t.name} name={t.name} text={t.text} rating={t.rating} location={t.location} platform="Google" image={t.image} />
          ))}
        </div>
      </Block.Content>
    </Block>
  )
}
