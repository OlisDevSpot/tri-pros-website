# Trade Page Conversion Redesign — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Date**: 2026-03-18
**Status**: Draft
**Scope**: Redesign existing trade page (`/services/[pillar]/[tradeSlug]`) to convert with a Problem → Transformation narrative, pillar-adaptive pain acknowledgment, featured portfolio story, and strict typography hierarchy.
**Predecessor spec**: `2026-03-18-services-pages-redesign.md` (the original build — this spec layers on top of it)

---

## 1. Goal

The existing trade page is visually clean but emotionally flat. It presents what Tri Pros does without first making the homeowner feel understood. The goal of this redesign is to shift the page from **feature presentation** to **transformation storytelling** — making the homeowner feel seen before they're sold.

**Architecture**: Problem → Transformation narrative with pillar-adaptive pain acknowledgment, a featured portfolio story as the centrepiece of proof, and a strict 5-level typography hierarchy that guides eye movement without overwhelming.

**Tech Stack**: Next.js RSC, Tailwind v4, shadcn/ui, motion/react (existing), static constants per trade.

---

## 2. Design Decisions (ratified in brainstorm)

| Decision | Choice | Rationale |
|---|---|---|
| Page philosophy | Problem → Transformation | Customer-centric; makes homeowner feel understood before selling |
| Pain entry — energy pillar | Symptoms chip strip ("Sound familiar?") | Fast-scan, specific symptoms, low visual weight |
| Pain entry — luxury pillar | Before → After two-column section | Full narrative treatment; lifestyle transformation needs more space |
| Portfolio proof | Featured story (1 large + 2 minis) | Highest conversion potential; quote + stats make proof visceral |
| Typography system | 5-level hierarchy (see §4) | Prevents overwhelm; controls eye movement through each section |

---

## 3. Section Order & Purpose

```
1. Hero          — Pain-led H1, outcome pivot in subheading, CTA, trust strip
2. Pain Ack      — Symptoms strip (energy) OR Before→After (luxury)
3. Portfolio     — "A home transformed like yours" — 1 featured story + 2 minis
4. Mid CTA       — Soft, low-pressure; catches visitors convinced by portfolio
5. Benefits      — What changes, with specific numbers (number → title → body)
6. Scopes        — Exactly what's included (live Notion data)
7. Trust         — SWCE compact strip (scannable badges)
8. Programs      — "You may not pay full price" (rebates / financing)
9. Bottom CTA    — Warm close
```

**Rule**: No two CTAs appear adjacent. Mid CTA sits between Portfolio and Benefits. Bottom CTA is the only one in the bottom half of the page.

---

## 4. Typography Hierarchy

Five levels — every element on the page belongs to exactly one level. Never use two levels of equal visual weight within the same section.

| Level | Name | Role | Implementation |
|---|---|---|---|
| 1 | Section anchor | H2 — one per section, tells homeowner what section is about in ≤5 words | `text-3xl sm:text-4xl font-bold text-foreground` |
| 2 | CTA / key stat | Demands attention — button or large number | Button: `variant="cta"` · Stat: `text-2xl font-black text-primary` |
| 3 | Supporting body | Explains the H2 — ≤2 sentences, muted | `text-sm text-muted-foreground leading-relaxed` |
| 4 | Labels / chips | Scannable — no full sentences | `text-xs font-semibold` on badges/pills |
| 5 | Eyebrows / captions | Whisper-level — breadcrumbs, locations, metadata | `text-xs text-muted-foreground uppercase tracking-widest` |

### Anti-Overwhelm Rules (enforce these in every component)

- **One H2 per section** — no exceptions, no sub-H2s competing for attention
- **Body copy ≤2 sentences** per text block
- **Stats**: number at level 2, label at level 4 — never equal weight
- **Benefits**: number first (level 2), title (level 1 weight but smaller), body (level 3)
- **CTAs**: never two primary CTAs within visual proximity — space them by at least 2 sections
- **Eyebrows guide, never lead** — always rendered at level 5, never level 3 or above
- **3 font-weight levels max** per section: muted body → medium title → bold anchor

