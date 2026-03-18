# Services Pages Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize the `/services` section with nested pillar pages (energy efficiency + luxury renovations), individual trade pages, all dynamically sourced from Notion with ISR caching.

**Architecture:** Extend existing Notion service layer (Trade/ScopeOrAddon types + adapters) with slug and cover image fields. Build reusable page sections as individual components under `features/landing/`. Static content (copy, benefits, pairings) lives in `features/landing/constants/`. Route pages are thin wrappers that compose views. ISR with 3-minute revalidation + on-demand cache busting via agent-only refresh button.

**Tech Stack:** Next.js 15 App Router (RSC + ISR), tRPC, Notion API (`@notionhq/client`), Tailwind v4, shadcn/ui, motion/react, Zod

**Spec:** `docs/superpowers/specs/2026-03-18-services-pages-redesign.md`

---

## File Map

### New Files

| File | Responsibility |
|------|----------------|
| `src/shared/lib/slugify-trade-name.ts` | `slugifyTradeName()` — shared utility for trade slug derivation |
| `src/features/landing/lib/notion-trade-helpers.ts` | `getTradesByPillar()`, `getTradeBySlug()`, `TradeWithScopes` type, pillar-type mapping, cached Notion fetchers |
| `src/features/landing/constants/pillar-config.ts` | Per-pillar hero copy, stats, framing, default images, 3-step approach content |
| `src/features/landing/constants/trade-benefits.ts` | Per-trade benefit card definitions keyed by slug |
| `src/features/landing/constants/trade-pairings.ts` | Natural scope pairing definitions keyed by slug |
| `src/features/landing/constants/trade-outcome-statements.ts` | Outcome statements per trade keyed by slug |
| `src/features/landing/ui/components/services/services-hero.tsx` | Modernized hero with stats strip + CTAs |
| `src/features/landing/ui/components/services/pillar-card.tsx` | Primary pillar card (energy / luxury) |
| `src/features/landing/ui/components/services/pillar-card-secondary.tsx` | Deferred service card (commercial / design-build) |
| `src/features/landing/ui/components/services/swce-section.tsx` | S-W-C-E trust section (full + compact variants) |
| `src/features/landing/ui/components/services/comparison-table.tsx` | Licensed vs. cheap contractor table |
| `src/features/landing/ui/components/services/programs-teaser.tsx` | Programs CTA section with pillar-adaptive copy |
| `src/features/landing/ui/components/services/natural-pairings.tsx` | Scope pairings section |
| `src/features/landing/ui/components/services/project-approach.tsx` | 3-step process section |
| `src/features/landing/ui/components/services/notion-refresh-button.tsx` | Agent-only cache revalidation button |
| `src/features/landing/ui/components/services/trades-grid.tsx` | Trade cards grid for pillar pages |
| `src/features/landing/ui/components/services/trade-card.tsx` | Individual trade card |
| `src/features/landing/ui/components/services/trade-hero.tsx` | Trade page hero with breadcrumb |
| `src/features/landing/ui/components/services/trade-benefits.tsx` | Benefits section |
| `src/features/landing/ui/components/services/scopes-grid.tsx` | Scopes listing with addons subsection |
| `src/features/landing/ui/components/services/scope-card.tsx` | Individual scope card |
| `src/features/landing/ui/components/services/portfolio-proof.tsx` | Matching portfolio projects |
| `src/features/landing/ui/views/services-overview-view.tsx` | Overview page orchestrator (replaces existing) |
| `src/features/landing/ui/views/pillar-view.tsx` | Shared pillar page view |
| `src/features/landing/ui/views/trade-view.tsx` | Shared trade page view |
| `src/app/(frontend)/(site)/services/energy-efficient-construction/page.tsx` | Energy pillar route |
| `src/app/(frontend)/(site)/services/energy-efficient-construction/[tradeSlug]/page.tsx` | Energy trade route |
| `src/app/(frontend)/(site)/services/luxury-renovations/page.tsx` | Luxury pillar route |
| `src/app/(frontend)/(site)/services/luxury-renovations/[tradeSlug]/page.tsx` | Luxury trade route |

> **Note on `export default`:** Next.js App Router requires `export default` for `page.tsx`, `layout.tsx`, and `loading.tsx` files. This is the ONE exception to the project's "named exports only" rule. All non-route files must use named exports.

### Modified Files

| File | Changes |
|------|---------|
| `src/shared/services/notion/lib/trades/schema.ts` | Add `slug` and `coverImageUrl` fields |
| `src/shared/services/notion/lib/trades/adapter.ts` | Extract `page.cover` and compute slug |
| `src/trpc/routers/notion.router/index.ts` | Add `revalidateNotionCache` procedure |
| `src/shared/constants/nav-items/marketing.ts` | Update services nav subItems |
| `src/app/(frontend)/(site)/services/page.tsx` | Point to new `ServicesOverviewView` |

### Deleted Files (after implementation is stable)

| File | Reason |
|------|--------|
| `src/app/(frontend)/(site)/services/[serviceId]/page.tsx` | Replaced by nested pillar routes |
| `src/features/landing/ui/components/services/service-hero.tsx` | Replaced by `services-hero.tsx` |
| `src/features/landing/ui/components/services/services-list.tsx` | Replaced by pillar card layout |
| `src/features/landing/ui/components/services/services-list-scroll.tsx` | Replaced by pillar card layout |
| `src/features/landing/ui/components/services/service-card.tsx` | Replaced by `trade-card.tsx` |
| `src/features/landing/ui/views/services-view.tsx` | Replaced by `services-overview-view.tsx` |

---

## Task 1: Extend Trade Schema & Adapter

**Files:**
- Modify: `src/shared/services/notion/lib/trades/schema.ts`
- Modify: `src/shared/services/notion/lib/trades/adapter.ts`

- [ ] **Step 1: Add `slug` and `coverImageUrl` to Trade schema**

Open `src/shared/services/notion/lib/trades/schema.ts`. Add two new fields to the Zod schema:

```typescript
export const tradeSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  type: z.enum(['Energy Efficiency', 'General Construction', 'Structural / Functional']).optional(),
  homeOrLot: z.enum(['Home', 'Lot']).optional(),
  coverImageUrl: z.string().nullable().default(null),
  relatedScopes: z.array(z.string()).default([]),
})
```

- [ ] **Step 2: Create `slugifyTradeName` helper in shared**

Create `src/shared/lib/slugify-trade-name.ts` (in `shared/` so both the Notion adapter and landing feature can import it without violating import directionality rules):

```typescript
export function slugifyTradeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}
```

- [ ] **Step 3: Update `pageToTrade` adapter to compute slug and extract cover**

Open `src/shared/services/notion/lib/trades/adapter.ts`. Import `slugifyTradeName` from `@/shared/lib/slugify-trade-name`. Update the adapter:

```typescript
import { slugifyTradeName } from '@/shared/lib/slugify-trade-name'

export function pageToTrade(page: PageObjectResponse): Trade {
  const p = page.properties

  // Extract cover image URL
  let coverImageUrl: string | null = null
  if (page.cover) {
    if (page.cover.type === 'external') {
      coverImageUrl = page.cover.external.url
    } else if (page.cover.type === 'file') {
      coverImageUrl = page.cover.file.url
    }
  }

  const name = titleText(p, TRADE_PROPERTIES_MAP.name.label)

  const raw: Partial<Trade> = {
    id: page.id,
    name,
    slug: slugifyTradeName(name),
    homeOrLot: selectName<'Home' | 'Lot'>(p, TRADE_PROPERTIES_MAP.homeOrLot.label) ?? undefined,
    type: selectName(p, TRADE_PROPERTIES_MAP.type.label) ?? undefined,
    coverImageUrl,
    relatedScopes: relationIds(p, TRADE_PROPERTIES_MAP.relatedScopes.label),
  }

  const valid = tradeSchema.safeParse(raw)
  if (valid.success) return valid.data
  throw new Error(valid.error.message)
}
```

- [ ] **Step 4: Verify the build passes**

Run: `pnpm build` (or at minimum `pnpm lint`)
Expected: No type errors. The new fields are backward-compatible (slug is always derived, coverImageUrl defaults to null).

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/notion/lib/trades/schema.ts src/shared/services/notion/lib/trades/adapter.ts src/shared/lib/slugify-trade-name.ts
git commit -m "feat(notion): add slug and coverImageUrl to Trade schema and adapter"
```

---

## Task 2: Add Notion Data Fetching Helpers with Caching

**Files:**
- Modify: `src/features/landing/lib/notion-trade-helpers.ts`
- Reference: `src/shared/services/notion/dal/query-notion-database.ts`
- Reference: `src/shared/services/notion/lib/scopes/adapter.ts`

- [ ] **Step 1: Add pillar type mapping and cached fetch functions**

Extend `src/features/landing/lib/notion-trade-helpers.ts` with the cached fetch functions.

> **Important:** Before writing this code, check `src/shared/services/notion/constants/databases.ts` to confirm the exact database name keys used by `queryNotionDatabase`. The keys may be `'trades'` and `'scopes'` or longer names like `'allConstructionTrades'`. Use the correct keys from that file.

```typescript
import { unstable_cache } from 'next/cache'

import { queryNotionDatabase } from '@/shared/services/notion/dal/query-notion-database'
import { pageToScope } from '@/shared/services/notion/lib/scopes/adapter'
import { pageToTrade } from '@/shared/services/notion/lib/trades/adapter'

import type { ScopeOrAddon } from '@/shared/services/notion/lib/scopes/schema'
import type { Trade } from '@/shared/services/notion/lib/trades/schema'

export type PillarSlug = 'energy-efficient-construction' | 'luxury-renovations'

export type TradeWithScopes = Trade & {
  scopes: ScopeOrAddon[]
}

const PILLAR_TYPE_MAP: Record<PillarSlug, string[]> = {
  'energy-efficient-construction': ['Energy Efficiency'],
  'luxury-renovations': ['General Construction', 'Structural / Functional'],
}

export const getCachedTrades = unstable_cache(
  async () => {
    const raw = await queryNotionDatabase('trades', {
      sortBy: { property: 'name', direction: 'ascending' },
    })
    return raw ? raw.map(pageToTrade) : []
  },
  ['notion-trades'],
  { tags: ['notion-trades'], revalidate: 180 },
)

export const getCachedScopes = unstable_cache(
  async () => {
    const raw = await queryNotionDatabase('scopes')
    return raw ? raw.map(pageToScope) : []
  },
  ['notion-scopes'],
  { tags: ['notion-scopes'], revalidate: 180 },
)

export async function getTradesByPillar(pillarSlug: PillarSlug): Promise<TradeWithScopes[]> {
  const [allTrades, allScopes] = await Promise.all([getCachedTrades(), getCachedScopes()])

  const allowedTypes = PILLAR_TYPE_MAP[pillarSlug]
  const pillarTrades = allTrades.filter((t) => t.type && allowedTypes.includes(t.type))

  // Group scopes by relatedTrade ID
  const scopesByTrade = new Map<string, ScopeOrAddon[]>()
  for (const scope of allScopes) {
    const existing = scopesByTrade.get(scope.relatedTrade) ?? []
    existing.push(scope)
    scopesByTrade.set(scope.relatedTrade, existing)
  }

  return pillarTrades.map((trade) => ({
    ...trade,
    scopes: scopesByTrade.get(trade.id) ?? [],
  }))
}

export async function getTradeBySlug(
  pillarSlug: PillarSlug,
  tradeSlug: string,
): Promise<TradeWithScopes | null> {
  const trades = await getTradesByPillar(pillarSlug)
  return trades.find((t) => t.slug === tradeSlug) ?? null
}
```

- [ ] **Step 2: Verify the helpers compile**

Run: `pnpm lint`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/landing/lib/notion-trade-helpers.ts
git commit -m "feat(landing): add cached Notion trade/scope fetching with pillar mapping"
```

