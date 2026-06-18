# Funnels Domain & Config Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote funnels to a shared domain (`src/shared/domains/funnels/`) with a canonical-slug vocabulary and a config-as-code `FunnelSpec` contract + registry, fixing the Plan 1 `shared→features` import violation and the redundant subdomain/trade map.

**Architecture:** A pure-leaf `slugs.ts` holds the canonical slug list/type/guard and is the *only* funnel module the shared middleware/`roots.ts`/`subdomains.ts` import. A `types.ts` defines the declarative `FunnelSpec` contract (content / theme / steps / flow / pixel). A static, exhaustive registry resolves `slug → spec`. Three spec **stubs** (content + theme; empty steps, linear flow) let the route render trade-correct content now; the engine + step library are deferred to Plan 2.

**Tech Stack:** Next.js 15.5.9 (App Router, `src/` dir), TypeScript, Vercel.

**Spec:** `docs/superpowers/specs/2026-06-18-funnels-domain-config-architecture-design.md`

## Global Constraints

- **Named exports only** — never `export default` (except Next.js `page.tsx`/`layout.tsx`, which require a default export by framework convention).
- **No unit-test runner exists.** Verification = `pnpm tsc` (type-check) + `pnpm lint` + runtime smoke (`curl`). Do NOT add vitest/jest.
- **Imports must be sorted** (`perfectionist/sort-imports`: external before internal, alphabetical within groups; named imports alphabetical). Run `pnpm lint:fix` to auto-fix ordering.
- **`if` bodies need braces + newline** (`antfu/if-newline`) — no single-line `if`.
- **Path alias:** `@/` → `src/`.
- **No hardcoded route paths** — all internal paths come from `ROOTS`.
- **Canonical slugs are exactly:** `kitchens`, `bathrooms`, `complete-interior`. Used identically as subdomain label, route segment, registry key, and spec key.
- **`shared/` never imports from `features/`.** After this plan, all funnel consumers import from `shared/domains/funnels/` (shared→shared).
- **Registry note (vs spec §4):** the spec described a `registerFunnel()` load-time side-effect mirroring `registerEntity`. We implement a **static, exhaustive `Record<FunnelSlug, FunnelSpec>`** instead — same centralized resolution, but completeness is enforced at compile time (omit a slug → `tsc` error) and there is no Next.js module-load-order fragility. Deliberate, documented deviation.

---

### Task 1: Funnels domain foundation (slugs, contract, registry, stubs)

Creates the new `shared/domains/funnels/` domain. Nothing imports it yet — it is verified standalone via a `tsx` sanity check. Subsequent tasks wire consumers to it.

**Files:**
- Create: `src/shared/domains/funnels/constants/slugs.ts`
- Create: `src/shared/domains/funnels/types.ts`
- Create: `src/shared/domains/funnels/constants/kitchens.ts`
- Create: `src/shared/domains/funnels/constants/bathrooms.ts`
- Create: `src/shared/domains/funnels/constants/complete-interior.ts`
- Create: `src/shared/domains/funnels/lib/registry.ts`

**Interfaces:**
- Produces:
  - `FUNNEL_SLUGS: readonly ['kitchens', 'bathrooms', 'complete-interior']`
  - `type FunnelSlug = 'kitchens' | 'bathrooms' | 'complete-interior'`
  - `isFunnelSlug(value: string): value is FunnelSlug`
  - `interface FunnelSpec { slug: FunnelSlug; content: FunnelContent; theme: FunnelTheme; steps: FunnelStep[]; flow: (answers: FunnelAnswers) => StepId | null; pixel: { contentCategory: string } }`
  - `getFunnel(slug: FunnelSlug): FunnelSpec`
  - `kitchensFunnel`, `bathroomsFunnel`, `completeInteriorFunnel` (each `FunnelSpec`)

- [ ] **Step 1: Create the canonical slug leaf**

```ts
// src/shared/domains/funnels/constants/slugs.ts

/**
 * Canonical funnel slugs. Single source of truth, used identically as the
 * subdomain label, the route segment, the registry key, and the spec key.
 *
 * PURE LEAF — imports nothing. Consumed by the middleware, roots.ts, and
 * subdomains.ts (all shared), so it must never pull in the registry or specs
 * (which transitively reach React UI in Plan 2).
 */
export const FUNNEL_SLUGS = ['kitchens', 'bathrooms', 'complete-interior'] as const

export type FunnelSlug = (typeof FUNNEL_SLUGS)[number]

export function isFunnelSlug(value: string): value is FunnelSlug {
  return (FUNNEL_SLUGS as readonly string[]).includes(value)
}
```

