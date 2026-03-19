# Trade Page Conversion Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the trade page from generic feature presentation to Problem → Transformation storytelling, with pillar-adaptive pain acknowledgment, a featured portfolio story, and stat-first benefits — all within the existing component/constants layer (no schema changes, no new routes, no new tRPC procedures).

**Architecture:** New static content constants drive pillar-adaptive behavior. Four component modifications + two new components. `trade-view.tsx` wires them together with a single `isEnergy` guard. Verification gate is `pnpm lint` (no test infrastructure in this project).

**Tech Stack:** Next.js RSC, Tailwind v4, shadcn/ui, lucide-react, motion/react (existing), static constants per trade.

**Spec:** `docs/superpowers/specs/2026-03-18-trade-page-conversion.md`

---

## File Structure

```
NEW:
  src/features/landing/constants/trade-pain-headlines.ts
  src/features/landing/constants/trade-symptoms.ts
  src/features/landing/constants/trade-before-after.ts
  src/features/landing/ui/components/services/trade-symptoms-band.tsx
  src/features/landing/ui/components/services/trade-before-after.tsx

MODIFIED:
  src/features/landing/constants/trade-benefits.ts
  src/features/landing/ui/components/services/trade-hero.tsx
  src/features/landing/ui/components/services/portfolio-proof.tsx
  src/features/landing/ui/components/services/trade-benefits-section.tsx
  src/features/landing/ui/views/trade-view.tsx
```

---

## Task 1: Static Content Constants (constants-only, no component changes)

**Files:**
- Create: `src/features/landing/constants/trade-pain-headlines.ts`
- Create: `src/features/landing/constants/trade-symptoms.ts`
- Create: `src/features/landing/constants/trade-before-after.ts`
- Modify: `src/features/landing/constants/trade-benefits.ts`

- [ ] **Step 1: Create `trade-pain-headlines.ts`**

```ts
// src/features/landing/constants/trade-pain-headlines.ts
// Sparse lookup — not all possible slugs are listed, fallback handled at call site.
export const tradePainHeadlines: Partial<Record<string, string>> = {
  'hvac': "Your home shouldn't be this expensive to keep comfortable.",
  'roof-and-gutters': "Your roof is the one thing between your home and the next storm.",
  'windows-and-doors': "Your windows are working against your home — not for it.",
  'attic-and-basement': "Your home is leaking energy — and your bills prove it.",
  'solar': "You're renting energy from your utility company. You don't have to.",
  'exterior-paint-stucco-and-siding': "Your home's exterior is its first impression — and its first line of defense.",
  'water-heating': "Heating water you didn't use, waiting for hot water you can't get fast enough.",
  'dryscaping': "Your lot should work as hard as the rest of your home.",
  'kitchen-remodel': "A kitchen that wasn't designed for how you actually live.",
  'bathroom-remodel': "A bathroom you deserve to love — not just tolerate.",
  'flooring': "Flooring that's seen better days changes how every room feels.",
  'addition': "Your family has outgrown your home. The answer might not be moving.",
  'exterior-upgrades-and-lot-layout': "Your outdoor space is wasted potential.",
  'interior-upgrades-and-home-layout': "Your home's layout shouldn't feel like a compromise.",
  'patch-and-interior-paint': "Fresh paint changes everything. Yours is overdue.",
  'tile': "Old tile doesn't just look dated — it changes how a room feels to live in.",
  'pool-remodel': "A pool should be an asset, not an eyesore.",
  'adu': "You have untapped value sitting in your garage or backyard.",
  'fencing-and-gates': "Privacy, security, and curb appeal start at the property line.",
  'garage': "Your garage is doing more work than it should have to.",
  'electricals': "Your home's electrical system should be invisible when it works — and safe when it's tested.",
  'plumbing': "Old pipes don't announce themselves until they fail.",
  'foundation-and-crawl-space': "Your foundation is doing its job quietly — until it isn't.",
  'hazardous-materials': "Asbestos, mold, and termites don't wait.",
  'engineering-plans-and-blueprints': "A great build starts with a great plan.",
}
```

- [ ] **Step 2: Create `trade-symptoms.ts`**