---

## Task 3: Add Revalidation Procedure to Notion Router

**Files:**
- Modify: `src/trpc/routers/notion.router/index.ts`

- [ ] **Step 1: Add `revalidateNotionCache` procedure**

Open `src/trpc/routers/notion.router/index.ts`. This file composes sub-routers via `createTRPCRouter`. Add the revalidation procedure as a top-level procedure alongside the sub-router merges. Read the existing file first to understand the composition pattern, then add:

```typescript
import { revalidateTag } from 'next/cache'
import { agentProcedure } from '@/trpc/init' // if not already imported

// Add to the createTRPCRouter call alongside the existing sub-router properties:
export const notionRouter = createTRPCRouter({
  // ... existing sub-routers (trades, scopes, contacts)
  revalidateNotionCache: agentProcedure.mutation(async () => {
    revalidateTag('notion-trades')
    revalidateTag('notion-scopes')
    return { success: true, revalidatedAt: new Date().toISOString() }
  }),
})
```

This is a single procedure added directly to the router composition — not a separate sub-router file. It uses `agentProcedure` so only authenticated agents can trigger it.

- [ ] **Step 2: Verify the build passes**

Run: `pnpm lint`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/trpc/routers/notion.router/index.ts
git commit -m "feat(notion): add agentProcedure for on-demand cache revalidation"
```

---

## Task 4: Create Static Content Constants

**Files:**
- Create: `src/features/landing/constants/pillar-config.ts`
- Create: `src/features/landing/constants/trade-benefits.ts`
- Create: `src/features/landing/constants/trade-pairings.ts`
- Create: `src/features/landing/constants/trade-outcome-statements.ts`

- [ ] **Step 1: Create `pillar-config.ts`**

This file contains all pillar-specific static copy — hero headlines, subheadlines, stats, default images, and the 3-step project approach.

```typescript
import type { PillarSlug } from '@/features/landing/lib/notion-trade-helpers'

type PillarStat = {
  value: string
  label: string
}

type ProjectApproachStep = {
  title: string
  description: string
}

type PillarPairing = {
  trade1Name: string
  trade1Slug: string
  trade2Name: string
  trade2Slug: string
  story: string
}

type PillarConfig = {
  title: string
  heroHeadline: string
  heroSubheadline: string
  stats: PillarStat[]
  defaultHeroImage: string
  emotionalDriver: string
  programsTeaserCopy: string
  projectApproach: ProjectApproachStep[]
  pairings: PillarPairing[]
}

