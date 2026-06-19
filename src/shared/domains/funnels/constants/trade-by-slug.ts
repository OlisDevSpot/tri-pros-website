import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'

/**
 * Funnel slug → Notion trade UUID (verified 2026-06-18 against "All Construction
 * Trades DB"). These are live Notion page IDs with no in-code source of truth —
 * the portfolio block warns + degrades to empty if a trade resolves to no projects.
 */
export const TRADE_BY_SLUG: Record<FunnelSlug, string> = {
  'kitchens': '6240ca1b-548b-837d-a9c0-01acc1fb530a',
  'bathrooms': '1290ca1b-548b-830d-a13c-01e4da06eb3d',
  'complete-interior': '9340ca1b-548b-83d5-b3cd-01b5cce9b199',
}