---

## 5. Component Specification

### 5a. `TradeHero` — Pain-Led Hero (modify existing)

**File**: `src/features/landing/ui/components/services/trade-hero.tsx`

**Change**: The H1 currently displays `tradeName`. Replace with a pain-led headline from a new `tradePainHeadlines` constant, with `tradeName` demoted to the eyebrow (Level 5).

**Updated `TradeHeroProps` interface** — add one required prop:

```ts
interface TradeHeroProps {
  tradeName: string           // existing — now used in breadcrumb eyebrow only
  outcomeStatement: string    // existing — unchanged, subheading
  images: string[]            // existing — unchanged
  defaultHeroImage: string    // existing — unchanged
  pillarSlug: PillarSlug      // existing — unchanged
  pillarTitle: string         // existing — unchanged
  painHeadline: string        // NEW — resolved before call site, never undefined
}
```

**Prop resolution in `trade-view.tsx`** (call site):

```tsx
import { tradePainHeadlines } from '@/features/landing/constants/trade-pain-headlines'

const FALLBACK_HEADLINE = "Let's get your home where it should be."
const painHeadline = tradePainHeadlines[trade.slug] ?? FALLBACK_HEADLINE

<TradeHero
  ...existingProps
  painHeadline={painHeadline}
/>
```

The fallback lives in `trade-view.tsx`, not in `TradeHero`. The prop is always a resolved `string` — `TradeHero` never receives `undefined`.

**`variant="cta"`** is a project-level extension of the shadcn/ui `Button` component. It already exists in this codebase — do not add it.

```tsx
// Eyebrow (level 5) — trade name + breadcrumb context
<nav aria-label="Breadcrumb">...</nav>

// H1 (level 1) — pain-led
<h1>{painHeadline}</h1>

// Subheading (level 3) — outcome pivot
<p>{outcomeStatement}</p>          // existing, unchanged

// CTA (level 2)
<Button variant="cta">Schedule Your Free Consultation</Button>

// Trust strip (level 4-5)
// existing trust items — unchanged
```

New constant needed: `src/features/landing/constants/trade-pain-headlines.ts`
- Type: `Partial<Record<string, string>>` — sparse lookup, fallback handled at call site
- Energy trades: loss-aversion framing ("Your [X] is costing you more than it should.")
- Luxury trades: desire framing ("The [X] your home deserves — built to last.")
- Fallback handled at call site in `trade-view.tsx` (see above)

---

### 5b. `TradeSymptomsBand` — Energy Pillar Pain Acknowledgment (new component)

**File**: `src/features/landing/ui/components/services/trade-symptoms-band.tsx`

**When rendered**: Only when `pillarSlug === 'energy-efficient-construction'`. Placed immediately after `TradeHero` (and after `NotionRefreshButton` — see §7).

**`PillarSlug` type assumption**: `PillarSlug` is a union of exactly `'energy-efficient-construction' | 'luxury-renovations'` (defined in `src/features/landing/lib/notion-trade-helpers.ts`). The `isEnergy` ternary in §7 is exhaustive over these two values. If a third pillar slug is ever added, `TradeBeforeAfter` would render for it — update the guard at that time.

**Layout**: A warm-toned horizontal band (`bg-amber-50 border-y border-amber-200`).

```tsx
interface TradeSymptomsBandProps {
  symptoms: string[]   // from tradeSymptoms[trade.slug]
}
```

**Visual structure**:
- Level 4 label: "😓 Sound familiar?" (small, uppercase)
- Symptom chips: `<span>` pill elements — short phrases, no full sentences, max 6 chips
- No body copy — chips only

**Empty state**: If `symptoms.length === 0`, return `null` (renders nothing).

New constant needed: `src/features/landing/constants/trade-symptoms.ts`

