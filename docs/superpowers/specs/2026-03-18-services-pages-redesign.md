# Services Pages Redesign — Design Spec

**Date**: 2026-03-18
**Status**: Draft
**Scope**: Modernize `/services` overview, new Energy Efficiency pillar page, new Luxury Renovations pillar page, individual trade pages

---

## 1. Overview

Redesign the public-facing `/services` section to reflect the professional nature of Tri Pros Remodeling's trade and scope offerings. Replace the current generic 4-card layout with a rich, psychologically-informed services experience that showcases energy efficiency and luxury renovation trades with their scopes, benefits, natural pairings, and trust signals.

### Goals

1. Present Tri Pros as the premium, trustworthy contractor — not the cheapest option
2. Use outcome-focused language grounded in customer emotional drivers (fear/risk aversion, loss aversion, pride of ownership, social proof, trust/safety)
3. Dynamically source trade and scope data from Notion (ISR, 3-minute revalidation)
4. Provide on-demand cache revalidation via refresh buttons on all Notion-sourced UI surfaces
5. Structure pages for SEO topic clustering via nested URL hierarchy

### Non-Goals

- Commercial Construction and Design-Build pillar pages (deferred — cards remain on overview)
- Exposing pricing publicly (reserved for in-home meetings)
- Exposing specific program details publicly (teaser only, CTA to schedule consultation)
- Per-trade FAQ sections, comparison tables, or "how we install" process sections (future enhancement)

---

## 2. Route Architecture

```
/services                                              → ServicesOverviewPage (modernized)
/services/energy-efficient-construction                → EnergyEfficiencyPillarPage
/services/energy-efficient-construction/[tradeSlug]    → TradePage
/services/luxury-renovations                           → LuxuryRenovationsPillarPage
/services/luxury-renovations/[tradeSlug]               → TradePage
/services/commercial                                   → deferred (keep existing card on overview)
/services/design-build                                 → deferred (keep existing card on overview)
```

All pages are statically generated at build time via `generateStaticParams`. ISR revalidation: `revalidate = 180` (3 minutes).

---

## 3. Trade-to-Pillar Mapping

### Energy Efficiency (8 trades)

| Trade | Scopes (from Notion) |
|---|---|
| HVAC | A/C replacement, furnace replacement, split system replacement, split system new-cut, package unit replacement, air ducts replacement, mini-split installation |
| Roof & Gutters | Roof tear-off, roof redeck, roof tile reset, roof torch down, fascia board replacement, gutters installation, roof tune up service |
| Windows & Doors | Window replacement, window installation (new), sliding door replacement, sliding door installation (new) |
| Attic & Basement | Attic insulation replacement, attic insulation top-off, attic fan installation, radiant barrier installation |
| Solar | Solar system installation, battery installation, solar system remove and reinstall |
| Exterior Paint, Stucco & Siding | Re-stucco, repaint w/ Cool Life (exterior), repaint w/ water-based (exterior), Texcote application, wood stain application (exterior) |
| Water Heating | Tankless installation |
| Dryscaping | Hardscaping, landscaping, mixed landscaping/hardscaping |

### Luxury Renovations (18 trades)

| Trade | Scopes (from Notion) |
|---|---|
| Kitchen Remodel | Full kitchen remodel, partial kitchen remodel, cabinets installation, cabinet refacing, cabinet re-finish, countertop replacement |
| Bathroom Remodel | Full bathroom remodel, partial bathroom remodel |
| Flooring | Flooring install (vinyl, tile, hardwood, engineered wood, laminate), flooring replacement |
| Addition | Room addition, second story addition, home extension, bath addition |
| Exterior Upgrades & Lot Layout | Deck/patio installation, patio cover installation, outdoor kitchen installation, driveway replacement, retaining wall installation, balcony upgrade |
| Interior Upgrades & Home Layout | Fireplace remodel, general interior remodeling |
| Patch & Interior Paint | Repaint (interior), drywall patch and paint, acoustic/popcorn ceiling removal |
| Tile | Tile work (interior), tile work (exterior) |
| Pool Remodel | New pool construction, pool retile/replaster |
| ADU | Garage conversion ADU, new construction ADU |
| Fencing & Gates | Fencing & gates upgrade |
| Garage | Garage full repair, garage partial repair, new garage build |
| Electricals | Ceiling fans installation, LED/recessed lights, main panel upgrade, re-wiring, recessed lights installation, replace outlets/switches/dimmers |
| Plumbing | Re-piping, gas shut off valve installation |
| Foundation & Crawl Space | Crawl space insulation installation |
| Hazardous Materials | Asbestos abatement, mold abatement & reconstruction, termite abatement |
| Framing | (no scopes currently) |
| Engineering, Plans & Blueprints | Architectural plans, ADU blueprints, 3D design |