```ts
// src/features/landing/constants/trade-symptoms.ts
// Energy pillar trades only (8). Sparse lookup — return [] at call site if not found.
export const tradeSymptoms: Partial<Record<string, string[]>> = {
  'hvac': [
    'Rooms that won\'t stay at the right temperature',
    'Energy bill over $250/mo',
    'AC running constantly in summer',
    'System is 10+ years old',
    'Uneven cooling room to room',
  ],
  'attic-and-basement': [
    'Rooms that won\'t stay warm in winter',
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
  'solar': [
    'Electricity bill over $200 every month',
    'Utility rates went up — again',
    'Watched your neighbor\'s bill drop to zero',
    'You own your home but still rent your energy',
    'AC season doubles your bill every year',
  ],
  'exterior-paint-stucco-and-siding': [
    'Paint peeling, cracking, or fading',
    'Stucco showing hairline cracks',
    'Wood rot or moisture damage along the trim',
    'Worried about moisture getting behind the walls',
    'A dated exterior that doesn\'t match the neighborhood',
  ],
  'water-heating': [
    'Waiting 3+ minutes for hot water to reach the shower',
    'Hot water runs out mid-shower',
    'Tank is 10+ years old',
    'High gas bill from constantly reheating a tank',
    'Low water pressure at fixtures',
  ],
  'dryscaping': [
    'Water bill spiking every summer',
    'A lawn that needs constant maintenance to look decent',
    'Water restrictions limiting what you can plant',
    'Patchy grass that never fully recovers',
    'HOA warnings about yard appearance',
  ],
}
```

- [ ] **Step 3: Create `trade-before-after.ts`**