```ts
// Sparse lookup — not all slugs are covered, so use Partial<Record>
export const tradeSymptoms: Partial<Record<string, string[]>> = {
  'hvac': [
    'Rooms that won't stay at the right temperature',
    'Energy bill over $250/mo',
    'AC running constantly in summer',
    'System is 10+ years old',
    'Uneven cooling room to room',
  ],
  'attic-and-basement': [
    'Rooms that won't stay warm in winter',
    'Heating bill keeps climbing',
    'Drafts near windows or doors',
    'Attic feels like an oven in summer',
    'AC runs all day and still can\'t keep up',
  ],
  'windows-and-doors': [
    'Drafts near windows even when closed',
    'Outside noise bleeds in constantly',
    'Condensation on the inside of glass',
    'Single-pane windows from the 80s or 90s',
  ],
  'roof-and-gutters': [
    'Worried about the next storm season',
    'Visible wear, missing shingles, or age 20+ years',
    'Gutters overflowing or pulling away',
    'Attic heat or moisture problems',
  ],
  // ... all energy trades
}
```

---

### 5c. `TradeBeforeAfter` — Luxury Pillar Pain Acknowledgment (new component)

**File**: `src/features/landing/ui/components/services/trade-before-after.tsx`

**When rendered**: Only when `pillarSlug === 'luxury-renovations'`. Placed immediately after `TradeHero`.

**Layout**: Two-column card (`bg-background border rounded-lg`), inside a full-width section with container padding.

```tsx
interface TradeBeforeAfterProps {
  before: string[]   // pain points — current state
  after: string[]    // outcomes — after Tri Pros
}
```

**Visual structure**:
- Left column header (level 4): "😓 Right now" (muted red)
- Left column: bullet list of 3-4 current-state pain lines
- Right column header (level 4): "✅ After Tri Pros" (muted green)
- Right column: bullet list of 3-4 outcome lines matching the pain items
- No H2 on this section — it connects visually to the hero above it

**Empty state**: If `before.length === 0`, return `null`.

New constant needed: `src/features/landing/constants/trade-before-after.ts`

```ts
// Sparse lookup — not all slugs are covered, so use Partial<Record>
export const tradeBeforeAfter: Partial<Record<string, { before: string[], after: string[] }>> = {
  'kitchen-remodel': {
    before: [
      'Cabinets that don't close right',
      'Counter space that was never enough',
      'Layout that makes cooking a chore',
      'A kitchen that feels decades behind the rest of the house',
    ],
    after: [
      'Soft-close cabinetry, quartz counters, optimized layout',
      'A kitchen you actually want to cook in',
      'The highest-ROI improvement you can make before selling',
      'A space that finally matches how you live',
    ],
  },
  'bathroom-remodel': {
    before: [
      'A bathroom you avoid guests seeing',
      'Fixtures from another decade',
      'Poor lighting, no storage, outdated tile',
      'A daily routine in a space you don't enjoy',
    ],
    after: [
      'Frameless glass, modern tile, LED lighting',
      'A bathroom you love using every morning',
      'The #1 priority for buyers — resale value increase',
      'Like moving into a new house, without moving',
    ],
  },
  // ... all luxury trades
}
```

---

### 5d. `PortfolioProof` — Featured Story (modify existing)

**File**: `src/features/landing/ui/components/services/portfolio-proof.tsx`

**Change**: Replace the current 3-equal-cards layout with a featured story format: 1 large card with quote + stats, 2 smaller supporting cards below.

**Current**: `3 × ProjectCard` side by side
**New**: `FeaturedProjectCard` (full-width or 2-col image+body) + `2 × MiniProjectCard`

```tsx
// Layout structure (no new sub-components — keep in one file per convention):
// Section header: eyebrow (level 5) + H2 (level 1)

// Featured card — first project in the results array
// - Left: project image (fill, object-cover)
// - Right: quote block + customer name + stat row + "See full project →" link
//   · Quote: level 3 (italic, border-left accent)
//   · Customer name: level 5
//   · Stats: 2-3 stats, each: number at level 2 + label at level 4

// Mini cards — remaining projects (index 1, 2)
// - Image thumbnail (fixed height)
// - Trade + city (level 4-5)
// - No quote, no stats — image + label only
```