export const pillarConfigs: Record<PillarSlug, PillarConfig> = {
  'energy-efficient-construction': {
    title: 'Energy-Efficient Construction',
    heroHeadline: 'Your Home Is Costing You More Than It Should',
    heroSubheadline: 'A complete energy envelope upgrade — insulation, HVAC, windows, solar, roofing — delivered by one contractor, in one mobilization, with compounding savings.',
    stats: [
      { value: '30–55%', label: 'Average Bill Reduction' },
      { value: '$3,200', label: 'In Federal Tax Credits' },
      { value: '6–18 mo', label: 'Typical Payback' },
    ],
    defaultHeroImage: '/services/energy-efficient-hero.jpg',
    emotionalDriver: 'loss-aversion',
    programsTeaserCopy: 'Federal and state programs are actively funding these upgrades. Caps apply annually — timing matters.',
    projectApproach: [
      { title: 'Discovery', description: 'We walk your home with you. We listen first, recommend second.' },
      { title: 'Tailored Proposal', description: 'A scope built around what you told us — not a cookie-cutter estimate.' },
      { title: 'Professional Installation', description: 'Licensed crews, proper permits, city inspection, workmanship warranty.' },
    ],
    pairings: [
      { trade1Name: 'Insulation', trade1Slug: 'attic-and-basement', trade2Name: 'HVAC', trade2Slug: 'hvac', story: 'Seal the envelope, upgrade the system. Your bills drop from both sides.' },
      { trade1Name: 'Roofing', trade1Slug: 'roof-and-gutters', trade2Name: 'Solar', trade2Slug: 'solar', story: 'A new roof is the ideal foundation for solar — one install, better ROI.' },
      { trade1Name: 'Windows', trade1Slug: 'windows-and-doors', trade2Name: 'Insulation', trade2Slug: 'attic-and-basement', story: 'Complete envelope sealing — the most cost-effective energy upgrade.' },
    ],
  },
  'luxury-renovations': {
    title: 'Luxury Renovations',
    heroHeadline: 'The Home You\'ve Always Wanted — Built to Last',
    heroSubheadline: 'Kitchens, bathrooms, flooring, additions, outdoor living, and more. Every project backed by a licensed team, proper permits, and a written warranty.',
    stats: [
      { value: '60–80%', label: 'Kitchen Remodel ROI' },
      { value: '520+', label: 'Projects Completed' },
      { value: '98%', label: 'Client Satisfaction' },
    ],
    defaultHeroImage: '/services/luxury-renovations-hero.jpg',
    emotionalDriver: 'pride-of-ownership',
    programsTeaserCopy: 'Exclusive monthly packages with preferred pricing, expedited scheduling, and a written workmanship warranty on every project.',
    projectApproach: [
      { title: 'Discovery', description: 'We walk your home with you. We listen first, recommend second.' },
      { title: 'Tailored Proposal', description: 'A scope built around what you told us — not a cookie-cutter estimate.' },
      { title: 'Professional Installation', description: 'Licensed crews, proper permits, city inspection, workmanship warranty.' },
    ],
    pairings: [
      { trade1Name: 'Bathroom', trade1Slug: 'bathroom-remodel', trade2Name: 'Flooring', trade2Slug: 'flooring', story: 'Updating the bathroom? The transition to new flooring in the hallway is natural and seamless.' },
      { trade1Name: 'Kitchen', trade1Slug: 'kitchen-remodel', trade2Name: 'Interior Paint', trade2Slug: 'patch-and-interior-paint', story: 'A remodeled kitchen paired with fresh paint transforms how the whole home feels.' },
      { trade1Name: 'ADU', trade1Slug: 'adu', trade2Name: 'Engineering & Plans', trade2Slug: 'engineering-plans-and-blueprints', story: 'From blueprints to finished unit — one team, one process.' },
    ],
  },
}
```

- [ ] **Step 2: Create `trade-outcome-statements.ts`**

Keyed by trade slug. Sourced from `docs/company/services-catalog.md` and `docs/proposal/scope-presentation.md`.

```typescript
export const tradeOutcomeStatements: Record<string, string> = {
  'hvac': 'Your system will use roughly half the energy of your current unit — and you\'ll be able to control it from your phone.',
  'roof-and-gutters': 'Your home will be fully protected from weather damage for the next 30 years — no more worrying about the next storm.',
  'windows-and-doors': 'No more drafts, no more noise from outside, and your home stays at a consistent temperature without your HVAC working overtime.',
  'attic-and-basement': 'You\'ll notice the comfort difference almost immediately — and most customers see their heating and cooling bills drop by 20–40%.',
  'solar': 'You\'re locking in your energy rate for 25 years while your neighbors keep paying whatever the utility charges.',
  'exterior-paint-stucco-and-siding': 'A refreshed exterior that protects your home from the elements and dramatically improves curb appeal.',
  'water-heating': 'Endless hot water on demand, with a unit that takes up a fraction of the space and uses significantly less energy.',
  'dryscaping': 'A beautiful, low-maintenance landscape that conserves water and enhances your outdoor living space.',
  'kitchen-remodel': 'A completely updated kitchen — dramatically improved functionality and the highest ROI of any home improvement.',
  'bathroom-remodel': 'A bathroom you\'ll love using every day — like moving into a new house, without moving.',
  'flooring': 'Updated aesthetics throughout your home with improved durability and ease of maintenance.',
  'addition': 'More space for your family without the cost and disruption of moving to a new home.',
  'exterior-upgrades-and-lot-layout': 'Expanded outdoor living space that increases your home value and daily enjoyment.',
  'interior-upgrades-and-home-layout': 'A modernized interior that transforms how your home looks and feels.',
  'patch-and-interior-paint': 'A refreshed, modernized appearance — high perceived value for relatively low investment.',
  'tile': 'Beautiful, durable tile work that elevates any space in your home.',
  'pool-remodel': 'A restored pool that becomes the centerpiece of your backyard again.',
  'adu': 'A complete accessory dwelling unit — from permits to finished space, handled by one team.',
  'fencing-and-gates': 'Enhanced privacy, security, and curb appeal for your property.',
  'garage': 'A functional, well-built garage that protects your vehicles and adds usable space.',
  'electricals': 'A modern, safe electrical system that supports your home\'s current and future needs.',
  'plumbing': 'Reliable plumbing that eliminates leaks, low pressure, and aging pipe concerns.',
  'foundation-and-crawl-space': 'Your home will be structurally stable, and when you go to sell it, it will pass inspection without any issues.',
  'hazardous-materials': 'A safe, clean home free from hidden health hazards — documented and certified.',
  'framing': 'Solid structural framing that forms the backbone of any construction project.',
  'engineering-plans-and-blueprints': 'Professional plans and blueprints that ensure your project is built to code from day one.',
}
```

- [ ] **Step 3: Create `trade-benefits.ts`**

Keyed by trade slug. Each trade gets 3-4 benefit objects. Sourced from `docs/company/services-catalog.md`.

```typescript
type TradeBenefit = {
  title: string
  description: string
}

export const tradeBenefits: Record<string, TradeBenefit[]> = {
  'hvac': [
    { title: 'Lower Utility Bills', description: 'High-SEER systems that cut heating and cooling costs dramatically' },
    { title: 'Consistent Comfort', description: 'Even temperatures throughout your home, every room, every season' },
    { title: 'Reduced Carbon Footprint', description: 'Energy-efficient units that are better for your home and the environment' },
    { title: 'Rebate Eligible', description: 'Qualifies for federal tax credits and utility company rebates' },
  ],
  'roof-and-gutters': [
    { title: 'Weather Protection', description: 'Complete protection from rain, wind, and sun for decades' },
    { title: 'Energy Efficiency', description: 'Cool roof systems that reflect heat and reduce cooling costs' },
    { title: 'Curb Appeal', description: 'A new roof dramatically improves how your home looks from the street' },
    { title: 'Home Value', description: 'One of the highest-ROI improvements for resale' },
  ],
  'windows-and-doors': [
    { title: 'Lower Utility Bills', description: 'Reduced heat gain and loss through dual or triple-pane glass' },
    { title: 'Quieter Living Spaces', description: 'Significant noise reduction from outside' },
    { title: 'Enhanced Security', description: 'Modern frames and locking mechanisms' },
    { title: 'Consistent Comfort', description: 'No more drafts or hot spots near windows' },
  ],
  'attic-and-basement': [
    { title: 'Immediate Comfort', description: 'Notice the temperature difference the same day' },
    { title: '20–40% Bill Reduction', description: 'Significant heating and cooling cost savings' },
    { title: 'Eliminated Drafts', description: 'No more cold spots or inconsistent temperatures' },
    { title: 'Rebate Eligible', description: 'Qualifies for federal and utility rebate programs' },
  ],
  'solar': [
    { title: 'Eliminate Your Bill', description: 'Monthly electricity bill reduction or complete elimination' },
    { title: 'Fixed Energy Costs', description: 'Lock in your rate for 25+ years while utility rates rise' },
    { title: 'Federal Tax Credit', description: 'Significant ITC eligibility reduces total project cost' },
    { title: 'Increased Home Value', description: 'Solar adds measurable resale value' },
  ],
  'kitchen-remodel': [
    { title: 'Highest ROI', description: 'Kitchen remodels return 60–80% at resale — the best of any room' },
    { title: 'Daily Lifestyle Upgrade', description: 'A functional, beautiful kitchen transforms how you live' },
    { title: 'Modern Functionality', description: 'Soft-close cabinetry, quartz countertops, optimized layouts' },
  ],
  'bathroom-remodel': [
    { title: 'Daily Comfort', description: 'A space you enjoy using every single day' },
    { title: 'Resale Value', description: 'Updated bathrooms are the #1 thing buyers look for' },
    { title: 'Modern Aesthetic', description: 'Frameless glass, modern tile, premium fixtures' },
  ],
  'flooring': [
    { title: 'Whole-Home Transformation', description: 'New floors change how every room looks and feels' },
    { title: 'Durability', description: 'Materials that stand up to daily life for years' },
    { title: 'Easy Maintenance', description: 'Modern flooring options that are simple to clean and maintain' },
  ],
  // Remaining trades will use a generic fallback — empty array means hide benefits section
}
```

- [ ] **Step 4: Create `trade-pairings.ts`**

Keyed by trade slug. Sourced from `docs/proposal/scope-presentation.md`.

```typescript
import type { PillarSlug } from '@/features/landing/lib/notion-trade-helpers'