---

## 4. Data Layer

### Relationship to Existing Types

The existing Notion service layer (`src/shared/services/notion/lib/trades/` and `scopes/`) already has `Trade` and `ScopeOrAddon` types with their own adapters (`pageToTrade`, `pageToScopeOrAddon`). **Do not create parallel types.** Instead, extend the existing types and adapters:

- Add a `slug` computed field to the existing `Trade` type (derived in the adapter, not stored in Notion)
- Add a `coverImageUrl` field to the existing `Trade` type, sourced from the **Notion page cover** (`page.cover.external.url` or `page.cover.file.url`)
- The existing `ScopeOrAddon` type already has `relatedTrade` — use this for grouping

### Notion Integration

Modify existing Notion tRPC procedures (in `src/trpc/routers/notion.router/`) to support:

1. **Fetching trades by pillar** — Query the "All Construction Trades DB" (ID: `6f00ca1b-548b-8279-9f2d-87f649413084`) filtered by `Type` select property:
   - **Energy Efficiency pillar**: `Type = 'Energy Efficiency'`
   - **Luxury Renovations pillar**: `Type IN ('General Construction', 'Structural / Functional')`
2. **Fetching scopes by trade** — Query the "All Construction Scopes and Addons DB" (ID: `ef70ca1b-548b-8226-b680-07fe8f00a91f`) filtered by `Trade` relation
3. **Single trade by slug** — Derive slug from trade name using a `slugify` helper

### Slug Derivation

The `slug` field is computed from `name` in the `pageToTrade` adapter. Rules:
- Lowercase
- `&` → `and`
- Spaces → `-`
- Strip all other special characters (commas, parentheses, slashes)
- Example: "Roof & Gutters" → "roof-and-gutters", "Exterior Paint, Stucco & Siding" → "exterior-paint-stucco-and-siding", "Engineering, Plans & Blueprints" → "engineering-plans-and-blueprints"

Implement as a `slugifyTradeName(name: string): string` function in `src/features/landing/lib/notion-trade-helpers.ts`.

### Fetch & Join Strategy

To avoid N+1 queries when building pillar pages:

1. Fetch all trades for a pillar type (single Notion query)
2. Fetch ALL scopes (single Notion query — ~90 items, small enough for one call)
3. Group scopes by `relatedTrade` ID in memory
4. Merge scopes into their parent trade objects

For individual trade pages: fetch the single trade + filter from the already-fetched scopes. Since ISR caches the page, this only runs once per revalidation cycle.

### Caching Strategy

- **ISR**: `revalidate = 180` (3 minutes) on all services pages
- **Next.js cache tags**: Tag Notion fetches with `notion-trades` and `notion-scopes` using `unstable_cache` with tags
- **On-demand revalidation**: Add a `revalidateNotionCache` procedure to the existing `notionRouter`, using `agentProcedure` (requires auth). This calls `revalidateTag('notion-trades')` and `revalidateTag('notion-scopes')`. Since tRPC procedures run inside Next.js API routes, `revalidateTag` is callable from this context.
- **Refresh button**: `NotionRefreshButton` component — small refresh icon, only rendered when `session?.user.role` is `agent` or `super-admin`. Calls the revalidation mutation, shows a success toast via sonner.

### `generateStaticParams` Implementation