**Section header copy**:
- Eyebrow: "Real results" (level 5)
- H2: "A home transformed — just like yours." (level 1)
- Sub: `[City], [City], [City] — real Tri Pros projects near you` (level 3, derived from project locations)

**Featured card content**: The current project schema (`src/shared/db/schema/projects.ts`) does not contain structured outcome stat fields (no sq footage, no cost, no savings data). The featured card therefore renders:
- `project.backstory` as the quote block (if present — level 3, italic)
- `project.title` as the project name (level 4)
- `project.city + project.state` as the location (level 5)
- `"See full project →"` link to `/portfolio/[project.accessor]`
- **No stats row** — the stats row is intentionally omitted until a future schema update adds structured outcome fields. Do not fabricate stats.

The 9th edge case row `"Project has no backstory"` in §9 applies to the quote block only: if `backstory` is null or empty, skip the quote entirely — show title + location + link only.

**Responsive layout**:
- **Mobile** (`< sm`): featured card stacks vertically — image on top (fixed height `h-52`), body below. Mini cards in 1-column grid.
- **sm+**: featured card is 2-column grid (`grid-cols-2`) — image left, body right (equal columns). Mini cards in 2-column grid (`grid-cols-2`).
- No tablet/desktop breakpoint split beyond `sm` — the 2-column treatment works from `640px` up.

**Empty state**: If `projects.length === 0`, return `null` (existing behavior — unchanged).
**Partial state**: If only 1-2 projects exist, show only what's available. Mini cards grid collapses gracefully.

---

### 5e. `TradeBenefitsSection` — Number-First Format (modify existing)

**File**: `src/features/landing/ui/components/services/trade-benefits-section.tsx`

**Change**: Benefits currently show CheckCircle icon + title + description. Replace icon with a large number/stat (level 2). If no stat is defined, show a subtle check icon at level 4 weight (not competing with the title).

Update `trade-benefits.ts` to support an optional `stat` field:

```ts
// In src/features/landing/constants/trade-benefits.ts
export type TradeBenefit = {
  title: string
  description: string
  stat?: string   // e.g. "–20–40%", "Same day", "$1,400+", "30%"
}
```

**Render logic**:
```tsx
// If stat is defined:
<span className="text-2xl font-black text-primary">{benefit.stat}</span>
<CardTitle>{benefit.title}</CardTitle>
<p className="text-sm text-muted-foreground">{benefit.description}</p>

// If stat is not defined:
<CheckCircle2 className="size-5 text-primary/60" />   // smaller, muted
<CardTitle>{benefit.title}</CardTitle>
<p>{benefit.description}</p>
```

Update all energy trade benefits with real stats. Luxury trade benefits use softer language (lifestyle outcomes), some will not have numeric stats — that's correct.

---

## 6. Static Content to Write

The following constants files need content authored per-trade. This is the bulk of the work.

### `trade-pain-headlines.ts` — All trades

Energy framing: loss-aversion, specific to the trade's primary problem.
Luxury framing: desire/aspiration, specific to the trade's primary outcome.

