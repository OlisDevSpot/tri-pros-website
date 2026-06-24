import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import type { FunnelMeta } from '@/shared/domains/funnels/types'

/**
 * Component-free funnel metadata registry. Server-only consumers — the page's
 * `generateMetadata` and the OG image route — read from HERE, never from the
 * funnel spec/registry. The spec tree imports client step components; pulling it
 * into a server module graph drags those (some lacking `'use client'`) along and
 * 500s every funnel page. This file must stay free of any component import.
 *
 * `Record<FunnelSlug, …>` is the completeness guard: omit a slug and tsc errors
 * here. see ../DOCS.md#funnel-metadata
 */
export const FUNNEL_META: Record<FunnelSlug, FunnelMeta> = {
  'kitchens': {
    title: 'Kitchen Remodels',
    description: 'AAA-grade kitchen remodels at a showcase price for Southern California homeowners. See if your home qualifies — licensed, bonded & insured.',
    ogHeadline: 'Get a AAA-grade kitchen remodel — at a Showcase price.',
    ogImage: '/portfolio-photos/modern-kitchen-1.jpeg',
  },
  'bathrooms': {
    title: 'Bathroom Remodels',
    description: 'Showcase-quality bathroom remodels at a showcase price across Southern California. See if your home qualifies — licensed, bonded & insured.',
    ogHeadline: 'A showcase bathroom remodel — at a Showcase price.',
    ogImage: '/portfolio-photos/modern-bathroom-1.jpeg',
  },
  'complete-interior': {
    title: 'Complete Interior Remodels',
    description: 'Whole-home interior remodels at a showcase price for SoCal homeowners. See if your home qualifies — licensed, bonded & insured.',
    ogHeadline: 'A complete-interior remodel — at a Showcase price.',
    ogImage: '/portfolio-photos/modern-staircase-1.jpeg',
  },
}

export function getFunnelMeta(slug: FunnelSlug): FunnelMeta {
  return FUNNEL_META[slug]
}