**Pillar pages** (`/services/energy-efficient-construction` and `/services/luxury-renovations`): These are not dynamic routes — no `generateStaticParams` needed.

**Trade pages** (`/services/energy-efficient-construction/[tradeSlug]`):
```typescript
// In src/app/(frontend)/(site)/services/energy-efficient-construction/[tradeSlug]/page.tsx
export async function generateStaticParams() {
  const trades = await getTradesByPillar('energy-efficiency') // Notion query, Type = 'Energy Efficiency'
  return trades.map((trade) => ({ tradeSlug: trade.slug }))
}
```

**Trade pages** (`/services/luxury-renovations/[tradeSlug]`):
```typescript
// In src/app/(frontend)/(site)/services/luxury-renovations/[tradeSlug]/page.tsx
export async function generateStaticParams() {
  const trades = await getTradesByPillar('luxury-renovations') // Notion query, Type IN ('General Construction', 'Structural / Functional')
  return trades.map((trade) => ({ tradeSlug: trade.slug }))
}
```

### SEO Metadata

Each page type generates metadata dynamically:

- **Overview**: Static title "Services | Tri Pros Remodeling", static description
- **Pillar pages**: Static per pillar — e.g. title "Energy-Efficient Construction | Tri Pros Remodeling"
- **Trade pages**: Dynamic via `generateMetadata` — title "[Trade Name] | [Pillar Name] | Tri Pros Remodeling", description pulled from trade outcome statement

### Data Shape (TypeScript)

Extend existing types (do not create parallel types):

```typescript
// Additions to existing Trade type in the Notion service adapter
// slug: derived from name via slugifyTradeName()
// coverImageUrl: sourced from page.cover

// The view-model assembled for services pages:
type TradeWithScopes = Trade & {
  slug: string
  coverImageUrl: string | null
  scopes: ScopeOrAddon[] // existing type, filtered to this trade
}
```

---

## 5. Page Designs

### 5a. `/services` — Overview Page

#### Hero Section
- **Headline**: Outcome-focused, speaks to pride of ownership and trust
  - Copy direction: "Your Home. Done Right. Backed Forever."
- **Subheadline**: Addresses trust barrier immediately
  - Copy direction: "Licensed. Insured. Warranted. 520+ Southern California homes transformed."
- **Stats strip**: 520+ Projects | $9M+ Completed | 98% Satisfaction | 2 Generations of Expertise
- **CTAs**: "Schedule Your Free Consultation" (primary) + "See Our Work" (secondary → /portfolio)

#### Primary Pillar Cards (2 large cards)

**Energy Efficiency:**
- Lead with loss aversion: "Stop paying your utility company for your home's inefficiency."
- Sub-copy: compounding savings, rebate eligibility, envelope approach
- Preview 3-4 trade icons (HVAC, Solar, Windows, Insulation)
- CTA: "Explore Energy Solutions"

**Luxury Renovations:**
- Lead with pride of ownership: "The home you've always wanted — built by people who'll still be here when you need us."
- Sub-copy: lifestyle transformation, craftsmanship, resale value
- Preview 3-4 trade icons (Kitchen, Bathroom, Flooring, ADU)
- CTA: "Explore Renovation Services"

#### Secondary Cards (Commercial + Design-Build)
- Smaller, simpler cards. "Contact Us to Discuss" CTA.

#### "Why Tri Pros" Section — S-W-C-E Framework
4 cards, each answering the underlying trust question:

| Card | Headline | Copy Direction | Emotional Driver |
|------|----------|----------------|------------------|
| Security | "You're Protected" | Licensed (CSLB), $2M liability. "If anything goes wrong on the job, our insurance covers it — not yours." | Trust & Safety |
| Warranty | "We Stand Behind It" | Workmanship warranty + manufacturer pass-through. "A cheap contractor using the same shingles voids the manufacturer warranty entirely." | Fear/Risk Aversion |
| Craftsmanship | "Done Right the First Time" | Certified installers, proper methods, permits & inspection. "When a city inspector signs off on our work, that's independent proof it was done correctly." | Pride of Ownership |
| Experience | "520+ Projects. Zero Shortcuts." | Portfolio proof, case studies, social proof. "The [family] in [city] was in the exact same situation..." | Social Proof |