- [ ] **Step 2: Create the `FunnelSpec` contract**

```ts
// src/shared/domains/funnels/types.ts
import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'

/** Stable identifier for a step within a funnel. Plan 2 narrows this. */
export type StepId = string

/**
 * Pure copy / media / labels for a funnel. Isolated from logic so its SOURCE
 * can later move to a DB/CMS row without touching the engine or steps.
 * Plan 2 extends this (per-step copy, before/after media, disclaimers).
 */
export interface FunnelContent {
  /** Hero + document title, e.g. "Kitchen Showcase". */
  title: string
  /** Hero headline. */
  headline: string
  /** Hero subhead. */
  subhead: string
  /** Real, stated scarcity line, e.g. "We're selecting 5 kitchens in your area." */
  scarcityLine: string
}

/** Per-trade visual accent tokens. Plan 2 extends with the full theme. */
export interface FunnelTheme {
  /** Accent color token (Tailwind/CSS var name). */
  accent: string
}

/** A single funnel step. Plan 2 defines the discriminated step-type union. */
export interface FunnelStep {
  id: StepId
}

/** Transient in-memory answer bag keyed by step id. Plan 2 types per step. */
export type FunnelAnswers = Partial<Record<StepId, unknown>>

/**
 * Centralized declarative configuration for one funnel — the EntityServerSpec
 * analog. The only trade-aware object; the engine and steps are funnel-agnostic.
 */
export interface FunnelSpec {
  slug: FunnelSlug
  content: FunnelContent
  theme: FunnelTheme
  /** Ordered steps composed from the shared library. Empty until Plan 2. */
  steps: FunnelStep[]
  /** Per-funnel branching, as CODE. Returns the next step id, or null to end. */
  flow: (answers: FunnelAnswers) => StepId | null
  /** Trade parameter carried on the shared Meta Pixel/dataset. */
  pixel: { contentCategory: string }
}
```

- [ ] **Step 3: Create the three spec stubs**

```ts
// src/shared/domains/funnels/constants/kitchens.ts
import type { FunnelSpec } from '@/shared/domains/funnels/types'

/** Kitchen Showcase funnel. Stub: content + theme only; Plan 2 fills steps/flow. */
export const kitchensFunnel: FunnelSpec = {
  slug: 'kitchens',
  content: {
    title: 'Kitchen Showcase',
    headline: 'Get a AAA-grade kitchen remodel — at a Showcase price.',
    subhead: 'See if your home qualifies for one of our Showcase kitchens.',
    scarcityLine: 'We’re selecting 5 kitchens in your area.',
  },
  theme: { accent: 'primary' },
  steps: [],
  flow: () => null,
  pixel: { contentCategory: 'kitchen' },
}
```

```ts
// src/shared/domains/funnels/constants/bathrooms.ts
import type { FunnelSpec } from '@/shared/domains/funnels/types'

/** Bathroom Showcase funnel. Stub: content + theme only; Plan 2 fills steps/flow. */
export const bathroomsFunnel: FunnelSpec = {
  slug: 'bathrooms',
  content: {
    title: 'Bathroom Showcase',
    headline: 'Get a AAA-grade bathroom remodel — at a Showcase price.',
    subhead: 'See if your home qualifies for one of our Showcase bathrooms.',
    scarcityLine: 'We’re selecting 5 bathrooms in your area.',
  },
  theme: { accent: 'primary' },
  steps: [],
  flow: () => null,
  pixel: { contentCategory: 'bathroom' },
}
```

```ts
// src/shared/domains/funnels/constants/complete-interior.ts
import type { FunnelSpec } from '@/shared/domains/funnels/types'

/** Complete-Interior Showcase funnel. Stub: content + theme only; Plan 2 fills steps/flow. */
export const completeInteriorFunnel: FunnelSpec = {
  slug: 'complete-interior',
  content: {
    title: 'Complete-Interior Showcase',
    headline: 'Get a AAA-grade whole-interior remodel — at a Showcase price.',
    subhead: 'See if your home qualifies for one of our Complete-Interior Showcase spots.',
    scarcityLine: 'We’re selecting 5 homes in your area.',
  },
  theme: { accent: 'primary' },
  steps: [],
  flow: () => null,
  pixel: { contentCategory: 'complete-interior' },
}
```

- [ ] **Step 4: Create the static, exhaustive registry**