```ts
// src/features/landing/constants/trade-before-after.ts
// Luxury pillar trades only (17 — Framing excluded, it has no scopes).
// Sparse lookup — returns undefined at call site if slug not present.
export const tradeBeforeAfter: Partial<Record<string, { before: string[], after: string[] }>> = {
  'kitchen-remodel': {
    before: [
      'Cabinets that don\'t close right',
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
      'A daily routine in a space you don\'t enjoy',
    ],
    after: [
      'Frameless glass, modern tile, LED lighting',
      'A bathroom you love using every morning',
      'The #1 priority for buyers — resale value increase',
      'Like moving into a new house, without moving',
    ],
  },
  'flooring': {
    before: [
      'Scratched or stained carpet from years of use',
      'Squeaky, uneven, or cold hardwood',
      'A floor that dates the whole room',
      'Different flooring in every room that doesn\'t flow',
    ],
    after: [
      'New hardwood, LVP, or tile — consistent throughout',
      'Floors that make every room feel intentional',
      'A refresh that works for buyers and for living',
      'Quiet, level, durable surface underfoot',
    ],
  },
  'addition': {
    before: [
      'Kids sharing rooms they\'ve outgrown',
      'No dedicated home office or workspace',
      'A house that works for a smaller family than yours',
      'Moving feels like the only option',
    ],
    after: [
      'A new bedroom, office, or suite that\'s part of the house',
      'Square footage that fits your actual life',
      'Permitted, engineered, and done right',
      'A home worth staying in — and investing in',
    ],
  },
  'exterior-upgrades-and-lot-layout': {
    before: [
      'A backyard you don\'t use because it\'s not set up for anything',
      'Concrete or dead grass where there could be something better',
      'No privacy from neighbors',
      'A front yard that looks like everyone else\'s on the block',
    ],
    after: [
      'An outdoor space you actually live in',
      'A lot layout that works: parking, entertaining, privacy',
      'Hardscape, landscaping, and drainage that holds up',
      'Curb appeal that makes your home stand out',
    ],
  },
  'interior-upgrades-and-home-layout': {
    before: [
      'A floor plan that made sense in 1985',
      'Rooms that feel disconnected or poorly used',
      'An entryway, hallway, or staircase that\'s just wasted space',
      'A home that works against how you live',
    ],
    after: [
      'An open layout, improved flow, and functional rooms',
      'Spaces that feel intentional instead of leftover',
      'A home that works for your family the way it is today',
      'Value added through design, not just cosmetics',
    ],
  },
  'patch-and-interior-paint': {
    before: [
      'Scuffs, holes, and wall damage that\'s been there too long',
      'Paint colors from a previous decade',
      'A home that looks tired even when it\'s clean',
      'The one project you\'ve been putting off for years',
    ],
    after: [
      'Fresh, smooth walls throughout',
      'A color palette that makes rooms feel bigger or warmer',
      'The fastest way to transform how a home feels',
      'Done in days — not weeks',
    ],
  },
  'tile': {
    before: [
      'Grout lines that never clean up',
      'Cracked, chipped, or outdated ceramic',
      'A shower or kitchen backsplash that doesn\'t match anything else',
      'Tile that looked fine 10 years ago',
    ],
    after: [
      'Large-format tile, fresh grout, clean lines',
      'A surface that\'s easy to maintain and looks intentional',
      'Pattern, texture, and material choices that last',
      'The detail that finishes a room properly',
    ],
  },
  'pool-remodel': {
    before: [
      'A pool that\'s cracking, staining, or showing its age',
      'Outdated coping, tile, or equipment',
      'A feature that\'s costing more than it should to maintain',
      'A backyard centrepiece that doesn\'t look like one anymore',
    ],
    after: [
      'Replastered, retiled, and mechanically sound',
      'A pool you want to show off again',
      'Lower operating costs with updated equipment',
      'A backyard that\'s actually worth using',
    ],
  },
  'adu': {
    before: [
      'A garage or backyard space that\'s just storage',
      'Untapped equity sitting on your property',
      'In-laws or adult kids with no good housing option',
      'Rental income you\'re not collecting',
    ],
    after: [
      'A permitted ADU: its own entrance, utilities, and value',
      'Equity converted into livable space',
      'A long-term asset that pays for itself',
      'Options: rent it, gift it, or use it yourself',
    ],
  },
  'fencing-and-gates': {
    before: [
      'An old fence that\'s leaning, rotting, or falling apart',
      'No privacy from the street or neighbors',
      'A driveway or yard with no clear boundary',
      'An entry that doesn\'t say anything about the home',
    ],
    after: [
      'Solid fencing — wood, vinyl, wrought iron, or masonry',
      'Privacy and security that actually work',
      'A clean perimeter with a gate that matches',
      'Curb appeal that starts at the property line',
    ],
  },
  'garage': {
    before: [
      'A garage that fits one car with nowhere to park the other',
      'Cracked or stained concrete',
      'A door that\'s noisy, slow, or unreliable',
      'Storage with no system — just stuff piled up',
    ],
    after: [
      'Epoxy floor, organized walls, working door',
      'A functional space instead of a wasted one',
      'A two-car garage that actually fits two cars',
      'Added value with minimal footprint',
    ],
  },
  'electricals': {
    before: [
      'Breakers that trip on a normal evening',
      'Outlets that aren\'t grounded or aren\'t where you need them',
      'An older panel that\'s never been evaluated',
      'No outdoor lighting, EV charging, or home office circuit',
    ],
    after: [
      'A panel that\'s sized for your home',
      'Outlets, switches, and circuits where you need them',
      'EV charger, dedicated circuits, or outdoor lighting added',
      'A system you can trust — and that passes inspection',
    ],
  },
  'plumbing': {
    before: [
      'Drains that are slow or stop up regularly',
      'A water heater that\'s aging out',
      'Low pressure at fixtures or inconsistent water temperature',
      'Fixtures that look fine but perform poorly',
    ],
    after: [
      'Repiping, drain clearing, or fixture upgrades — done right',
      'Water pressure that\'s consistent throughout',
      'A water heater that meets the home\'s demand',
      'No more guessing if something will fail',
    ],
  },
  'foundation-and-crawl-space': {
    before: [
      'Cracks in walls or floors that are getting wider',
      'Doors and windows that stick or won\'t close right',
      'Moisture or standing water in the crawl space',
      'A concern in the back of your mind that keeps growing',
    ],
    after: [
      'Foundation assessment, repair, and certification',
      'A crawl space that\'s sealed, dry, and inspected',
      'Structural confidence — documented and warranted',
      'Peace of mind that starts from the ground up',
    ],
  },
  'hazardous-materials': {
    before: [
      'An older home with unknown materials in walls or ceilings',
      'A renovation stalled because of what might be there',
      'Mold growing behind walls or under flooring',
      'Asbestos, lead, or termite damage that\'s been suspected',
    ],
    after: [
      'Testing, abatement, and clearance — all permitted',
      'A home that\'s safe to remodel',
      'Documentation that satisfies lenders and inspectors',
      'The removal that makes everything else possible',
    ],
  },
  'engineering-plans-and-blueprints': {
    before: [
      'An ADU, addition, or renovation with no plans to submit',
      'A permit application that was rejected',
      'A contractor who needs engineered drawings before they can start',
      'A project stuck in planning because the paperwork isn\'t right',
    ],
    after: [
      'Stamped engineering drawings that meet city requirements',
      'A permit package ready to submit',
      'Structural, mechanical, or architectural plans that unlock the build',
      'The foundation for every project that needs to be done right',
    ],
  },
}
```