#### Comparison Table — "Licensed vs. Cheap"

| | Tri Pros Remodeling | Unlicensed Contractor |
|---|---|---|
| CA Contractor's License | Yes | No |
| Licensed & Bonded | Yes | No |
| General Liability ($2M) | Yes | No — you're liable |
| Manufacturer Warranty | Valid (certified installer) | Voided |
| Workmanship Warranty | Written guarantee | Verbal, if any |
| Permits & Inspections | Pulled and passed | Skipped |
| Contractor Experience | 15+ years | 3 years or less |
| When something goes wrong | We come back | They disappear |

#### Programs Teaser
- Headline: "You May Qualify for Rebates & Incentive Programs"
- Copy: "Federal tax credits, utility rebates, and exclusive monthly programs can significantly reduce your project cost. Every family's situation is different — we'll identify what you qualify for during your free consultation."
- No program specifics exposed. CTA: "Find Out What You Qualify For" → schedule consultation.

#### Process Overview
- Reuse existing `ProcessOverview` component as-is.

#### Bottom CTA
- "Join 520+ Southern California homeowners who chose the contractor they'll never regret."

---

### 5b. Pillar Pages — Shared Template

Both pillar pages share the same structural template with different emotional framing.

#### Template Sections

**1. Pillar Hero**
- Full-width hero with gradient overlay
- Pillar-specific headline + subheadline
- 3 stat boxes (pillar-specific)
- CTA: "Schedule Your Free Consultation"

**2. Trades Grid**
- Cards for each trade fetched from Notion
- Each card: trade name, short outcome statement, scope count badge, cover image
- Click → `/services/[pillar]/[tradeSlug]`

**3. "Why Tri Pros" Section**
- Same S-W-C-E component reused from overview with pillar-specific proof points

**4. "How We Approach Your Project" — 3-step flow**
1. **Discovery** — "We walk your home with you. We listen first, recommend second."
2. **Tailored Proposal** — "A scope built around what you told us — not a cookie-cutter estimate."
3. **Professional Installation** — "Licensed crews, proper permits, city inspection, workmanship warranty."

**5. "Projects That Work Better Together" — Natural Pairings**
- 2-3 complementary scope combos with the "story" for each (from scope-presentation.md)

**6. Comparison Table** — Same reused component

**7. Programs Teaser** — Same reused component

**8. Bottom CTA**

#### Energy Efficiency Pillar — Specific Framing

- **Emotional driver**: Loss aversion
- **Hero headline**: "Your Home Is Costing You More Than It Should"
- **Hero subheadline**: "A complete energy envelope upgrade — insulation, HVAC, windows, solar, roofing — delivered by one contractor, in one mobilization, with compounding savings."
- **Stats**: "30–55% Average Bill Reduction" | "Up to $3,200 in Federal Tax Credits" | "6–18 Month Typical Payback"
- **Pairings**:
  - Insulation + HVAC → "Seal the envelope, upgrade the system. Your bills drop from both sides."
  - Roofing + Solar → "A new roof is the ideal foundation for solar — one install, better ROI."
  - Windows + Insulation → "Complete envelope sealing — the most cost-effective energy upgrade."
- **Programs teaser**: Leans into IRA/utility rebate angle: "Federal and state programs are actively funding these upgrades. Caps apply annually — timing matters."

#### Luxury Renovations Pillar — Specific Framing

- **Emotional driver**: Pride of ownership
- **Hero headline**: "The Home You've Always Wanted — Built to Last"
- **Hero subheadline**: "Kitchens, bathrooms, flooring, additions, outdoor living, and more. Every project backed by a licensed team, proper permits, and a written warranty."
- **Stats**: "60–80% Kitchen Remodel ROI" | "520+ Projects Completed" | "98% Client Satisfaction"
- **Pairings**:
  - Bathroom + Flooring → "Updating the bathroom? The transition to new flooring in the hallway is natural and seamless."
  - Kitchen + Interior Paint → "A remodeled kitchen paired with fresh paint transforms how the whole home feels."
  - ADU + Engineering/Plans → "From blueprints to finished unit — one team, one process."