```ts
// src/shared/domains/funnels/lib/registry.ts
import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import type { FunnelSpec } from '@/shared/domains/funnels/types'
import { bathroomsFunnel } from '@/shared/domains/funnels/constants/bathrooms'
import { completeInteriorFunnel } from '@/shared/domains/funnels/constants/complete-interior'
import { kitchensFunnel } from '@/shared/domains/funnels/constants/kitchens'

/**
 * Centralized slug → spec resolution. A static, exhaustive Record (not a
 * load-time register() side-effect): completeness is guaranteed at compile
 * time — omit a slug and tsc errors here. See plan Global Constraints.
 */
const FUNNELS: Record<FunnelSlug, FunnelSpec> = {
  'kitchens': kitchensFunnel,
  'bathrooms': bathroomsFunnel,
  'complete-interior': completeInteriorFunnel,
}

export function getFunnel(slug: FunnelSlug): FunnelSpec {
  return FUNNELS[slug]
}
```

- [ ] **Step 5: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors. (If lint flags import order, run `pnpm lint:fix`, then re-run.)

- [ ] **Step 6: Sanity-check the registry resolves all three slugs**

Run: `pnpm tsx -e "import('./src/shared/domains/funnels/lib/registry.ts').then(async m => { const { FUNNEL_SLUGS } = await import('./src/shared/domains/funnels/constants/slugs.ts'); console.log(FUNNEL_SLUGS.map(s => [s, m.getFunnel(s).content.title])) })"`
Expected output (order may vary):
`[ [ 'kitchens', 'Kitchen Showcase' ], [ 'bathrooms', 'Bathroom Showcase' ], [ 'complete-interior', 'Complete-Interior Showcase' ] ]`

- [ ] **Step 7: Commit**

```bash
git add src/shared/domains/funnels
git commit -m "feat(funnels): shared funnels domain — slugs, FunnelSpec, registry, stubs"
```

---

### Task 2: Rewire shared config to the domain + canonical slug

Points `roots.ts` and `subdomains.ts` at the new domain leaf, collapses the `FunnelSubdomain`/`FunnelTrade` split into `FunnelSlug`, and deletes the old feature constant. The route page still imports the old file at this point — it is rewired in Task 4 — so deletion happens there, not here.

**Files:**
- Modify: `src/shared/config/roots.ts:3` (import), `src/shared/config/roots.ts:95-100` (`funnels` block)
- Modify: `src/shared/config/subdomains.ts` (whole file)

**Interfaces:**
- Consumes: `FUNNEL_SLUGS`, `FunnelSlug` (Task 1).
- Produces: `ROOTS.funnels.trade(slug: FunnelSlug, options?: UrlOptions): string`, `ROOTS.funnels.subdomain(slug: FunnelSlug): string`, `SUBDOMAIN_ROUTES: Record<string, string>` (unchanged exported name/shape).

- [ ] **Step 1: Swap the funnel import in `roots.ts`**

In `src/shared/config/roots.ts`, replace the line:

```ts
import type { FunnelSubdomain, FunnelTrade } from '@/features/funnels/constants/funnel-hosts'
```

with:

```ts
import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'
```

- [ ] **Step 2: Update the `funnels` block in `roots.ts`**

In `src/shared/config/roots.ts`, replace the `funnels` block inside `APP_ROOTS`:

```ts
  funnels: {
    // Internal rewrite TARGET — middleware rewrites a funnel host to this path.
    trade: (trade: FunnelTrade, options?: UrlOptions) => generateUrl(`/funnels/${trade}`, options),
    // Public subdomain URL — what we hand to Meta / link externally.
    subdomain: (sub: FunnelSubdomain) => `https://${sub}.${APP_HOSTS.prod[0]}`,
  },
```

with (one canonical slug param for both):

```ts
  funnels: {
    // Internal rewrite TARGET — middleware rewrites a funnel host to this path.
    trade: (slug: FunnelSlug, options?: UrlOptions) => generateUrl(`/funnels/${slug}`, options),
    // Public subdomain URL — what we hand to Meta / link externally.
    subdomain: (slug: FunnelSlug) => `https://${slug}.${APP_HOSTS.prod[0]}`,
  },
```

- [ ] **Step 3: Rewrite `subdomains.ts` to build from `FUNNEL_SLUGS`**

Replace the whole of `src/shared/config/subdomains.ts`:

```ts
import { ROOTS } from '@/shared/config/roots'
import { FUNNEL_SLUGS } from '@/shared/domains/funnels/constants/slugs'