type TradePairing = {
  pairedTradeSlug: string
  pairedTradeName: string
  pillarSlug: PillarSlug
  story: string
}

export const tradePairings: Record<string, TradePairing[]> = {
  'hvac': [
    { pairedTradeSlug: 'attic-and-basement', pairedTradeName: 'Insulation', pillarSlug: 'energy-efficient-construction', story: 'Sealing the envelope and upgrading the system — your energy bills drop dramatically both ways.' },
    { pairedTradeSlug: 'windows-and-doors', pairedTradeName: 'Windows & Doors', pillarSlug: 'energy-efficient-construction', story: 'Your new system won\'t have to fight through drafty windows — both upgrades work together.' },
  ],
  'roof-and-gutters': [
    { pairedTradeSlug: 'attic-and-basement', pairedTradeName: 'Insulation', pillarSlug: 'energy-efficient-construction', story: 'While the attic is open, we can upgrade insulation — one crew visit, compounding energy savings.' },
    { pairedTradeSlug: 'solar', pairedTradeName: 'Solar', pillarSlug: 'energy-efficient-construction', story: 'A new roof is the ideal foundation for solar — one installation sequence, better ROI.' },
  ],
  'attic-and-basement': [
    { pairedTradeSlug: 'hvac', pairedTradeName: 'HVAC', pillarSlug: 'energy-efficient-construction', story: 'Seal the envelope, upgrade the system. Your bills drop from both sides.' },
    { pairedTradeSlug: 'windows-and-doors', pairedTradeName: 'Windows & Doors', pillarSlug: 'energy-efficient-construction', story: 'Complete envelope sealing — the most cost-effective energy upgrade you can do.' },
  ],
  'windows-and-doors': [
    { pairedTradeSlug: 'attic-and-basement', pairedTradeName: 'Insulation', pillarSlug: 'energy-efficient-construction', story: 'Complete envelope sealing — the most cost-effective energy upgrade you can do.' },
    { pairedTradeSlug: 'hvac', pairedTradeName: 'HVAC', pillarSlug: 'energy-efficient-construction', story: 'Your new system won\'t have to fight through drafty windows — both upgrades work together.' },
  ],
  'solar': [
    { pairedTradeSlug: 'roof-and-gutters', pairedTradeName: 'Roof & Gutters', pillarSlug: 'energy-efficient-construction', story: 'A new roof is the ideal foundation for solar — one install, better ROI.' },
  ],
  'bathroom-remodel': [
    { pairedTradeSlug: 'flooring', pairedTradeName: 'Flooring', pillarSlug: 'luxury-renovations', story: 'Updating the bathroom? The transition to new flooring in the hallway is natural and seamless.' },
  ],
  'kitchen-remodel': [
    { pairedTradeSlug: 'patch-and-interior-paint', pairedTradeName: 'Interior Paint', pillarSlug: 'luxury-renovations', story: 'A remodeled kitchen paired with fresh paint transforms how the whole home feels.' },
    { pairedTradeSlug: 'flooring', pairedTradeName: 'Flooring', pillarSlug: 'luxury-renovations', story: 'New kitchen floors flow naturally into the rest of your home.' },
  ],
  'adu': [
    { pairedTradeSlug: 'engineering-plans-and-blueprints', pairedTradeName: 'Engineering & Plans', pillarSlug: 'luxury-renovations', story: 'From blueprints to finished unit — one team, one process.' },
  ],
  'flooring': [
    { pairedTradeSlug: 'bathroom-remodel', pairedTradeName: 'Bathroom Remodel', pillarSlug: 'luxury-renovations', story: 'As long as we\'re updating the bathroom, the transition to new flooring is natural and seamless.' },
  ],
}
```

- [ ] **Step 5: Verify all constants compile**

Run: `pnpm lint`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/landing/constants/pillar-config.ts src/features/landing/constants/trade-benefits.ts src/features/landing/constants/trade-pairings.ts src/features/landing/constants/trade-outcome-statements.ts
git commit -m "feat(landing): add static content constants for services pages"
```

---

## Task 5: Build Shared Reusable Components

**Files:**
- Create: All components listed in the file map under `services/`

This task creates the shared components used across multiple page types. Build them one at a time. Each component is a single file with named export, props interface in-file, no file-level constants (those are in `constants/`).

- [ ] **Step 1: Create `swce-section.tsx`**

The S-W-C-E trust section. Accepts `variant: 'full' | 'compact'`. Full shows 4 detailed cards. Compact shows 4 inline icon badges.

Reference the spec Section 5a "Why Tri Pros" for the full variant, and Section 5c.5 for the compact variant. Use shadcn `Card` for the full variant. Use Lucide icons: `Shield`, `Award`, `Hammer`, `TrendingUp` (or similar).