- [ ] **Step 4: Update `trade-benefits.ts` — export type, add `stat?`, add energy stats**

Replace the entire file. Notes on changes vs. original:
- `roof-and-gutters / "Weather Protection"` → renamed to `"Lifespan"` to match spec §6 stat assignment
- `solar / "Fixed Energy Costs"` → renamed to `"Rate Lock"` to match spec §6 stat assignment
- `attic-and-basement / "Immediate Comfort"` gets `stat: 'Same day'` — not in spec §6 table but reinforces the existing description ("Notice the temperature difference the same day"); editorial addition
- `attic-and-basement / "20-40% Bill Reduction"` → renamed to `"Energy Bill Reduction"` per spec §6; `"Eliminated Drafts"` → renamed `"Annual Savings"` with stat; `"Rebate Eligible"` → renamed `"Federal Tax Credit"` with stat

```ts
// src/features/landing/constants/trade-benefits.ts
export type TradeBenefit = {
  title: string
  description: string
  stat?: string
}

export const tradeBenefits: Record<string, TradeBenefit[]> = {
  'hvac': [
    { title: 'Lower Utility Bills', description: 'High-SEER systems that cut heating and cooling costs dramatically', stat: '–40–60%' },
    { title: 'Consistent Comfort', description: 'Even temperatures throughout your home, every room, every season' },
    { title: 'Reduced Carbon Footprint', description: 'Energy-efficient units that are better for your home and the environment' },
    { title: 'Rebate Eligible', description: 'Qualifies for federal tax credits and utility company rebates', stat: 'Up to $3,200' },
  ],
  'roof-and-gutters': [
    { title: 'Lifespan', description: 'Complete protection from rain, wind, and sun for decades', stat: '30 years' },
    { title: 'Energy Efficiency', description: 'Cool roof systems that reflect heat and reduce cooling costs' },
    { title: 'Curb Appeal', description: 'A new roof dramatically improves how your home looks from the street' },
    { title: 'Home Value', description: 'One of the highest-ROI improvements for resale' },
  ],
  'windows-and-doors': [
    { title: 'Lower Utility Bills', description: 'Reduced heat gain and loss through dual or triple-pane glass', stat: '–15–25%' },
    { title: 'Quieter Living Spaces', description: 'Significant noise reduction from outside' },
    { title: 'Enhanced Security', description: 'Modern frames and locking mechanisms' },
    { title: 'Consistent Comfort', description: 'No more drafts or hot spots near windows' },
  ],
  'attic-and-basement': [
    { title: 'Immediate Comfort', description: 'Notice the temperature difference the same day', stat: 'Same day' },
    { title: 'Energy Bill Reduction', description: 'Significant heating and cooling cost savings', stat: '–20–40%' },
    { title: 'Annual Savings', description: 'Real dollar savings that compound year over year', stat: '$1,400+ avg' },
    { title: 'Federal Tax Credit', description: 'Qualifies for federal and utility rebate programs', stat: '30%' },
  ],
  'solar': [
    { title: 'Bill Elimination', description: 'Monthly electricity bill reduction or complete elimination', stat: '~100%' },
    { title: 'Rate Lock', description: 'Lock in your rate for 25+ years while utility rates rise', stat: '25 years' },
    { title: 'Federal Tax Credit', description: 'Significant ITC eligibility reduces total project cost', stat: '30%' },
    { title: 'Increased Home Value', description: 'Solar adds measurable resale value' },
  ],
  'kitchen-remodel': [
    { title: 'Highest ROI', description: 'Kitchen remodels return 60-80% at resale — the best of any room' },
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
}
```

- [ ] **Step 5: Run lint**

```bash
pnpm lint
```

Expected: 0 errors (these are constants-only files — no component changes yet).

- [ ] **Step 6: Commit**

```bash
git add src/features/landing/constants/trade-pain-headlines.ts \
        src/features/landing/constants/trade-symptoms.ts \
        src/features/landing/constants/trade-before-after.ts \
        src/features/landing/constants/trade-benefits.ts
git commit -m "feat(trade-page): add static content constants for pain headlines, symptoms, before/after, and stat-enhanced benefits"
```

---

## Task 2: Update `TradeHero` — Add `painHeadline` Prop