/**
 * Single source of truth: subdomain label → internal base path the
 * middleware rewrites to. Adding a new funnel subdomain = one slug in
 * FUNNEL_SLUGS (src/shared/domains/funnels/constants/slugs.ts).
 *
 * `voip` is intentionally NOT registered yet — the `/voip` route group does
 * not exist. When it does, add: `voip: ROOTS.voip.root(),`
 */
export const SUBDOMAIN_ROUTES: Record<string, string> = Object.fromEntries(
  FUNNEL_SLUGS.map(slug => [slug, ROOTS.funnels.trade(slug)]),
)
```

- [ ] **Step 4: Delete the obsolete feature constant**

Run: `git rm "src/features/funnels/constants/funnel-hosts.ts"`
Then remove the now-empty directories if git left them:
Run: `rmdir -p src/features/funnels/constants 2>/dev/null; true`

- [ ] **Step 5: Verify nothing still references the old module or vocabulary**

Run: `grep -rn "funnel-hosts\|FUNNEL_SUBDOMAINS\|FunnelSubdomain\|FunnelTrade\|FUNNEL_TRADES" src next.config.ts`
Expected: **only** matches in `src/app/(frontend)/funnels/[trade]/page.tsx` (rewired in Task 4). No matches in `roots.ts` or `subdomains.ts`.

- [ ] **Step 6: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors. (Run `pnpm lint:fix` if import order flags, then re-run.)

- [ ] **Step 7: Sanity-check `SUBDOMAIN_ROUTES`**

Run: `pnpm tsx -e "import('./src/shared/config/subdomains.ts').then(m => console.log(m.SUBDOMAIN_ROUTES))"`
Expected output: `{ kitchens: '/funnels/kitchens', bathrooms: '/funnels/bathrooms', 'complete-interior': '/funnels/complete-interior' }`

- [ ] **Step 8: Commit**

```bash
git add src/shared/config/roots.ts src/shared/config/subdomains.ts
git commit -m "refactor(funnels): rewire shared config to funnels domain + canonical slug"
```

---

### Task 3: Derive dev hosts from `FUNNEL_SLUGS` (findings 4 + 5)

Removes the triplicated, hardcoded funnel dev-host strings. `APP_HOSTS.dev` and `next.config.ts`'s `allowedDevOrigins` both derive their funnel entries from `FUNNEL_SLUGS`, across every dev port (fixes the worktree `:3001/:3002` gap).

**Files:**
- Modify: `src/shared/config/roots.ts:6-17` (`APP_HOSTS`) + import
- Modify: `next.config.ts:11-16` (`allowedDevOrigins`) + import

**Interfaces:**
- Consumes: `FUNNEL_SLUGS` (Task 1).
- Produces: `APP_HOSTS.dev` now includes `<slug>.localhost:<port>` for every slug × dev port; `allowedDevOrigins` includes `<slug>.localhost` for every slug.

- [ ] **Step 1: Add the value import + derive funnel dev hosts in `roots.ts`**

In `src/shared/config/roots.ts`, add (with the existing `import type { FunnelSlug }` line from Task 2 — keep imports sorted, run `lint:fix` if needed):

```ts
import { FUNNEL_SLUGS } from '@/shared/domains/funnels/constants/slugs'
```

Then, immediately above `export const APP_HOSTS = {`, add:

```ts
const DEV_PORTS = ['3000', '3001', '3002'] as const

// Funnel subdomains on every dev port (e.g. kitchens.localhost:3001) so they
// resolve in worktrees too — browsers map *.localhost to loopback with no
// hosts-file edits. Derived from FUNNEL_SLUGS — adding a funnel needs no edit here.
const FUNNEL_DEV_HOSTS = FUNNEL_SLUGS.flatMap(slug =>
  DEV_PORTS.map(port => `${slug}.localhost:${port}`),
)
```

- [ ] **Step 2: Replace the hardcoded `dev` array in `APP_HOSTS`**

In `src/shared/config/roots.ts`, replace:

```ts
  dev: [
    'localhost:3000',
    'localhost:3001',
    'localhost:3002',
    'kitchens.localhost:3000',
    'bathrooms.localhost:3000',
    'interiors.localhost:3000',
  ],
```

with:

```ts
  dev: [
    ...DEV_PORTS.map(port => `localhost:${port}`),
    ...FUNNEL_DEV_HOSTS,
  ],
```

- [ ] **Step 3: Derive `allowedDevOrigins` in `next.config.ts`**

In `next.config.ts`, add the import beneath the existing `APP_HOSTS` import:

```ts
import { FUNNEL_SLUGS } from './src/shared/domains/funnels/constants/slugs'
```

Then replace:

```ts
  allowedDevOrigins: [
    ...APP_HOSTS.tunnel,
    'kitchens.localhost',
    'bathrooms.localhost',
    'interiors.localhost',
  ],
```

with:

```ts
  allowedDevOrigins: [
    ...APP_HOSTS.tunnel,
    ...FUNNEL_SLUGS.map(slug => `${slug}.localhost`),
  ],
```

- [ ] **Step 4: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors. (Run `pnpm lint:fix` if import order flags, then re-run.)

- [ ] **Step 5: Sanity-check the derived hosts**

Run: `pnpm tsx -e "import('./src/shared/config/roots.ts').then(m => console.log(m.APP_HOSTS.dev))"`
Expected output (a flat array): `localhost:3000/3001/3002` followed by each slug × port, e.g. `kitchens.localhost:3000`, `kitchens.localhost:3001`, …, `complete-interior.localhost:3002`. No `interiors.localhost` anywhere.

- [ ] **Step 6: Commit**

```bash
git add src/shared/config/roots.ts next.config.ts
git commit -m "refactor(funnels): derive dev hosts + allowedDevOrigins from FUNNEL_SLUGS"
```

---

### Task 4: Rewire the route page to the domain + runtime smoke

Replaces the route page's old funnel-hosts imports and `as FunnelTrade` cast with `isFunnelSlug` + `getFunnel`, rendering the branded title/subhead from spec content. After this, the old vocabulary is fully gone.

**Files:**
- Modify: `src/app/(frontend)/funnels/[trade]/page.tsx` (whole file)

**Interfaces:**
- Consumes: `isFunnelSlug` (Task 1), `getFunnel` (Task 1).

- [ ] **Step 1: Replace the route page**

Replace the whole of `src/app/(frontend)/funnels/[trade]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { isFunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import { getFunnel } from '@/shared/domains/funnels/lib/registry'

interface Props {
  params: Promise<{ trade: string }>
}

export default async function FunnelPage({ params }: Props) {
  const { trade } = await params

  // Only the three canonical funnel slugs resolve; anything else 404s.
  if (!isFunnelSlug(trade)) {
    notFound()
  }

  const funnel = getFunnel(trade)

  // Plan 2 replaces this shell with the multi-step funnel engine.
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-semibold" data-funnel-slug={funnel.slug}>
        {funnel.content.title}
      </h1>
      <p className="text-muted-foreground mt-2">{funnel.content.subhead}</p>
    </main>
  )
}
```

- [ ] **Step 2: Confirm the old vocabulary is fully gone**

Run: `grep -rn "funnel-hosts\|FUNNEL_SUBDOMAINS\|FunnelSubdomain\|FunnelTrade\|FUNNEL_TRADES\|interiors" src next.config.ts`
Expected: **no matches.**

- [ ] **Step 3: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors.

- [ ] **Step 4: Runtime smoke — subdomains render trade-correct content; apex unaffected**

Start the dev server in a separate terminal (`pnpm dev`), then:

Run: `curl -s -H "Host: kitchens.localhost:3000" http://127.0.0.1:3000/ | grep -o 'data-funnel-slug="kitchens"'`
Expected: `data-funnel-slug="kitchens"`

Run: `curl -s -H "Host: kitchens.localhost:3000" http://127.0.0.1:3000/ | grep -o 'Kitchen Showcase'`
Expected: `Kitchen Showcase`

Run: `curl -s -o /dev/null -w "%{http_code}\n" -H "Host: complete-interior.localhost:3000" http://127.0.0.1:3000/`
Expected: `200`

Run: `curl -s -o /dev/null -w "%{http_code}\n" -H "Host: interiors.localhost:3000" http://127.0.0.1:3000/`
Expected: `404` (old slug no longer registered → falls through → no `/funnels/interiors` route)

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/`
Expected: `200` (apex marketing home still works — funnels are additive)

- [ ] **Step 5: Commit**

```bash
git add "src/app/(frontend)/funnels/[trade]/page.tsx"
git commit -m "refactor(funnels): route page reads FunnelSpec via registry + isFunnelSlug"
```

---

### Task 5: Update the subdomain-routing convention doc

Brings `docs/codebase-conventions/subdomain-routing.md` in line with the domain + canonical slugs.

**Files:**
- Modify: `docs/codebase-conventions/subdomain-routing.md`

- [ ] **Step 1: Update the "How it works" reference + "Adding a subdomain" + "Current registry"**

In `docs/codebase-conventions/subdomain-routing.md`:

Change the step-2 lookup line under "How it works" to point at the domain leaf:

```markdown
2. It looks that label up in `SUBDOMAIN_ROUTES`
   (`src/shared/config/subdomains.ts`), which derives from the canonical
   `FUNNEL_SLUGS` (`src/shared/domains/funnels/constants/slugs.ts`).
```

Replace the "Adding a subdomain" list with:

```markdown
## Adding a subdomain

For a **funnel** subdomain, add one slug to `FUNNEL_SLUGS`
(`src/shared/domains/funnels/constants/slugs.ts`) and a matching `FunnelSpec`
stub in `src/shared/domains/funnels/constants/`. `SUBDOMAIN_ROUTES`, the dev
hosts (`APP_HOSTS.dev`), and `allowedDevOrigins` all derive from `FUNNEL_SLUGS`
— no other code edits. Then add the prod subdomain to the Vercel wildcard
domain (`*.triprosremodeling.com`) — the one-time wildcard covers all of them.

For a **non-funnel** subdomain (e.g. `voip`): add a path generator to `ROOTS`
(`src/shared/config/roots.ts`), one line to `SUBDOMAIN_ROUTES`, the dev host to
`APP_HOSTS.dev`, and the dev origin to `allowedDevOrigins` (`next.config.ts`).
```

Replace the "Current registry" bullets with:

```markdown
- `kitchens` / `bathrooms` / `complete-interior` → `funnels/[trade]` (Showcase funnels). Note: `funnels` is a real path segment, not a `(funnels)` route group — a group is stripped from the URL, so the `/funnels/[slug]` rewrite would 404.
- `voip` → planned (`/voip`), not yet registered (route group does not exist)
```

- [ ] **Step 2: Commit**

```bash
git add docs/codebase-conventions/subdomain-routing.md
git commit -m "docs(funnels): subdomain-routing doc → funnels domain + canonical slugs"
```

---

## Self-Review

- **Spec coverage:**
  - §1.1 funnels-as-domain → Tasks 1–4 home everything under `shared/domains/funnels/`. ✅
  - §1.2 config-as-code + content seam → `FunnelSpec.content` isolated (Task 1, Step 2). ✅
  - §2 canonical slug unification + `complete-interior` + `isFunnelSlug` guard → Task 1 Step 1, consumed Tasks 2/4. ✅
  - §3 four layers + leaf rule → `slugs.ts` leaf consumed only by config/middleware/page; registry/specs only by page (Tasks 1, 2, 4). ✅
  - §4 `FunnelSpec` contract + registry (static-map deviation documented) → Task 1 Steps 2–4. ✅
  - §5 route/middleware rewiring → Tasks 2 & 4 (middleware untouched; `subdomains.ts` resolves via domain). ✅
  - §6 finding 3 (`complete-interior`) → Task 1; finding 4 (derive dev hosts/origins) → Task 3; finding 5 (worktree ports) → Task 3 ports×slugs; minor cast removal → Task 4. ✅
  - §6 convention doc update → Task 5. ✅
  - §7 scope (stubs now, engine deferred) → `steps: []`, `flow: () => null`. ✅
- **Placeholder scan:** every code step shows full file content or an exact find/replace; every command has expected output. No TBD/TODO. ✅
- **Type consistency:** `FunnelSlug`, `FUNNEL_SLUGS`, `isFunnelSlug`, `getFunnel`, `FunnelSpec`, `kitchensFunnel`/`bathroomsFunnel`/`completeInteriorFunnel`, `ROOTS.funnels.trade(slug)`, `SUBDOMAIN_ROUTES` used identically across Tasks 1–5. The route directory stays `[trade]` (param key `trade`) per spec §5; its value is a `FunnelSlug`. ✅

## Out of scope (Plan 2 — see spec §8)

- The multi-step engine (nav, state persistence/refresh-resume, branching evaluation, UTM capture) and the reusable step library + `Step` contract internals.
- Pixel/CAPI wiring (Plan 3).
- DB/CMS content source behind the content seam.
- Renaming the `[trade]` route segment to `[funnel]` (left as-is to avoid unplanned route churn; revisit if desired).