- [ ] **Step 2: Create `comparison-table.tsx`**

Static table with the exact rows from spec Section 5a. Use shadcn `Table` component. Use green checkmark / red X for visual clarity. Mobile: horizontally scrollable wrapper.

- [ ] **Step 3: Create `programs-teaser.tsx`**

Accepts `pillarType: 'energy' | 'luxury'`. Renders headline, pillar-adaptive copy, and CTA button linking to `/contact`. Use a gradient background section with `motion` fade-in.

- [ ] **Step 4: Create `natural-pairings.tsx`**

Accepts `pairings` prop (the `TradePairing[]` array). Renders 1-3 pairing cards, each with the paired trade name, story text, and a "Learn About [Trade]" link. Hides entirely if `pairings` is empty.

- [ ] **Step 5: Create `project-approach.tsx`**

Accepts `steps` prop from pillar config. Renders the 3-step process with numbered badges, titles, and descriptions. Use a horizontal layout on desktop, vertical on mobile.

- [ ] **Step 6: Create `notion-refresh-button.tsx`**

Client component (`'use client'`). Uses `useTRPC()` + `useMutation` to call `notionRouter.revalidateNotionCache`. Only renders when user role is `agent` or `super-admin` — import session from better-auth client. Shows `RefreshCw` icon from Lucide, spins during mutation, shows toast on success via sonner.

- [ ] **Step 7: Verify all components compile**

Run: `pnpm lint`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add src/features/landing/ui/components/services/swce-section.tsx src/features/landing/ui/components/services/comparison-table.tsx src/features/landing/ui/components/services/programs-teaser.tsx src/features/landing/ui/components/services/natural-pairings.tsx src/features/landing/ui/components/services/project-approach.tsx src/features/landing/ui/components/services/notion-refresh-button.tsx
git commit -m "feat(landing): add shared reusable components for services pages"
```

---

## Task 6: Build Overview Page Components & View

**Files:**
- Create: `services-hero.tsx`, `pillar-card.tsx`, `pillar-card-secondary.tsx`
- Create: `services-overview-view.tsx`
- Modify: `src/app/(frontend)/(site)/services/page.tsx`

- [ ] **Step 1: Create `services-hero.tsx`**

Server component. Hero section with:
- Background image with gradient overlay (reuse the `ViewportHero` + `TopSpacer` pattern from existing `service-hero.tsx`)
- Headline: "Your Home. Done Right. Backed Forever."
- Subheadline: "Licensed. Insured. Warranted. 520+ Southern California homes transformed."
- Stats strip: 4 stat boxes using company constants
- Two CTA buttons: primary → `/contact`, secondary → `/portfolio/projects`
- Motion entrance animations (staggered opacity + translateY)

- [ ] **Step 2: Create `pillar-card.tsx`**

Accepts: `title`, `description`, `tradePreview` (array of trade names), `href`, `pillarType`. Large card with gradient accent, trade name pills, and CTA button. Energy card uses blue/teal accent, luxury uses amber/warm accent.

- [ ] **Step 3: Create `pillar-card-secondary.tsx`**

Accepts: `title`, `description`, `href`. Smaller, simpler card for commercial and design-build. "Contact Us to Discuss" CTA.

- [ ] **Step 4: Create `services-overview-view.tsx`**

Server component. Composes all sections in order:
1. `ServicesHero`
2. Primary pillar cards section (2 cards)
3. Secondary pillar cards section (2 cards)
4. `SwceSection` (variant: 'full')
5. `ComparisonTable`
6. `ProgramsTeaser` (pillarType: 'energy' — use energy as default since it's the stronger pitch)
7. Reuse existing `ProcessOverview` from `@/features/landing/ui/components/about/process-overview`
8. Reuse existing `BottomCTA` from `@/shared/components/cta`

- [ ] **Step 5: Update `services/page.tsx` route to use new view**

Replace the existing page content to import and render `ServicesOverviewView`. Add static metadata:

```typescript
import { ServicesOverviewView } from '@/features/landing/ui/views/services-overview-view'

export const metadata = {
  title: 'Services | Tri Pros Remodeling',
  description: 'Licensed, insured, and warranted home improvement services in Southern California. Energy-efficient construction, luxury renovations, and more.',
}

// Next.js requires `export default` for page files — this is the one exception to named-exports-only
export default function ServicesPage() {
  return (
    <main className="h-full">
      <ServicesOverviewView />
    </main>
  )
}
```

Match the existing `<main className="h-full">` wrapper pattern from the current `services/page.tsx`.

- [ ] **Step 6: Run dev server and visually verify**

Run: `pnpm dev`
Navigate to: `http://localhost:3000/services`
Expected: New overview page renders with hero, pillar cards, S-W-C-E section, comparison table, programs teaser, process overview, and bottom CTA.

- [ ] **Step 7: Commit**

```bash
git add src/features/landing/ui/components/services/services-hero.tsx src/features/landing/ui/components/services/pillar-card.tsx src/features/landing/ui/components/services/pillar-card-secondary.tsx src/features/landing/ui/views/services-overview-view.tsx src/app/\(frontend\)/\(site\)/services/page.tsx
git commit -m "feat(landing): build modernized services overview page"
```

---

## Task 7: Build Pillar Page Components & Views

**Files:**
- Create: `trades-grid.tsx`, `trade-card.tsx`
- Create: `pillar-view.tsx`
- Create: `services/energy-efficient-construction/page.tsx`
- Create: `services/luxury-renovations/page.tsx`

- [ ] **Step 1: Create `trade-card.tsx`**

Accepts: `trade` (TradeWithScopes), `pillarSlug` (PillarSlug). Card showing: cover image (or fallback), trade name, outcome statement from `tradeOutcomeStatements`, scope count badge ("X services"), and a link to `/services/[pillarSlug]/[trade.slug]`. Hover effect with subtle scale/shadow transition.

- [ ] **Step 2: Create `trades-grid.tsx`**

