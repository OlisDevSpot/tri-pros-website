import type React from 'react'
import type { FunnelContext, MarketingRegistry, PortfolioBlockContent } from '@/shared/domains/funnels/types'
import dynamic from 'next/dynamic'
import { GuaranteeBlock } from '@/shared/domains/funnels/ui/blocks/guarantee-block'
import { LicensingBlock } from '@/shared/domains/funnels/ui/blocks/licensing-block'
import { ProblemBlock } from '@/shared/domains/funnels/ui/blocks/problem-block'
import { ReviewsBlock } from '@/shared/domains/funnels/ui/blocks/reviews-block'
import { TestimonialsBlock } from '@/shared/domains/funnels/ui/blocks/testimonials-block'

// Dynamic import: fetches live data and is below-the-fold, so lazy-load it.
// Cast is narrow — only this slot — to satisfy the mapped MarketingRegistry type,
// which expects ComponentType<{ content: PortfolioBlockContent, ctx: FunnelContext }>.
// (next/dynamic's return type doesn't parameterise props, mirroring the step-registry seam.)
const PortfolioBlock = dynamic(
  () => import('@/shared/domains/funnels/ui/blocks/portfolio-block').then(m => m.PortfolioBlock),
) as React.ComponentType<{ content: PortfolioBlockContent, ctx: FunnelContext }>

/** kind → block component. Typed by MarketingRegistry so each slot is checked against its kind. */
export const MARKETING_REGISTRY: MarketingRegistry = {
  guarantee: GuaranteeBlock,
  licensing: LicensingBlock,
  portfolio: PortfolioBlock,
  problem: ProblemBlock,
  reviews: ReviewsBlock,
  testimonials: TestimonialsBlock,
}