**Files:**
- Modify: `src/features/landing/ui/components/services/trade-hero.tsx`

- [ ] **Step 1: Add `painHeadline: string` to the interface and destructuring; swap H1**

Read the file first, then apply these changes:

**In the interface** — add one required prop after `pillarTitle`:
```ts
interface TradeHeroProps {
  tradeName: string
  outcomeStatement: string
  images: string[]
  defaultHeroImage: string
  pillarSlug: PillarSlug
  pillarTitle: string
  painHeadline: string   // NEW — resolved before call site, never undefined
}
```

**In the function signature** — add `painHeadline` to destructuring:
```ts
export function TradeHero({
  tradeName,
  outcomeStatement,
  images,
  defaultHeroImage,
  pillarSlug,
  pillarTitle,
  painHeadline,       // NEW
}: TradeHeroProps) {
```

**In the JSX** — swap `{tradeName}` with `{painHeadline}` in the H1. Leave `tradeName` in the breadcrumb unchanged:
```tsx
<h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 max-w-4xl mx-auto">
  {painHeadline}
</h1>
```

Everything else in the component stays exactly as it is.

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: 0 errors. `pnpm lint` runs ESLint only — it does not run TypeScript type checking. Adding a required prop to `TradeHero` without updating the call site in `trade-view.tsx` will not fail ESLint. Full TypeScript checking happens in `pnpm build` in the Final Verification step.

- [ ] **Step 3: Commit**

```bash
git add src/features/landing/ui/components/services/trade-hero.tsx
git commit -m "feat(trade-hero): add painHeadline prop, swap H1 from tradeName to pain-led headline"
```

---

## Task 3: Create `TradeSymptomsBand` — Energy Pillar Pain Strip

**Files:**
- Create: `src/features/landing/ui/components/services/trade-symptoms-band.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/features/landing/ui/components/services/trade-symptoms-band.tsx
interface TradeSymptomsBandProps {
  symptoms: string[]
}

export function TradeSymptomsBand({ symptoms }: TradeSymptomsBandProps) {
  if (symptoms.length === 0) {
    return null
  }

  return (
    <section className="bg-amber-50 border-y border-amber-200 py-6">
      <div className="container">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-700 mb-4">
          😓 Sound familiar?
        </p>
        <div className="flex flex-wrap gap-2">
          {symptoms.map((symptom) => (
            <span
              key={symptom}
              className="px-3 py-1.5 rounded-full bg-white border border-amber-200 text-xs font-semibold text-amber-900"
            >
              {symptom}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: 0 errors for this file.

- [ ] **Step 3: Commit**

```bash
git add src/features/landing/ui/components/services/trade-symptoms-band.tsx
git commit -m "feat(trade-page): add TradeSymptomsBand component for energy pillar pain acknowledgment"
```

---

## Task 4: Create `TradeBeforeAfter` — Luxury Pillar Pain Section

**Files:**
- Create: `src/features/landing/ui/components/services/trade-before-after.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/features/landing/ui/components/services/trade-before-after.tsx
interface TradeBeforeAfterProps {
  before: string[]
  after: string[]
}