- **Programs teaser**: Leans into Monthly Special angle: "Exclusive monthly packages with preferred pricing, expedited scheduling, and a written workmanship warranty on every project."

---

### 5c. Trade Pages — `/services/[pillar]/[tradeSlug]`

All trade pages share one template, populated dynamically from Notion. Copy framing adapts based on parent pillar.

#### Template Sections

**1. Trade Hero**
- Trade cover image from Notion (fallback to pillar default)
- Trade name as headline
- Outcome statement as subheadline (from services-catalog docs)
- Breadcrumb: Services → [Pillar Name] → [Trade Name]
- CTA: "Schedule Your Free Consultation"

**2. "What This Means for Your Home" — Benefits Section**
- 3-4 benefit cards with outcome-focused language per trade
- Example (Windows & Doors):
  - "Lower utility bills" — reduced heat gain/loss
  - "Quieter living spaces" — noise reduction
  - "Enhanced security" — stronger frames and locks
  - "Consistent comfort" — no more drafts or hot spots

**3. Scopes Grid**
- Fetched from Notion: all scopes where `Entry Type = Scope` for this trade
- Each scope card: scope name, one-line outcome description, unit of pricing badge
- Addons shown separately in "Available Add-Ons" subsection
- No pricing displayed publicly

**4. "Projects That Work Better Together" — Pairings**
- 1-2 natural pairings relevant to this trade
- Each: paired trade name + story explaining why they compound
- CTA: "Learn About [Paired Trade]" → links to that trade page

**5. S-W-C-E Trust Strip**
- Compact horizontal version: 4 icons inline
- Licensed & Bonded | $2M Insured | Written Warranty | 15+ Years Experience

**6. Programs Teaser**
- Pillar-adaptive:
  - Energy trades: "Federal tax credits and utility rebates may apply to this project."
  - Luxury trades: "Ask about this month's exclusive project package."
- CTA: "Find Out What You Qualify For"

**7. Portfolio Proof**
- Query: Drizzle query against `projects` table in Postgres where `isPublic = true`, filtering by JSONB `hoRequirements` array containing a tag that matches the trade name (e.g. "HVAC", "Kitchen Remodel"). Use the existing `getPublicProjects()` DAL function and filter client-side, or add a `getProjectsByTrade(tradeName)` helper.
- Limit to 2-3 results, ordered by `completedAt` descending (most recent first)
- Card format: hero image, title, city, homeowner quote if available
- **Empty state**: If no matching projects exist, hide the entire section gracefully (no "coming soon" message — just omit)

**8. Bottom CTA**
- Trade-specific: "Ready to talk about [trade name] for your home?"
- "Schedule Your Free Consultation" (primary) + "View Our Portfolio" (secondary)

#### Pillar-Adaptive Copy Behavior

| Element | Energy Efficiency Trades | Luxury Renovation Trades |
|---|---|---|
| Hero tone | Loss aversion — "Stop paying for inefficiency" | Pride — "The home you deserve" |
| Benefits framing | Monthly savings, ROI, payback period | Lifestyle upgrade, resale value, daily comfort |
| Programs teaser | Rebates, tax credits, utility programs | Monthly specials, financing, expedited scheduling |
| Pairing story | "Compounding energy savings" | "Seamless transformation, room by room" |

---

## 6. Reusable Components

These sections appear on multiple pages and should be extracted as shared components:

| Component | Used On | Props |
|---|---|---|
| `SwceSection` | Overview, pillar pages | `variant: 'full' | 'compact'`, `pillarContext?: string` |
| `ComparisonTable` | Overview, pillar pages | (static, no props) |
| `ProgramsTeaser` | Overview, pillar, trade pages | `pillarType: 'energy' | 'luxury'` |
| `NaturalPairings` | Pillar, trade pages | `pairings: Pairing[]` |
| `PortfolioProof` | Trade pages | `tradeSlug: string` |
| `NotionRefreshButton` | All Notion-sourced surfaces | (agent-only visibility) |

