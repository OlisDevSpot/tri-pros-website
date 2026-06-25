import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import type { TradeFacts } from '@/shared/domains/funnels/types'

/**
 * Component-free per-trade registry (a trade is 1:1 with a funnel). The single
 * source of a trade's display name, its Notion trade UUID, and its share/SEO
 * metadata. Server-only consumers — the page's `generateMetadata` and the OG
 * image route — read `.meta` from HERE, never from the funnel spec/registry: the
 * spec tree imports client step components, and pulling it into a server module
 * graph drags those (some lacking `'use client'`) along and 500s every funnel
 * page. This file must stay free of any component import.
 *
 * `Record<FunnelSlug, …>` is the completeness guard: omit a slug and tsc errors
 * here. `pixel.contentCategory` is measurement config and stays on the
 * FunnelSpec — it is NOT a trade fact. see ../DOCS.md#funnel-metadata
 *
 * Notion trade UUIDs verified 2026-06-18 against "All Construction Trades DB".
 */
export const TRADE_FACTS: Record<FunnelSlug, TradeFacts> = {
  'kitchens': {
    name: 'Kitchen Renovation',
    notionTradeId: '6240ca1b-548b-837d-a9c0-01acc1fb530a',
    meta: {
      title: 'Kitchen Remodels',
      description: 'AAA-grade kitchen remodels at a showcase price for Southern California homeowners. See if your home qualifies — licensed, bonded & insured.',
      ogHeadline: 'Get a AAA-grade kitchen remodel — at a Showcase price.',
      ogImage: '/portfolio-photos/modern-kitchen-1.jpeg',
    },
  },
  'bathrooms': {
    name: 'Bathroom Renovation',
    notionTradeId: '1290ca1b-548b-830d-a13c-01e4da06eb3d',
    meta: {
      title: 'Bathroom Remodels',
      description: 'Showcase-quality bathroom remodels at a showcase price across Southern California. See if your home qualifies — licensed, bonded & insured.',
      ogHeadline: 'A showcase bathroom remodel — at a Showcase price.',
      ogImage: '/portfolio-photos/modern-bathroom-1.jpeg',
    },
  },
  'complete-interior': {
    name: 'Complete Interior Remodel',
    notionTradeId: '9340ca1b-548b-83d5-b3cd-01b5cce9b199',
    meta: {
      title: 'Complete Interior Remodels',
      description: 'Whole-home interior remodels at a showcase price for SoCal homeowners. See if your home qualifies — licensed, bonded & insured.',
      ogHeadline: 'A complete-interior remodel — at a Showcase price.',
      ogImage: '/portfolio-photos/modern-staircase-1.jpeg',
    },
  },
}

export function getTradeFacts(slug: FunnelSlug): TradeFacts {
  return TRADE_FACTS[slug]
}