export function TradeBeforeAfter({ before, after }: TradeBeforeAfterProps) {
  if (before.length === 0) {
    return null
  }

  return (
    <section className="container py-10">
      <div className="rounded-lg border bg-background overflow-hidden">
        <div className="grid sm:grid-cols-2">
          <div className="p-6 bg-destructive/5">
            <p className="text-xs font-semibold uppercase tracking-widest text-destructive/70 mb-4">
              😓 Right now
            </p>
            <ul className="space-y-2">
              {before.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-destructive/60 mt-0.5" aria-hidden="true">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="p-6 bg-primary/5 border-t sm:border-t-0 sm:border-l border-border">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-4">
              ✅ After Tri Pros
            </p>
            <ul className="space-y-2">
              {after.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="text-primary mt-0.5" aria-hidden="true">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: 0 errors for this file.

- [ ] **Step 3: Commit**

```bash
git add src/features/landing/ui/components/services/trade-before-after.tsx
git commit -m "feat(trade-page): add TradeBeforeAfter component for luxury pillar pain acknowledgment"
```

---

## Task 5: Update `PortfolioProof` — Featured Story Layout

**Files:**
- Modify: `src/features/landing/ui/components/services/portfolio-proof.tsx`

**Replace the entire file** (same async RSC pattern, same filter logic, new rendering):

- [ ] **Step 1: Rewrite `portfolio-proof.tsx`**

```tsx
// src/features/landing/ui/components/services/portfolio-proof.tsx
import Image from 'next/image'
import Link from 'next/link'

import { getPublicProjects } from '@/features/landing/dal/server/projects'

interface PortfolioProofProps {
  tradeName: string
}

export async function PortfolioProof({ tradeName }: PortfolioProofProps) {
  const allProjects = await getPublicProjects()

  const tradeNameLower = tradeName.toLowerCase()
  const matchingProjects = allProjects
    .filter((p) => {
      const requirements = p.project.hoRequirements
      if (!requirements || !Array.isArray(requirements)) {
        return false
      }
      return requirements.some(req =>
        req.toLowerCase().includes(tradeNameLower),
      )
    })
    .slice(0, 3)

  if (matchingProjects.length === 0) {
    return null
  }

  const [featured, ...minis] = matchingProjects

  const cityList = matchingProjects
    .map((p) => p.project.city)
    .filter(Boolean)
    .join(', ')

  return (
    <section className="container py-16 lg:py-24">
      <div className="text-center mb-12">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
          Real results
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
          A home transformed — just like yours.
        </h2>
        {cityList && (
          <p className="text-sm text-muted-foreground mt-3">
            {cityList}
            {' '}
            — real Tri Pros projects near you
          </p>
        )}
      </div>

      {/* Featured card */}
      <div className="grid sm:grid-cols-2 rounded-xl overflow-hidden border bg-card mb-6">
        <div className="relative h-52 sm:h-auto">
          {featured.heroImage?.url
            ? (
                <Image
                  src={featured.heroImage.url}
                  alt={featured.project.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 50vw"
                  priority
                />
              )
            : (
                <div className="absolute inset-0 bg-muted" />
              )}
        </div>
        <div className="p-6 flex flex-col justify-between">
          <div>
            {featured.project.backstory && (
              <blockquote className="text-sm text-muted-foreground italic leading-relaxed border-l-2 border-primary pl-4 mb-4">
                {featured.project.backstory}
              </blockquote>
            )}
            <p className="text-xs font-semibold text-foreground">
              {featured.project.title}
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">
              {featured.project.city}
              {featured.project.state ? `, ${featured.project.state}` : ''}
            </p>
          </div>
          <Link
            href={`/portfolio/${featured.project.accessor}`}
            className="text-sm font-semibold text-primary hover:underline mt-4 inline-block"
          >
            See full project →
          </Link>
        </div>
      </div>

      {/* Mini cards */}
      {minis.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-4">
          {minis.map(({ project, heroImage }) => (
            <Link
              key={project.id}
              href={`/portfolio/${project.accessor}`}
              className="group block overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-lg"
            >
              <div className="relative h-36 overflow-hidden">
                {heroImage?.url
                  ? (
                      <Image
                        src={heroImage.url}
                        alt={project.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, 50vw"
                      />
                    )
                  : (
                      <div className="absolute inset-0 bg-muted flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">No image</span>
                      </div>
                    )}
              </div>
              <div className="p-4">
                <p className="text-xs font-semibold text-foreground">
                  {project.title}
                </p>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">
                  {project.city}
                  {project.state ? `, ${project.state}` : ''}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: 0 errors. If `perfectionist/sort-imports` flags ordering, fix import order (external first: `next/image`, `next/link`; then internal: `@/features/...`).

- [ ] **Step 3: Commit**

```bash
git add src/features/landing/ui/components/services/portfolio-proof.tsx
git commit -m "feat(portfolio-proof): featured story layout — 1 large card with backstory quote + 2 mini cards"
```

---

## Task 6: Update `TradeBenefitsSection` — Stat-First Format

**Files:**
- Modify: `src/features/landing/ui/components/services/trade-benefits-section.tsx`

- [ ] **Step 1: Update props type + render logic**

**Change the import at the top** — add:
```ts
import type { TradeBenefit } from '@/features/landing/constants/trade-benefits'
```

**Update the interface** — replace inline type with named import:
```ts
interface TradeBenefitsSectionProps {
  tradeName: string
  benefits: TradeBenefit[]
}
```

**Update the card body** — inside the `.map()`, replace the `CardHeader` contents:

Old:
```tsx
<CardHeader className="items-center pb-0">
  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
    <CheckCircle2 className="size-6 text-primary" />
  </div>
  <CardTitle className="text-lg">{benefit.title}</CardTitle>
</CardHeader>
```

New:
```tsx
<CardHeader className="items-center pb-0">
  {benefit.stat != null
    ? (
        <span className="text-2xl font-black text-primary mb-2">
          {benefit.stat}
        </span>
      )
    : (
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
          <CheckCircle2 className="size-5 text-primary/60" />
        </div>
      )}
  <CardTitle className="text-lg">{benefit.title}</CardTitle>
</CardHeader>
```

The `CardContent` section is unchanged.

The complete updated file:

```tsx
'use client'

import type { TradeBenefit } from '@/features/landing/constants/trade-benefits'

import { CheckCircle2 } from 'lucide-react'
import { motion, useInView } from 'motion/react'
import { useRef } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'

interface TradeBenefitsSectionProps {
  tradeName: string
  benefits: TradeBenefit[]
}

export function TradeBenefitsSection({ tradeName, benefits }: TradeBenefitsSectionProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  if (benefits.length === 0) {
    return null
  }

  return (
    <section ref={ref} className="container py-16 lg:py-24">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12"
      >
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
          What
          {' '}
          {tradeName}
          {' '}
          Does for Your Home
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {benefits.map((benefit, index) => (
          <motion.div
            key={benefit.title}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.5, delay: index * 0.15 }}
          >
            <Card className="h-full text-center">
              <CardHeader className="items-center pb-0">
                {benefit.stat != null
                  ? (
                      <span className="text-2xl font-black text-primary mb-2">
                        {benefit.stat}
                      </span>
                    )
                  : (
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                        <CheckCircle2 className="size-5 text-primary/60" />
                      </div>
                    )}
                <CardTitle className="text-lg">{benefit.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {benefit.description}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/landing/ui/components/services/trade-benefits-section.tsx
git commit -m "feat(trade-benefits): stat-first benefit cards — show numeric stat prominently, fall back to check icon"
```

---

## Task 7: Wire `trade-view.tsx` — Pillar-Adaptive Pain Section + Pain Headline

**Files:**
- Modify: `src/features/landing/ui/views/trade-view.tsx`

This is the final wiring task. It adds three imports, three constant resolutions, passes `painHeadline` to `TradeHero`, and inserts the pillar-adaptive pain section after `NotionRefreshButton`.

- [ ] **Step 1: Write the complete updated `trade-view.tsx`**

```tsx
import type { PillarSlug, TradeWithScopes } from '@/features/landing/lib/notion-trade-helpers'

import Link from 'next/link'

import { pillarConfigs } from '@/features/landing/constants/pillar-config'
import { tradeBeforeAfter } from '@/features/landing/constants/trade-before-after'
import { tradeBenefits } from '@/features/landing/constants/trade-benefits'
import { tradePainHeadlines } from '@/features/landing/constants/trade-pain-headlines'
import { tradePairings } from '@/features/landing/constants/trade-pairings'
import { tradeOutcomeStatements } from '@/features/landing/constants/trade-outcome-statements'
import { tradeSymptoms } from '@/features/landing/constants/trade-symptoms'
import { NaturalPairings } from '@/features/landing/ui/components/services/natural-pairings'
import { NotionRefreshButton } from '@/features/landing/ui/components/services/notion-refresh-button'
import { PortfolioProof } from '@/features/landing/ui/components/services/portfolio-proof'
import { ProgramsTeaser } from '@/features/landing/ui/components/services/programs-teaser'
import { ScopesGrid } from '@/features/landing/ui/components/services/scopes-grid'
import { SwceSection } from '@/features/landing/ui/components/services/swce-section'
import { TradeBeforeAfter } from '@/features/landing/ui/components/services/trade-before-after'
import { TradeBenefitsSection } from '@/features/landing/ui/components/services/trade-benefits-section'
import { TradeHero } from '@/features/landing/ui/components/services/trade-hero'
import { TradeSymptomsBand } from '@/features/landing/ui/components/services/trade-symptoms-band'
import { BottomCTA } from '@/shared/components/cta'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'

interface TradeViewProps {
  trade: TradeWithScopes
  pillarSlug: PillarSlug
}

export function TradeView({ trade, pillarSlug }: TradeViewProps) {
  const pillarConfig = pillarConfigs[pillarSlug]
  const pillarType = pillarSlug === 'energy-efficient-construction' ? 'energy' : 'luxury'
  // PillarSlug is 'energy-efficient-construction' | 'luxury-renovations' — ternary is exhaustive
  const isEnergy = pillarSlug === 'energy-efficient-construction'

  const FALLBACK_HEADLINE = "Let's get your home where it should be."
  const painHeadline = tradePainHeadlines[trade.slug] ?? FALLBACK_HEADLINE
  const symptoms = tradeSymptoms[trade.slug] ?? []
  const beforeAfter = tradeBeforeAfter[trade.slug]

  const outcomeStatement = tradeOutcomeStatements[trade.slug]
    ?? `Professional ${trade.name.toLowerCase()} services backed by a written workmanship warranty.`
  const benefits = tradeBenefits[trade.slug] ?? []
  const pairings = tradePairings[trade.slug] ?? []

  return (
    <main>
      <TradeHero
        tradeName={trade.name}
        outcomeStatement={outcomeStatement}
        images={trade.images}
        defaultHeroImage={pillarConfig.defaultHeroImage}
        pillarSlug={pillarSlug}
        pillarTitle={pillarConfig.title}
        painHeadline={painHeadline}
      />

      <NotionRefreshButton />

      {isEnergy
        ? <TradeSymptomsBand symptoms={symptoms} />
        : beforeAfter != null
          ? <TradeBeforeAfter before={beforeAfter.before} after={beforeAfter.after} />
          : null}

      {/* Social proof — real work closes faster than promises */}
      <PortfolioProof tradeName={trade.name} />

      {/* Mid-page CTA — catch visitors convinced by the portfolio */}
      <section className="border-y border-primary/10 bg-primary/5">
        <div className="container py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-lg text-foreground">
              Ready to see what we can do for your home?
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Free in-home consultation. No pressure, no obligation.
            </p>
          </div>
          <Button asChild size="lg" variant="cta" className="shrink-0">
            <Link href={ROOTS.landing.contact()}>
              Schedule Now
            </Link>
          </Button>
        </div>
      </section>

      <TradeBenefitsSection tradeName={trade.name} benefits={benefits} />

      <ScopesGrid scopes={trade.scopes} />

      <NaturalPairings pairings={pairings} />

      <SwceSection variant="compact" />

      <ProgramsTeaser pillarType={pillarType} />

      <BottomCTA />
    </main>
  )
}
```

**Import ordering note**: The `perfectionist/sort-imports` rule requires external packages before internal (`@/...`) imports. Within the internal group, imports are sorted alphabetically. The order above follows: `next/link` (external) → `@/features/landing/constants/...` (internal, alpha) → `@/features/landing/ui/...` (internal) → `@/shared/...` (internal).

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: 0 errors. If the linter flags import order, re-sort the `@/features/landing/constants/` block alphabetically:
- `pillar-config`
- `trade-before-after`
- `trade-benefits`
- `trade-outcome-statements`
- `trade-pain-headlines`
- `trade-pairings`
- `trade-symptoms`

- [ ] **Step 3: Commit**

```bash
git add src/features/landing/ui/views/trade-view.tsx
git commit -m "feat(trade-view): wire pillar-adaptive pain section, pain-led hero, and new component imports"
```

---

## Final Verification

- [ ] **Run full lint one last time**

```bash
pnpm lint
```

Expected: 0 errors.

- [ ] **Verify build compiles**

```bash
pnpm build
```

Expected: Successful build. If TypeScript errors surface (e.g., `tradeBenefits` type mismatch from the `trade-view.tsx` usage), trace the error to the `benefits` variable and confirm it picks up the new `TradeBenefit[]` type from `trade-benefits.ts`.

---

## Edge Case Reference (from spec §9)

| Scenario | Behavior |
|---|---|
| Trade slug not in `tradePainHeadlines` | `FALLBACK_HEADLINE` fires via `??` in `trade-view.tsx` |
| Trade slug not in `tradeSymptoms` (energy) | `symptoms` defaults to `[]`; `TradeSymptomsBand` returns `null` |
| Trade slug not in `tradeBeforeAfter` (luxury) | `beforeAfter` is `undefined`; condition renders `null` |
| Portfolio has 0 projects | `PortfolioProof` returns `null` (unchanged behavior) |
| Portfolio has 1 project | Featured card renders; `minis` is `[]`; mini grid not rendered |
| Portfolio has 2 projects | Featured card + 1 mini card |
| Benefit has no `stat` | `benefit.stat != null` is false → check icon renders |
| Project has no `backstory` | `featured.project.backstory` is falsy → blockquote not rendered |