---

## 7. File Structure

```
src/app/(frontend)/(site)/services/
├── page.tsx                                            → ServicesOverviewPage
├── energy-efficient-construction/
│   ├── page.tsx                                        → EnergyEfficiencyPillarPage
│   └── [tradeSlug]/
│       └── page.tsx                                    → TradePage
└── luxury-renovations/
    ├── page.tsx                                        → LuxuryRenovationsPillarPage
    └── [tradeSlug]/
        └── page.tsx                                    → TradePage

src/features/landing/
├── ui/
│   ├── views/
│   │   ├── services-overview-view.tsx                  → main orchestrator (modernized)
│   │   ├── pillar-view.tsx                             → shared pillar page view
│   │   └── trade-view.tsx                              → shared trade page view
│   └── components/
│       └── services/
│           ├── services-hero.tsx                        → modernized hero
│           ├── pillar-card.tsx                          → primary pillar card
│           ├── pillar-card-secondary.tsx                → deferred service card
│           ├── trades-grid.tsx                          → trade cards grid
│           ├── trade-card.tsx                           → individual trade card
│           ├── trade-hero.tsx                           → trade page hero
│           ├── trade-benefits.tsx                       → benefits section
│           ├── scopes-grid.tsx                          → scopes listing
│           ├── scope-card.tsx                           → individual scope card
│           ├── swce-section.tsx                         → S-W-C-E trust section
│           ├── comparison-table.tsx                     → licensed vs cheap table
│           ├── programs-teaser.tsx                      → programs CTA section
│           ├── natural-pairings.tsx                     → scope pairings section
│           ├── portfolio-proof.tsx                      → matching portfolio projects
│           ├── project-approach.tsx                     → 3-step process section
│           └── notion-refresh-button.tsx                → cache revalidation button
├── constants/
│   ├── trade-benefits.ts                               → per-trade benefit definitions
│   ├── trade-pairings.ts                               → natural pairing definitions
│   ├── trade-outcome-statements.ts                     → outcome statements per trade
│   └── pillar-config.ts                                → pillar-specific copy, stats, framing
└── lib/
    └── notion-trade-helpers.ts                         → slug derivation, pillar mapping, type guards

src/shared/services/notion/                             → (if needed for shared Notion fetch utils)

src/trpc/routers/notion.router/                         → modify existing procedures for revalidation
```

---

## 8. Static Content Sources

Content that is NOT from Notion (hardcoded in constants files):

- **S-W-C-E copy** — `pillar-config.ts` or dedicated constants
- **Comparison table** — static, no data source needed
- **Programs teaser copy** — static per pillar type
- **Trade benefit cards** — `trade-benefits.ts` (keyed by trade slug)
- **Natural pairings** — `trade-pairings.ts` (keyed by trade slug, from scope-presentation.md)
- **Outcome statements** — `trade-outcome-statements.ts` (keyed by trade slug, from services-catalog.md)
- **Pillar hero copy, stats, framing** — `pillar-config.ts`
- **3-step project approach** — static in `constants/pillar-config.ts` (NOT in the component file per project conventions)

---

## 9. Navigation Updates

Update `src/shared/constants/nav-items/marketing.ts` to reflect new structure:

```
Services (dropdown)
├── Energy-Efficient Construction → /services/energy-efficient-construction
├── Luxury Renovations → /services/luxury-renovations
├── Commercial Construction → /services/commercial (or contact CTA)
└── Design-Build → /services/design-build (or contact CTA)
```

Individual trades are NOT in the top-level nav — they're accessed through the pillar pages.

---

## 10. Copy Principles (from docs/)

All copy on these pages must follow these principles derived from the company's sales documentation:

1. **Outcome statements, not technical specs** — "Your home will be fully protected for 30 years" not "GAF Timberline 30-year architectural shingle"
2. **Lead with the emotional driver** — Fear/loss aversion for energy, pride for luxury
3. **Address trust before features** — S-W-C-E framework appears before any scope details
4. **Social proof through portfolio** — Not testimonials in isolation, but project stories with context
5. **Programs as teasers only** — No specifics; create curiosity + CTA to schedule
6. **Never expose pricing** — Pricing is for the in-home meeting where value is established first
7. **Natural pairings tell a story** — Not "buy more" but "these work better together, here's why"
8. **The comparison table is defensive positioning** — Preempt the "cheaper quote" objection before it forms

---

## 11. Migration & Cleanup

### Existing Route Removal

The current `src/app/(frontend)/(site)/services/[serviceId]/page.tsx` uses the old flat `services` slugs (`energy-efficient-construction`, `luxury-renovations`, `commercial`, `design-build`). This route must be **removed** once the new nested routes are in place.

To preserve any existing links or SEO:
- `/services/energy-efficient-construction` now resolves to the new pillar page (same slug, deeper route takes precedence)
- `/services/luxury-renovations` same
- `/services/commercial` and `/services/design-build` — keep as simple placeholder pages until their pillar pages are built

Delete `src/app/(frontend)/(site)/services/[serviceId]/page.tsx` after the new routes are deployed.

### Existing Component Reuse vs. Replacement

- `service-hero.tsx` (singular) — **replaced** by the new `services-hero.tsx` (plural, modernized). Delete the old file.
- `services-list.tsx`, `services-list-scroll.tsx`, `service-card.tsx` — **replaced** by the new overview page layout with pillar cards. Delete after new implementation is stable.
- `ProcessOverview` component — **kept as-is**, reused on the overview page.
- `BottomCTA` component — **kept as-is**, reused on all pages.

### Legacy `data/` Directory

The existing `src/features/landing/data/` directory is a legacy pattern. New static content goes in `src/features/landing/constants/` per project conventions. Do NOT add new exports to `data/`. The existing `data/company/services.ts` can be deprecated once the new pillar/trade data flow is in place.

---

## 12. Empty States & Edge Cases

| Scenario | Behavior |
|---|---|
| Trade has zero scopes (e.g. Framing) | Hide the "Scopes Grid" section entirely. Show only hero, benefits, trust strip, pairings (if any), programs teaser, and CTA. |
| Trade has no cover image in Notion | Fall back to a pillar-level default hero image (defined in `pillar-config.ts`) |
| No matching portfolio projects for a trade | Hide the "Portfolio Proof" section entirely |
| Trade has no defined benefits in `trade-benefits.ts` | Hide the benefits section. Log a warning in dev for the implementer. |
| Trade has no defined pairings in `trade-pairings.ts` | Hide the pairings section |
| Notion API is down or returns an error | ISR serves the last cached version. If no cache exists (first build), show a generic "Services coming soon" fallback |

---

## 13. Responsive Behavior

All new sections must be mobile-first (Tailwind v4 mobile-first approach):

| Section | Mobile | Tablet | Desktop |
|---|---|---|---|
| Hero stats strip | Stacked vertically, 1 column | 2x2 grid | Horizontal row |
| Primary pillar cards | Stacked, full-width | Side by side | Side by side, larger |
| Secondary pillar cards | Stacked, full-width | Side by side | Side by side, smaller |
| S-W-C-E cards | 1 column, stacked | 2x2 grid | 4 across |
| Comparison table | Horizontally scrollable | Full width | Full width |
| Trades grid (pillar page) | 1 column | 2 columns | 3 columns |
| Scopes grid (trade page) | 1 column | 2 columns | 3 columns |
| Natural pairings | Stacked cards | Side by side | Side by side |
| Trust strip (compact) | 2x2 grid | 4 across | 4 across |
| Portfolio proof cards | 1 column | 2-3 columns | 3 columns |

No separate mobile/desktop component branching needed (unlike the current `useIsMobile` pattern). Use Tailwind responsive breakpoints directly.