| Trade slug | Pain headline |
|---|---|
| `hvac` | "Your home shouldn't be this expensive to keep comfortable." |
| `roof-and-gutters` | "Your roof is the one thing between your home and the next storm." |
| `windows-and-doors` | "Your windows are working against your home — not for it." |
| `attic-and-basement` | "Your home is leaking energy — and your bills prove it." |
| `solar` | "You're renting energy from your utility company. You don't have to." |
| `exterior-paint-stucco-and-siding` | "Your home's exterior is its first impression — and its first line of defense." |
| `water-heating` | "Heating water you didn't use, waiting for hot water you can't get fast enough." |
| `dryscaping` | "Your lot should work as hard as the rest of your home." |
| `kitchen-remodel` | "A kitchen that wasn't designed for how you actually live." |
| `bathroom-remodel` | "A bathroom you deserve to love — not just tolerate." |
| `flooring` | "Flooring that's seen better days changes how every room feels." |
| `addition` | "Your family has outgrown your home. The answer might not be moving." |
| `exterior-upgrades-and-lot-layout` | "Your outdoor space is wasted potential." |
| `interior-upgrades-and-home-layout` | "Your home's layout shouldn't feel like a compromise." |
| `patch-and-interior-paint` | "Fresh paint changes everything. Yours is overdue." |
| `tile` | "Old tile doesn't just look dated — it changes how a room feels to live in." |
| `pool-remodel` | "A pool should be an asset, not an eyesore." |
| `adu` | "You have untapped value sitting in your garage or backyard." |
| `fencing-and-gates` | "Privacy, security, and curb appeal start at the property line." |
| `garage` | "Your garage is doing more work than it should have to." |
| `electricals` | "Your home's electrical system should be invisible when it works — and safe when it's tested." |
| `plumbing` | "Old pipes don't announce themselves until they fail." |
| `foundation-and-crawl-space` | "Your foundation is doing its job quietly — until it isn't." |
| `hazardous-materials` | "Asbestos, mold, and termites don't wait." |
| `engineering-plans-and-blueprints` | "A great build starts with a great plan." |

---

### `trade-symptoms.ts` — Energy pillar trades only (8 trades)

Write 4-6 symptom chips per energy trade. Chips must be:
- Short phrases (5-8 words) — not full sentences
- Specific and relatable — not abstract
- Written from the homeowner's felt experience

Trades: hvac, roof-and-gutters, windows-and-doors, attic-and-basement, solar, exterior-paint-stucco-and-siding, water-heating, dryscaping

---

### `trade-before-after.ts` — Luxury pillar trades (17 trades, excluding Framing)

The "Framing" trade has no scopes (per predecessor spec §12 and §3) and does not receive a meaningful trade page — skip it. Write 3-4 "before" / "after" pairs for the following 17 luxury trades:

`kitchen-remodel`, `bathroom-remodel`, `flooring`, `addition`, `exterior-upgrades-and-lot-layout`, `interior-upgrades-and-home-layout`, `patch-and-interior-paint`, `tile`, `pool-remodel`, `adu`, `fencing-and-gates`, `garage`, `electricals`, `plumbing`, `foundation-and-crawl-space`, `hazardous-materials`, `engineering-plans-and-blueprints`

Rules for each entry:
- Before: specific pain, written in present tense ("Cabinets that don't close right")
- After: specific outcome, written as the result state ("Soft-close cabinetry, optimized layout")
- Pairs should correspond — after item addresses before item directly
- No fluff — each line should be specific enough to be recognizable

---

### `trade-benefits.ts` — Add `stat` field to energy trades

Update energy trade benefits with real stats where available:

| Trade | Benefit | Stat |
|---|---|---|
| HVAC | Lower Utility Bills | "–40–60%" |
| HVAC | Rebate Eligible | "Up to $3,200" |
| Attic & Basement | Energy Bill Reduction | "–20–40%" |
| Attic & Basement | Annual Savings | "$1,400+ avg" |
| Attic & Basement | Federal Tax Credit | "30%" |
| Windows & Doors | Lower Utility Bills | "–15–25%" |
| Roof & Gutters | Lifespan | "30 years" |
| Solar | Bill Elimination | "~100%" |
| Solar | Federal Tax Credit | "30%" |
| Solar | Rate Lock | "25 years" |

Luxury trade benefits keep their existing format — lifestyle outcomes, no numeric stats required.

---

## 7. `trade-view.tsx` — Updated Section Composition

**File**: `src/features/landing/ui/views/trade-view.tsx`