Accepts: `trades` (TradeWithScopes[]), `pillarSlug` (PillarSlug). Responsive grid: 1 col mobile, 2 col tablet, 3 col desktop. Maps over trades and renders a `TradeCard` for each.

- [ ] **Step 3: Create `pillar-view.tsx`**

Server component. Accepts: `pillarSlug` (PillarSlug), `trades` (TradeWithScopes[]). Composes:
1. Pillar hero (inline in this view — full-width with gradient, headline/subheadline/stats from `pillarConfigs`)
2. `NotionRefreshButton` (top-right corner, agent-only)
3. `TradesGrid`
4. `SwceSection` (variant: 'full')
5. `ProjectApproach` (steps from `pillarConfigs`)
6. `NaturalPairings` — pass `pillarConfigs[pillarSlug].pairings` (the pillar-level pairings defined in `pillar-config.ts`)
7. `ComparisonTable`
8. `ProgramsTeaser` (pillarType based on pillarSlug)
9. Bottom CTA

- [ ] **Step 4: Create energy efficiency pillar route page**

Create `src/app/(frontend)/(site)/services/energy-efficient-construction/page.tsx`:

```typescript
import { PillarView } from '@/features/landing/ui/views/pillar-view'
import { getTradesByPillar } from '@/features/landing/lib/notion-trade-helpers'

export const revalidate = 180

export const metadata = {
  title: 'Energy-Efficient Construction | Tri Pros Remodeling',
  description: 'Complete energy envelope upgrades — HVAC, roofing, solar, windows, insulation — delivered by one licensed contractor with compounding savings.',
}

export default async function EnergyEfficiencyPillarPage() {
  const trades = await getTradesByPillar('energy-efficient-construction')
  return <PillarView pillarSlug="energy-efficient-construction" trades={trades} />
}
```

- [ ] **Step 5: Create luxury renovations pillar route page**

Create `src/app/(frontend)/(site)/services/luxury-renovations/page.tsx` — same pattern, different pillarSlug and metadata.

- [ ] **Step 6: Run dev server and visually verify both pillar pages**

Navigate to: `http://localhost:3000/services/energy-efficient-construction` and `/services/luxury-renovations`
Expected: Both pages render with trades grid populated from Notion, all shared sections visible.

- [ ] **Step 7: Commit**

```bash
git add src/features/landing/ui/components/services/trade-card.tsx src/features/landing/ui/components/services/trades-grid.tsx src/features/landing/ui/views/pillar-view.tsx src/app/\(frontend\)/\(site\)/services/energy-efficient-construction/page.tsx src/app/\(frontend\)/\(site\)/services/luxury-renovations/page.tsx
git commit -m "feat(landing): build pillar pages for energy efficiency and luxury renovations"
```

---

## Task 8: Build Trade Page Components & Views

**Files:**
- Create: `trade-hero.tsx`, `trade-benefits.tsx`, `scopes-grid.tsx`, `scope-card.tsx`, `portfolio-proof.tsx`
- Create: `trade-view.tsx`
- Create: `services/energy-efficient-construction/[tradeSlug]/page.tsx`
- Create: `services/luxury-renovations/[tradeSlug]/page.tsx`

- [ ] **Step 1: Create `trade-hero.tsx`**

Accepts: `trade` (TradeWithScopes), `pillarSlug` (PillarSlug), `outcomeStatement` (string). Renders: cover image hero with gradient, trade name, outcome statement, breadcrumb (Services → Pillar → Trade), CTA button.

Use shadcn `Breadcrumb` component if available, or build a simple one with Link components.

- [ ] **Step 2: Create `trade-benefits.tsx`**

Accepts: `benefits` (TradeBenefit[]). Renders 3-4 benefit cards in a responsive grid. Hides entirely if array is empty. Each card: icon (use a generic Lucide icon like `CheckCircle` or `Sparkles`), title, description.

- [ ] **Step 3: Create `scope-card.tsx`**

Accepts: `scope` (ScopeOrAddon). Renders: scope name, unit of pricing badge (small pill showing "per sqft", "per unit", etc.). Clean, simple card.

- [ ] **Step 4: Create `scopes-grid.tsx`**

Accepts: `scopes` (ScopeOrAddon[]). Splits into primary scopes (entryType === 'Scope') and addons (entryType === 'Addon'). Renders primary scopes grid, then a smaller "Available Add-Ons" subsection. Hides entirely if scopes array is empty.

- [ ] **Step 5: Create `portfolio-proof.tsx`**

Server component. Accepts: `tradeName` (string). Fetches public projects via the existing `getPublicProjects()` DAL function from `src/features/landing/dal/server/projects.ts`. Filters by `hoRequirements` containing `tradeName`. Limits to 3 results. Renders project cards with hero image, title, city. Hides entirely if no matches.

- [ ] **Step 6: Create `trade-view.tsx`**

Server component. Accepts: `trade` (TradeWithScopes), `pillarSlug` (PillarSlug). Composes:
1. `TradeHero` with outcome statement from `tradeOutcomeStatements[trade.slug]`
2. `NotionRefreshButton` (top-right corner, agent-only)
3. `TradeBenefits` with benefits from `tradeBenefits[trade.slug]` (skip if not defined)
4. `ScopesGrid` with `trade.scopes`
5. `NaturalPairings` with pairings from `tradePairings[trade.slug]` (skip if not defined)
6. `SwceSection` (variant: 'compact')
7. `ProgramsTeaser` (pillarType derived from pillarSlug)
8. `PortfolioProof` with `trade.name` — check `src/shared/db/schema/projects.ts` for the `hoRequirements` JSONB column shape to understand how to match trade names against it
9. Bottom CTA with trade-specific copy

- [ ] **Step 7: Create energy efficiency trade route page**

Create `src/app/(frontend)/(site)/services/energy-efficient-construction/[tradeSlug]/page.tsx`:

```typescript
import { notFound } from 'next/navigation'

import { getTradeBySlug, getTradesByPillar } from '@/features/landing/lib/notion-trade-helpers'
import { TradeView } from '@/features/landing/ui/views/trade-view'

export const revalidate = 180

export async function generateStaticParams() {
  const trades = await getTradesByPillar('energy-efficient-construction')
  return trades.map((trade) => ({ tradeSlug: trade.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ tradeSlug: string }> }) {
  const { tradeSlug } = await params
  const trade = await getTradeBySlug('energy-efficient-construction', tradeSlug)
  if (!trade) return {}
  return {
    title: `${trade.name} | Energy-Efficient Construction | Tri Pros Remodeling`,
    description: `Professional ${trade.name.toLowerCase()} services in Southern California. Licensed, insured, and backed by a written workmanship warranty.`,
  }
}

export default async function EnergyTradeDetailPage({ params }: { params: Promise<{ tradeSlug: string }> }) {
  const { tradeSlug } = await params
  const trade = await getTradeBySlug('energy-efficient-construction', tradeSlug)
  if (!trade) notFound()
  return <TradeView trade={trade} pillarSlug="energy-efficient-construction" />
}
```

- [ ] **Step 8: Create luxury renovations trade route page**

Same pattern for `src/app/(frontend)/(site)/services/luxury-renovations/[tradeSlug]/page.tsx` — swap pillar slug and metadata.

- [ ] **Step 9: Run dev server and visually verify trade pages**

Navigate to: `http://localhost:3000/services/energy-efficient-construction/hvac` and `/services/luxury-renovations/kitchen-remodel`
Expected: Full trade pages render with all sections. Empty sections (no benefits, no pairings, no portfolio) gracefully hidden.

- [ ] **Step 10: Commit**

```bash
git add src/features/landing/ui/components/services/trade-hero.tsx src/features/landing/ui/components/services/trade-benefits.tsx src/features/landing/ui/components/services/scopes-grid.tsx src/features/landing/ui/components/services/scope-card.tsx src/features/landing/ui/components/services/portfolio-proof.tsx src/features/landing/ui/views/trade-view.tsx src/app/\(frontend\)/\(site\)/services/energy-efficient-construction/\[tradeSlug\]/page.tsx src/app/\(frontend\)/\(site\)/services/luxury-renovations/\[tradeSlug\]/page.tsx
git commit -m "feat(landing): build individual trade pages with dynamic Notion data"
```

---

## Task 9: Update Navigation & Migrate Old Routes

**Files:**
- Modify: `src/shared/constants/nav-items/marketing.ts`
- Delete: `src/app/(frontend)/(site)/services/[serviceId]/page.tsx`
- Delete: `src/features/landing/ui/components/services/service-hero.tsx`
- Delete: `src/features/landing/ui/components/services/services-list.tsx`
- Delete: `src/features/landing/ui/components/services/services-list-scroll.tsx`
- Delete: `src/features/landing/ui/components/services/service-card.tsx`

- [ ] **Step 1: Update marketing nav items**

Open `src/shared/constants/nav-items/marketing.ts`. Read the file first — the nav may already have the correct structure with "Energy-Efficient Construction" and "Luxury Renovations" subItems. If so, only adjust the hrefs if they don't match. Update the Services section subItems to:
- Energy-Efficient Construction → `/services/energy-efficient-construction`
- Luxury Renovations → `/services/luxury-renovations`
- Commercial Construction → `/services/commercial` (or `/contact`)
- Design-Build → `/services/design-build` (or `/contact`)

Follow the existing pattern in the file for how subItems are structured.

- [ ] **Step 2: Delete old `[serviceId]` route**

```bash
rm src/app/\(frontend\)/\(site\)/services/\[serviceId\]/page.tsx
```

Check if the `[serviceId]` directory has any other files. If not, remove the directory too.

- [ ] **Step 3: Delete replaced components**

```bash
rm src/features/landing/ui/components/services/service-hero.tsx
rm src/features/landing/ui/components/services/services-list.tsx
rm src/features/landing/ui/components/services/services-list-scroll.tsx
rm src/features/landing/ui/components/services/service-card.tsx
rm src/features/landing/ui/views/services-view.tsx
```

- [ ] **Step 4: Search for broken imports**

Run: `pnpm lint` and check for any import errors referencing the deleted files. Fix any remaining references (likely in the old `services-view.tsx` which is now `services-overview-view.tsx`).

- [ ] **Step 5: Verify full build passes**

Run: `pnpm build`
Expected: Clean build with no errors. All routes resolve.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(landing): migrate to new services route structure, remove old components"
```

---

## Task 10: Final Verification & Polish

- [ ] **Step 1: Test all routes end-to-end**

Navigate through every page in the browser:
- `/services` — overview with 4 cards, S-W-C-E, comparison table, programs teaser
- `/services/energy-efficient-construction` — 8 trade cards, all sections
- `/services/energy-efficient-construction/hvac` — full trade page
- `/services/energy-efficient-construction/solar` — full trade page
- `/services/luxury-renovations` — 18 trade cards, all sections
- `/services/luxury-renovations/kitchen-remodel` — full trade page
- `/services/luxury-renovations/bathroom-remodel` — full trade page
- A trade with no scopes (e.g. `/services/luxury-renovations/framing`) — scopes grid hidden
- Navigation dropdown links work correctly

- [ ] **Step 2: Test mobile responsiveness**

Open Chrome DevTools, test at 375px, 768px, and 1280px widths. Verify:
- Stats strip stacks properly
- Trade grids collapse to fewer columns
- Comparison table scrolls horizontally on mobile
- All cards are full-width on mobile

- [ ] **Step 3: Test the refresh button (agent-only)**

Log in as an agent user. Verify the refresh button appears on pillar and trade pages. Click it. Verify toast appears. Verify that non-agent users do NOT see the button.

- [ ] **Step 4: Run lint and build**

```bash
pnpm lint && pnpm build
```

Expected: Both pass cleanly.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore(landing): final polish and verification for services pages redesign"
```