```tsx
export function TradeView({ trade, pillarSlug }: TradeViewProps) {
  const isEnergy = pillarSlug === 'energy-efficient-construction'
  // PillarSlug is 'energy-efficient-construction' | 'luxury-renovations' — exhaustive

  const FALLBACK_HEADLINE = "Let's get your home where it should be."
  const painHeadline = tradePainHeadlines[trade.slug] ?? FALLBACK_HEADLINE
  const symptoms = tradeSymptoms[trade.slug] ?? []
  const beforeAfter = tradeBeforeAfter[trade.slug]

  return (
    <main>
      <TradeHero ... painHeadline={painHeadline} />  // modified — pain-led H1

      <NotionRefreshButton />                        // PRESERVED — agent-only, existing

      {isEnergy
        ? <TradeSymptomsBand symptoms={symptoms} />  // new — energy only
        : beforeAfter != null
          ? <TradeBeforeAfter before={beforeAfter.before} after={beforeAfter.after} />
          : null                                     // new — luxury only, null if no data
      }

      <PortfolioProof tradeName={trade.name} />      // modified — featured story layout

      {/* Mid-page CTA — soft, existing markup unchanged */}
      <section className="border-y border-primary/10 bg-primary/5">...</section>

      <TradeBenefitsSection tradeName={trade.name} benefits={benefits} />  // modified — stat-first

      <ScopesGrid scopes={trade.scopes} />           // unchanged

      <NaturalPairings pairings={pairings} />        // unchanged

      <SwceSection variant="compact" />              // unchanged

      <ProgramsTeaser pillarType={pillarType} />     // unchanged

      <BottomCTA />                                  // unchanged
    </main>
  )
}
```

---

## 8. File Structure — New & Modified Files

```
MODIFIED:
  src/features/landing/ui/views/trade-view.tsx
  src/features/landing/ui/components/services/trade-hero.tsx
  src/features/landing/ui/components/services/portfolio-proof.tsx
  src/features/landing/ui/components/services/trade-benefits-section.tsx
  src/features/landing/constants/trade-benefits.ts

NEW:
  src/features/landing/ui/components/services/trade-symptoms-band.tsx
  src/features/landing/ui/components/services/trade-before-after.tsx
  src/features/landing/constants/trade-pain-headlines.ts
  src/features/landing/constants/trade-symptoms.ts
  src/features/landing/constants/trade-before-after.ts
```

No new routes. No schema changes. No new tRPC procedures. No new DAL files.

---

## 9. Edge Cases

| Scenario | Behavior |
|---|---|
| Trade slug not in `tradePainHeadlines` | Render fallback: `"Let's get your home where it should be."` |
| Trade slug not in `tradeSymptoms` (energy trade) | `TradeSymptomsBand` returns `null` |
| Trade slug not in `tradeBeforeAfter` (luxury trade) | `TradeBeforeAfter` returns `null` |
| Portfolio has 0 projects | `PortfolioProof` returns `null` (existing behavior) |
| Portfolio has 1 project | Show featured card only, no mini cards |
| Portfolio has 2 projects | Featured card + 1 mini card |
| Benefit has no `stat` | Fall back to check icon (level 4 weight) |
| Project has no `backstory` | Skip the quote block; show title + location + "See full project →" link only |
| `trade-outcome-statements.ts` | No changes needed — already covers all 26 trades. No new entries required. |

---

## 10. Copy Principles (inherited from company docs)

1. **Pain before solution** — make the homeowner feel understood before presenting anything
2. **Outcome language, never feature language** — "no more cold rooms" not "R-49 blown-in insulation"
3. **Numbers earn trust** — use real stats (from portfolio, from docs); never fabricate
4. **One ask per section** — never stack CTAs; space them across the page journey
5. **Specific beats generic** — "your bill drops 20–40%" beats "lower your bills"
6. **Whisper the credentials** — trust signals appear at level 4-5, never level 1
7. **Programs tease, never expose** — create curiosity; specific rebate details are for the in-home meeting
