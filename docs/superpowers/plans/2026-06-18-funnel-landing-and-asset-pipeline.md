# Funnel Landing Overhaul + Marketing-Block Library + Asset Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn each Meta-ads funnel's first view into a long-scroll, trust-building landing page assembled from a reusable marketing-block library, replace the nonsensical placeholder option icons with accurate visuals + an AI-asset pipeline doc, fix three form-performance issues, and fold in two carried fixes (shared `clientIp`, a11y polish).

**Architecture:** The funnel engine already dispatches steps via a typed `STEP_REGISTRY`. We add a parallel `MARKETING_REGISTRY` of composable trust blocks, render them in a new full-width `FunnelLanding` layout shown only while `engine.isFirst`, and transition to the existing focused `max-w-xl` column on first answer. Marketing blocks live in `shared/domains/funnels/ui/blocks/`, fetch live data via `useTRPC()` (established pattern), and never import from `features/`.

**Tech Stack:** Next.js 15 / React 19 / TypeScript strict, tRPC (`useTRPC()` from `@/trpc/helpers`), Drizzle/Neon, motion/react v12, shadcn/ui, lucide-react. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-18-funnel-landing-and-asset-pipeline-design.md`

## Global Constraints

- Funnel code lives in `src/shared/domains/funnels/`. `shared/` MUST NOT import from `features/`. `useTRPC()` from `@/trpc/helpers` is allowed (see `pii-form-step.tsx`).
- ONE React component per file. No file-level constants/helpers in component files (→ `constants/` / `lib/`). Named exports only. No barrel files in `ui/`/`constants/`/`hooks/`/`lib/`.
- Adds NO new dependencies.
- No `pnpm build`. Verify with `pnpm tsc` and `pnpm lint`. No test runner — pure logic verified with throwaway `tsx` scriptlets (run then delete); UI verified with Playwright-MCP smoke.
- Company data (license #, stats, testimonials) derives from `src/shared/constants/company/` — never hardcode in components.
- Commit with pathspec only: `git commit -m "..." -- <paths>` (run `git status --short` first; never `git add -A`). End commit messages with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer.
- Lint: imports sorted (perfectionist), named imports alphabetical, `if` bodies always braced + newline (antfu/if-newline), no duplicate imports.
- The three Notion trade UUIDs (verified 2026-06-18): `kitchens` → `6240ca1b-548b-837d-a9c0-01acc1fb530a`, `bathrooms` → `1290ca1b-548b-830d-a13c-01e4da06eb3d`, `complete-interior` → `9340ca1b-548b-83d5-b3cd-01b5cce9b199`.

---

## File Structure

**New files:**
- `src/trpc/lib/client-ip.ts` — shared trusted-IP helper (T1)
- `src/shared/domains/funnels/constants/floor-plan-diagrams.tsx` — accurate SVG layout diagrams (T3)
- `docs/funnels/asset-manifest.md` — per-campaign AI-asset worklist (T5)
- `src/shared/domains/funnels/ui/steps/zip-check-progress.tsx` — multi-step ZIP checklist (T7)
- `src/shared/domains/funnels/ui/blocks/reviews-block.tsx` (T10)
- `src/shared/domains/funnels/ui/blocks/testimonials-block.tsx` (T11)
- `src/shared/domains/funnels/ui/blocks/licensing-block.tsx` (T12)
- `src/shared/domains/funnels/ui/blocks/guarantee-block.tsx` (T13)
- `src/shared/domains/funnels/constants/trade-by-slug.ts` (T14)
- `src/shared/domains/funnels/ui/blocks/portfolio-block.tsx` (T14)
- `src/shared/domains/funnels/constants/marketing-registry.ts` (T15)
- `src/shared/domains/funnels/constants/default-landing-blocks.ts` (T15)
- `src/shared/domains/funnels/ui/funnel-landing.tsx` (T16)

**Modified files:**
- `src/trpc/routers/funnels.router.ts` + `src/trpc/routers/customers.router/business.router.ts` (T1)
- `src/shared/domains/funnels/lib/build-lead-input.ts` + `src/shared/domains/funnels/ui/steps/pii-form-step.tsx` (T2)
- `src/shared/domains/funnels/constants/option-assets.tsx` (T3)
- `src/shared/domains/funnels/ui/steps/card-select-step.tsx` (T4)
- `src/shared/domains/funnels/constants/funnel-motion.ts` (T6)
- `src/shared/domains/funnels/ui/steps/location-step.tsx` (T7)
- `src/shared/domains/funnels/types.ts` (T9)
- `src/shared/domains/funnels/ui/funnel-engine.tsx` (T16)

**Deferred appendix (NOT executed this run):** R2 migration (Appendix A).

---

## Task ordering & dependencies

T1, T2, T3, T4, T5, T6 are independent. T7 depends on nothing new. T9 (types) precedes T10–T16. T10–T13 depend on T9. T14 depends on T9. T15 depends on T10–T14. T16 depends on T15 + T9. Recommended execution order is T1→T16 as numbered.

---

### Task 1: Shared `clientIp` helper

**Files:**
- Create: `src/trpc/lib/client-ip.ts`
- Modify: `src/trpc/routers/funnels.router.ts` (remove inline `clientIp` at lines ~46-50; import shared)
- Modify: `src/trpc/routers/customers.router/business.router.ts` (replace spoofable derivation at line ~164)

**Interfaces:**
- Produces: `clientIp(req: Request | undefined): string` — returns `x-vercel-forwarded-for ?? x-real-ip ?? 'anonymous'`.

**Context note:** procedures read the request via `(ctx as { req?: Request }).req`. `ctx.req` is typed on `HTTPTRPCContext` (`src/trpc/types.ts`).

- [ ] **Step 1: Create the shared helper**

```ts
// src/trpc/lib/client-ip.ts

/**
 * Trusted client IP for rate-limiting. Trusts only edge-set headers
 * (`x-vercel-forwarded-for`, `x-real-ip`) — NOT raw `x-forwarded-for`, which a
 * client can spoof to rotate past per-IP limits. Falls back to a fixed key.
 */
export function clientIp(req: Request | undefined): string {
  return req?.headers.get('x-vercel-forwarded-for')
    ?? req?.headers.get('x-real-ip')
    ?? 'anonymous'
}
```

- [ ] **Step 2: Use it in funnels.router.ts**

Delete the inline `clientIp` function (lines ~46-50). Add the import (alphabetically sorted among `@/trpc/...` imports):

```ts
import { clientIp } from '@/trpc/lib/client-ip'
```

The two call sites (`const ip = clientIp((ctx as { req?: Request }).req)`) stay unchanged — they now resolve to the imported helper.

- [ ] **Step 3: Use it in business.router.ts**

Replace line ~164:

```ts
// BEFORE
const ip = (ctx as { req?: Request }).req?.headers.get('x-forwarded-for') ?? 'anonymous'
// AFTER
const ip = clientIp((ctx as { req?: Request }).req)
```

Add the import:

```ts
import { clientIp } from '@/trpc/lib/client-ip'
```

- [ ] **Step 4: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean. Confirm no remaining `x-forwarded-for` reads: `grep -rn "x-forwarded-for" src/trpc/` returns nothing.

- [ ] **Step 5: Commit**

```bash
git commit -m "fix(trpc): trust edge-set client IP via shared clientIp helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/trpc/lib/client-ip.ts src/trpc/routers/funnels.router.ts src/trpc/routers/customers.router/business.router.ts
```

---

### Task 2: A11y/polish — name trim + honeypot

**Files:**
- Modify: `src/shared/domains/funnels/lib/build-lead-input.ts` (name composition, line ~22)
- Modify: `src/shared/domains/funnels/ui/steps/pii-form-step.tsx` (honeypot input, line ~151)

**Interfaces:**
- Consumes: existing `buildLeadInput({ ctx, pii, answers })`.

- [ ] **Step 1: Trim each name part before composing**

In `build-lead-input.ts`, change the `name` composition:

```ts
// BEFORE
name: `${pii.firstName} ${pii.lastName}`.trim(),
// AFTER
name: `${pii.firstName.trim()} ${pii.lastName.trim()}`.trim(),
```

- [ ] **Step 2: Harden the honeypot**

In `pii-form-step.tsx`, the honeypot input (line ~151) — add `aria-hidden` so assistive tech ignores it (it is already `tabIndex={-1}` + `className="hidden"`):

```tsx
<input type="text" tabIndex={-1} aria-hidden="true" autoComplete="off" className="hidden" {...form.register('_honeypot')} />
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

Throwaway assertion (create `/tmp/t2.ts`, run `pnpm exec tsx /tmp/t2.ts`, then delete):

```ts
const firstName = '  Jane '
const lastName = ' Doe  '
const name = `${firstName.trim()} ${lastName.trim()}`.trim()
if (name !== 'Jane Doe') {
  throw new Error(`got "${name}"`)
}
console.log('ok')
```

Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git commit -m "fix(funnels): trim PII name parts + aria-hide honeypot

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/lib/build-lead-input.ts src/shared/domains/funnels/ui/steps/pii-form-step.tsx
```

---

### Task 3: Accurate floor-plan diagram set

Replace the nonsensical Lucide icons (`Square` for L-shape, `LayoutGrid` for U-shape, etc.) with authored SVG diagrams that genuinely read as each kitchen layout.

**Files:**
- Create: `src/shared/domains/funnels/constants/floor-plan-diagrams.tsx`
- Modify: `src/shared/domains/funnels/constants/option-assets.tsx`

**Interfaces:**
- Produces: `OPTION_ICONS: Record<string, (props: { className?: string }) => JSX.Element>` — same keys (`l-shape`, `u-shape`, `galley`, `island`, `open`, `not-sure`), now mapping to accurate diagram components. `card-select-step.tsx` already renders `OPTION_ICONS[name]` as a component, so the consumer is unchanged.

**Diagram design:** each is a simple top-down floor-plan glyph drawn with `<rect>` counters on a room outline — `currentColor` strokes so theme color applies. L-shape = two perpendicular counter runs; U-shape = three runs on three walls; galley = two parallel runs; island = perimeter + a centered free-standing rect; open = a single counter + open space; not-sure = a `?` in a room outline.

- [ ] **Step 1: Author the diagram components**

```tsx
// src/shared/domains/funnels/constants/floor-plan-diagrams.tsx

interface DiagramProps { className?: string }

/** Top-down kitchen floor-plan glyphs. Room outline + counter runs (filled). */
function Frame({ className, children }: DiagramProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="2" className="opacity-30" />
      {children}
    </svg>
  )
}

export function LShapeDiagram(props: DiagramProps) {
  return (
    <Frame {...props}>
      <rect x="8" y="8" width="8" height="28" fill="currentColor" stroke="none" />
      <rect x="8" y="28" width="28" height="8" fill="currentColor" stroke="none" />
    </Frame>
  )
}

export function UShapeDiagram(props: DiagramProps) {
  return (
    <Frame {...props}>
      <rect x="8" y="8" width="8" height="32" fill="currentColor" stroke="none" />
      <rect x="32" y="8" width="8" height="32" fill="currentColor" stroke="none" />
      <rect x="8" y="32" width="32" height="8" fill="currentColor" stroke="none" />
    </Frame>
  )
}

export function GalleyDiagram(props: DiagramProps) {
  return (
    <Frame {...props}>
      <rect x="8" y="8" width="8" height="32" fill="currentColor" stroke="none" />
      <rect x="32" y="8" width="8" height="32" fill="currentColor" stroke="none" />
    </Frame>
  )
}

export function IslandDiagram(props: DiagramProps) {
  return (
    <Frame {...props}>
      <rect x="8" y="8" width="32" height="7" fill="currentColor" stroke="none" />
      <rect x="18" y="26" width="12" height="12" fill="currentColor" stroke="none" />
    </Frame>
  )
}

export function OpenDiagram(props: DiagramProps) {
  return (
    <Frame {...props}>
      <rect x="8" y="8" width="22" height="8" fill="currentColor" stroke="none" />
    </Frame>
  )
}

export function NotSureDiagram(props: DiagramProps) {
  return (
    <Frame {...props}>
      <text x="24" y="32" textAnchor="middle" fontSize="22" fill="currentColor" stroke="none">?</text>
    </Frame>
  )
}
```

- [ ] **Step 2: Rewire `option-assets.tsx` to the diagrams**

```tsx
// src/shared/domains/funnels/constants/option-assets.tsx
import {
  GalleyDiagram,
  IslandDiagram,
  LShapeDiagram,
  NotSureDiagram,
  OpenDiagram,
  UShapeDiagram,
} from '@/shared/domains/funnels/constants/floor-plan-diagrams'

/**
 * Named diagrams referenceable from a funnel option `asset: { kind:'icon', name }`.
 * Keep names stable — funnel configs reference them by string. Each value is a
 * component taking `{ className }`, matching how card-select-step renders them.
 */
export const OPTION_ICONS: Record<string, (props: { className?: string }) => JSX.Element> = {
  'galley': GalleyDiagram,
  'island': IslandDiagram,
  'l-shape': LShapeDiagram,
  'not-sure': NotSureDiagram,
  'open': OpenDiagram,
  'u-shape': UShapeDiagram,
}
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean. (Note: `card-select-step.tsx` renders `<Icon className="text-primary mb-2 size-6" />` — these components accept `className`, so no consumer change.)

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(funnels): accurate floor-plan diagrams replace placeholder icons

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/constants/floor-plan-diagrams.tsx src/shared/domains/funnels/constants/option-assets.tsx
```

---

### Task 4: Image-forward card-select layout

Upgrade the option card so the asset (diagram now, photo later) renders larger and image-forward — not the current tiny `48×48`/`size-6`.

**Files:**
- Modify: `src/shared/domains/funnels/ui/steps/card-select-step.tsx`

**Interfaces:**
- Consumes: `OPTION_ICONS` (T3), `OptionAsset` union (`{kind:'icon',name}` | `{kind:'image',src,alt}`).

- [ ] **Step 1: Render a larger asset area**

Replace the asset-rendering block (lines ~39-47) and card layout so the asset sits in a fixed-aspect area above the label. Full updated component body of the `.map`:

```tsx
{step.optionIds.map((optionId) => {
  const option = content.options[optionId]
  const selected = value === optionId
  const asset = option?.asset
  return (
    <button
      key={optionId}
      type="button"
      onClick={() => handleSelect(optionId)}
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border-2 text-left transition-colors hover:border-primary/60',
        selected ? 'border-primary bg-primary/5' : 'border-border',
      )}
    >
      {asset
        ? (
            <div className="bg-muted/40 flex aspect-[4/3] w-full items-center justify-center">
              {asset.kind === 'icon' && OPTION_ICONS[asset.name]
                ? (() => {
                    const Icon = OPTION_ICONS[asset.name]
                    return <Icon className="text-primary size-20" />
                  })()
                : null}
              {asset.kind === 'image'
                ? <Image src={asset.src} alt={asset.alt} width={320} height={240} className="h-full w-full object-cover" />
                : null}
            </div>
          )
        : null}
      <div className="p-4">
        <span className="block font-medium">{option?.label ?? optionId}</span>
        {option?.description
          ? <span className="text-muted-foreground mt-1 block text-sm">{option.description}</span>
          : null}
      </div>
    </button>
  )
})}
```

Keep the existing `handleSelect` (with the `if (!isAnswered) advance()` micro-commitment logic) and the header unchanged.

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 3: Playwright smoke**

Navigate to a funnel route (dev server must be running: `pnpm dev`). Confirm the kitchen layout cards show the larger diagrams above the labels and a card is selectable. Screenshot for the record.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(funnels): image-forward card-select layout

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/ui/steps/card-select-step.tsx
```

---

### Task 5: Asset manifest doc

A content deliverable: the per-campaign worklist that drives out-of-band AI image generation.

**Files:**
- Create: `docs/funnels/asset-manifest.md`

- [ ] **Step 1: Write the manifest**

Create `docs/funnels/asset-manifest.md` with: (1) tooling decision — FLUX.2 Pro for photoreal example/marketing imagery, Ideogram for text-baked badges, authored SVG for layout diagrams, Higgsfield reserved for future video; (2) storage convention — `public/funnels/<slug>/` now, R2 `tpr-funnel-assets` later (Appendix A); (3) a per-funnel table listing every asset needed (per-option example photos for kitchens layouts: l-shape/u-shape/galley/island/open; hero media per funnel), each with target dimensions (`4:3`, ≥ `800×600`) and a prompt note. Include kitchens fully; bathrooms/complete-interior as stubs to fill when those funnels are built out.

- [ ] **Step 2: Commit**

```bash
git commit -m "docs(funnels): AI asset-generation manifest + tooling decision

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- docs/funnels/asset-manifest.md
```

---

### Task 6: Snappier step transitions

**Files:**
- Modify: `src/shared/domains/funnels/constants/funnel-motion.ts`

- [ ] **Step 1: Tighten the transition**

```ts
export const FUNNEL_TRANSITION: Transition = {
  duration: 0.18,
  ease: [0.32, 0.72, 0, 1],
}
```

And reduce the travel in `STEP_VARIANTS` for a snappier feel:

```ts
export const STEP_VARIANTS: Record<'initial' | 'animate' | 'exit', TargetAndTransition> = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean (the `Transition`/`TargetAndTransition` types validate the keys).

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(funnels): snappier step transition timing

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/constants/funnel-motion.ts
```

---

### Task 7: Convincing multi-step ZIP check + aria-live

Replace the single spinner + 1200ms beat with a sequential checklist (~4 honest framing steps), each resolving to a green ✓, ending in "Your ZIP qualifies." The real `resolveZip` runs underneath.

**Files:**
- Create: `src/shared/domains/funnels/ui/steps/zip-check-progress.tsx`
- Modify: `src/shared/domains/funnels/ui/steps/location-step.tsx`

**Interfaces:**
- Produces: `ZipCheckProgress({ steps, stepMs }: { steps: string[], stepMs?: number })` — self-paced; ticks each line to a ✓ every `stepMs` (default 450).
- Consumes: existing `classifyZip` / `resolveZip`.

- [ ] **Step 1: Build the checklist component**

```tsx
// src/shared/domains/funnels/ui/steps/zip-check-progress.tsx
import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * Sequential "checking your area" checklist. Presentation pacing over the real
 * (instant) ZIP resolve — each line completes with a green check. Honest framing
 * of one check ("we're confirming your area"), not claims of distinct backend calls.
 */
export function ZipCheckProgress({ steps, stepMs = 450 }: { steps: string[], stepMs?: number }) {
  const [done, setDone] = useState(0)
  useEffect(() => {
    if (done >= steps.length) {
      return
    }
    const t = setTimeout(() => setDone(d => d + 1), stepMs)
    return () => clearTimeout(t)
  }, [done, steps.length, stepMs])

  return (
    <ul className="mx-auto flex max-w-xs flex-col gap-3 py-8" aria-live="polite">
      {steps.map((label, i) => {
        const complete = i < done
        const active = i === done
        return (
          <li key={label} className="flex items-center gap-3 text-left">
            <span
              className={
                complete
                  ? 'bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-full'
                  : 'border-muted-foreground/40 flex size-6 items-center justify-center rounded-full border-2'
              }
            >
              {complete
                ? <Check className="size-4" />
                : active ? <span className="border-primary size-3 animate-spin rounded-full border-2 border-t-transparent" /> : null}
            </span>
            <span className={complete ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 2: Wire it into the location step**

In `location-step.tsx`: (a) add a module-level constant for the steps; (b) bump `MIN_CHECKING_MS` to cover the ticks; (c) replace the `checking` phase render; (d) add `aria-live` to the qualified/out-of-area content.

```tsx
// top of file
import { ZipCheckProgress } from '@/shared/domains/funnels/ui/steps/zip-check-progress'

// module-level constants (NOT inside the component)
const CHECK_STEPS = ['Locating your ZIP…', 'Checking service radius…', 'Confirming crew availability…', 'Reserving your area…']
const STEP_MS = 450
const MIN_CHECKING_MS = CHECK_STEPS.length * STEP_MS // 1800
```

Replace the `if (phase === 'checking')` block:

```tsx
if (phase === 'checking') {
  return <ZipCheckProgress steps={CHECK_STEPS} stepMs={STEP_MS} />
}
```

Update the `qualified` block to announce:

```tsx
if (phase === 'qualified') {
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center" aria-live="polite">
      <p className="text-primary text-xl font-semibold">
        {content.qualifiesLabel ?? '✓ Great news — your area qualifies.'}
      </p>
    </div>
  )
}
```

And add `aria-live="polite"` to the out-of-area `<p>` (line ~80) by wrapping or annotating the message paragraph so screen readers announce the rejection.

The `handleSubmit` keeps `Promise.all([resolveZip(zip), delay(MIN_CHECKING_MS)])` — now `MIN_CHECKING_MS` (1800) matches the checklist duration so the ticks finish before flipping to qualified.

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 4: Playwright smoke**

On a funnel, reach the ZIP step, enter a SoCal ZIP (e.g. `92614`), submit. Confirm the four lines tick to green checks in sequence, then "your area qualifies" appears. Enter a non-SoCal ZIP (e.g. `10001`) → out-of-area message.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(funnels): multi-step ZIP check checklist + aria-live

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/ui/steps/zip-check-progress.tsx src/shared/domains/funnels/ui/steps/location-step.tsx
```

---

### Task 8: Investigate & fix slow initial load

Diagnostic-first. The funnel is "slow to load initially." Measure, identify, apply the targeted fix, re-measure.

**Files:**
- Likely modify: `src/shared/domains/funnels/ui/funnel-engine.tsx` (and/or the funnel route) to defer below-fold work via `next/dynamic`.

- [ ] **Step 1: Measure the baseline**

With `pnpm dev` running, open a funnel route in Playwright. Capture: `browser_network_requests` (JS payload sizes), the console, and time-to-interactive feel. Record which chunks dominate. Note whether the eager imports of `motion`, full step registry, and (after later tasks) marketing blocks are in the initial chunk.

- [ ] **Step 2: Identify the dominant cost**

Document the finding in the commit body. Most likely culprits, in order: (a) marketing blocks + portfolio fetch bundled into the initial funnel chunk (only relevant after T10–T16, but design for it now), (b) `motion/react` in the critical path, (c) eager step components.

- [ ] **Step 3: Apply the targeted fix**

The standard fix that fits this architecture: `next/dynamic` the below-fold marketing block components so they (and the portfolio tRPC fetch) are not in the initial bundle. In `funnel-landing.tsx` (T16) the registry already isolates blocks; ensure the `MARKETING_REGISTRY` entries are dynamically imported, e.g.:

```tsx
import dynamic from 'next/dynamic'
// in marketing-registry.ts (T15), wrap each component:
const PortfolioBlock = dynamic(() => import('@/shared/domains/funnels/ui/blocks/portfolio-block').then(m => m.PortfolioBlock))
```

If the measurement shows the FIRST paint (hero + Q1) is the slow part (not below-fold), instead fix that specific cause (e.g. ensure the hero image uses `priority` + correct sizing, and the funnel route is not blocked on a server fetch). Apply only the fix the measurement justifies — do not speculatively split everything.

- [ ] **Step 4: Re-measure & verify**

Re-run the Playwright network capture; confirm the initial JS chunk shrank (or first paint improved). Run `pnpm tsc && pnpm lint`.

- [ ] **Step 5: Commit**

```bash
git commit -m "perf(funnels): defer below-fold work off the initial funnel bundle

<one-line measurement before/after>

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- <changed files>
```

> Note for the controller: this task's exact diff depends on the measurement. If the finding is "first paint is already fast, below-fold is the only cost," the dynamic-import work may merge into T15/T16 and this task becomes the measurement record. That is acceptable — the deliverable is a measured improvement, documented.

---

### Task 9: Marketing-block types + `FunnelSpec.landing`

**Files:**
- Modify: `src/shared/domains/funnels/types.ts`

**Interfaces:**
- Produces: `MarketingBlock` union, `MarketingBlockKind`, `MarketingBlockComponentFor<K>`, `MarketingRegistry`, the five `*BlockContent` interfaces, and `FunnelSpec.landing?: { blocks: MarketingBlock[] }`.

- [ ] **Step 1: Add block content interfaces + union + registry types**

Append to `types.ts` (after the existing step types, before or near `FunnelSpec`):

```ts
// ── Marketing blocks: composable trust sections shown on the landing ──

export interface ReviewsBlockContent { rating: number, count: number, label?: string }
export interface TestimonialItem { name: string, location: string, text: string, rating: number, image?: string }
export interface TestimonialsBlockContent { title?: string, items?: TestimonialItem[] }
export interface PortfolioBlockContent { title?: string, subtitle?: string, maxItems?: number }
export interface LicensingBlockContent { title?: string }
export interface GuaranteeBlockContent { headline: string, body: string, scarcityLine?: string }

export type MarketingBlock =
  | { kind: 'reviews', content: ReviewsBlockContent }
  | { kind: 'testimonials', content: TestimonialsBlockContent }
  | { kind: 'portfolio', content: PortfolioBlockContent }
  | { kind: 'licensing', content: LicensingBlockContent }
  | { kind: 'guarantee', content: GuaranteeBlockContent }

export type MarketingBlockKind = MarketingBlock['kind']
export type MarketingBlockComponentFor<K extends MarketingBlockKind> =
  ComponentType<{ content: Extract<MarketingBlock, { kind: K }>['content'], ctx: FunnelContext }>
export type MarketingRegistry = { [K in MarketingBlockKind]: MarketingBlockComponentFor<K> }
```

- [ ] **Step 2: Add `landing` to `FunnelSpec`**

```ts
export interface FunnelSpec {
  slug: FunnelSlug
  offer: string
  title: string
  hero: HeroContent
  theme: FunnelTheme
  pixel: FunnelPixel
  /** Optional landing block list; falls back to DEFAULT_LANDING_BLOCKS when absent. */
  landing?: { blocks: MarketingBlock[] }
  steps: FunnelStep[]
  flow?: (answers: FunnelAnswers, currentStepId: StepId) => StepId | null
}
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc`
Expected: clean (no funnel needs changes since `landing` is optional). `ComponentType` is already imported at the top of `types.ts`.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(funnels): MarketingBlock union, registry types, FunnelSpec.landing

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/types.ts
```

---

### Task 10: Reviews block (aggregate star band)

**Files:**
- Create: `src/shared/domains/funnels/ui/blocks/reviews-block.tsx`

**Interfaces:**
- Consumes: `ReviewsBlockContent` (T9), `FunnelContext`.
- Produces: `ReviewsBlock({ content, ctx }: { content: ReviewsBlockContent, ctx: FunnelContext })`.

- [ ] **Step 1: Build the block**

```tsx
// src/shared/domains/funnels/ui/blocks/reviews-block.tsx
import type { FunnelContext, ReviewsBlockContent } from '@/shared/domains/funnels/types'
import { Star } from 'lucide-react'

export function ReviewsBlock({ content }: { content: ReviewsBlockContent, ctx: FunnelContext }) {
  const full = Math.round(content.rating)
  return (
    <section className="flex flex-col items-center gap-2 py-10 text-center">
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={i < full ? 'fill-primary text-primary size-5' : 'text-muted-foreground/40 size-5'} />
        ))}
      </div>
      <p className="text-lg font-semibold">
        {content.rating.toFixed(1)}
        ★
        {' '}
        {content.label ?? `from ${content.count}+ homeowners`}
      </p>
    </section>
  )
}
```

- [ ] **Step 2: Verify** — `pnpm tsc && pnpm lint` clean.
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(funnels): reviews aggregate trust block

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/ui/blocks/reviews-block.tsx
```

---

### Task 11: Testimonials block (quote cards)

**Files:**
- Create: `src/shared/domains/funnels/ui/blocks/testimonials-block.tsx`

**Interfaces:**
- Consumes: `TestimonialsBlockContent` / `TestimonialItem` (T9), `testimonials` from `@/shared/constants/company/testimonials` (fields: `name`, `project`, `rating`, `text`, `image`, `location`).
- Produces: `TestimonialsBlock({ content, ctx })`.

- [ ] **Step 1: Build the block**

Default to the static company testimonials when `content.items` is absent (map the company shape to `TestimonialItem`). ONE component per file.

```tsx
// src/shared/domains/funnels/ui/blocks/testimonials-block.tsx
import type { FunnelContext, TestimonialItem, TestimonialsBlockContent } from '@/shared/domains/funnels/types'
import { Star } from 'lucide-react'
import { testimonials } from '@/shared/constants/company/testimonials'

const DEFAULT_ITEMS: TestimonialItem[] = testimonials.map(t => ({
  name: t.name,
  location: t.location,
  text: t.text,
  rating: t.rating,
  image: t.image,
}))

export function TestimonialsBlock({ content }: { content: TestimonialsBlockContent, ctx: FunnelContext }) {
  const items = content.items ?? DEFAULT_ITEMS
  return (
    <section className="flex flex-col gap-6 py-10">
      {content.title ? <h2 className="text-center text-2xl font-semibold">{content.title}</h2> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(item => (
          <figure key={item.name} className="border-border flex flex-col gap-3 rounded-xl border p-5">
            <div className="flex items-center gap-1">
              {Array.from({ length: item.rating }, (_, i) => (
                <Star key={i} className="fill-primary text-primary size-4" />
              ))}
            </div>
            <blockquote className="text-sm">{item.text}</blockquote>
            <figcaption className="text-muted-foreground text-xs">
              {item.name}
              {' · '}
              {item.location}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify** — `pnpm tsc && pnpm lint` clean. (If `testimonials` is `as const` and `rating`/etc. are read-only literals, the `.map` to `TestimonialItem` still satisfies the interface; confirm `image` is `string`.)
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(funnels): testimonials quote-card block

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/ui/blocks/testimonials-block.tsx
```

---

### Task 12: Licensing block

**Files:**
- Create: `src/shared/domains/funnels/ui/blocks/licensing-block.tsx`

**Interfaces:**
- Consumes: `LicensingBlockContent` (T9), `licenses` from `@/shared/constants/company/licenses` (fields: `type`, `description`, `licenseNumber`), `companyInfo` from `@/shared/constants/company/company-info`.
- Produces: `LicensingBlock({ content, ctx })`.

- [ ] **Step 1: Build the block**

```tsx
// src/shared/domains/funnels/ui/blocks/licensing-block.tsx
import type { FunnelContext, LicensingBlockContent } from '@/shared/domains/funnels/types'
import { BadgeCheck, ShieldCheck } from 'lucide-react'
import { licenses } from '@/shared/constants/company/licenses'

export function LicensingBlock({ content }: { content: LicensingBlockContent, ctx: FunnelContext }) {
  const primary = licenses[0]
  return (
    <section className="bg-muted/30 flex flex-col items-center gap-3 rounded-2xl px-6 py-10 text-center">
      <h2 className="text-lg font-semibold">{content.title ?? 'Licensed, Bonded & Insured'}</h2>
      <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
        <span className="flex items-center gap-1.5"><BadgeCheck className="text-primary size-4" /> {primary.type}</span>
        <span className="flex items-center gap-1.5"><ShieldCheck className="text-primary size-4" /> Fully insured</span>
        <span>
          CSLB #
          {primary.licenseNumber}
        </span>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify** — `pnpm tsc && pnpm lint` clean.
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(funnels): licensing/insurance trust block

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/ui/blocks/licensing-block.tsx
```

---

### Task 13: Guarantee/scarcity block

**Files:**
- Create: `src/shared/domains/funnels/ui/blocks/guarantee-block.tsx`

**Interfaces:**
- Consumes: `GuaranteeBlockContent` (T9).
- Produces: `GuaranteeBlock({ content, ctx })`.

- [ ] **Step 1: Build the block**

```tsx
// src/shared/domains/funnels/ui/blocks/guarantee-block.tsx
import type { FunnelContext, GuaranteeBlockContent } from '@/shared/domains/funnels/types'
import { ShieldCheck } from 'lucide-react'

export function GuaranteeBlock({ content }: { content: GuaranteeBlockContent, ctx: FunnelContext }) {
  return (
    <section className="border-primary/30 bg-primary/5 flex flex-col items-center gap-3 rounded-2xl border px-6 py-10 text-center">
      <ShieldCheck className="text-primary size-8" />
      <h2 className="text-xl font-semibold">{content.headline}</h2>
      <p className="text-muted-foreground max-w-md text-sm">{content.body}</p>
      {content.scarcityLine ? <p className="text-primary text-sm font-medium">{content.scarcityLine}</p> : null}
    </section>
  )
}
```

- [ ] **Step 2: Verify** — `pnpm tsc && pnpm lint` clean.
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(funnels): guarantee/scarcity block

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/ui/blocks/guarantee-block.tsx
```

---

### Task 14: Trade map + live portfolio block

**Files:**
- Create: `src/shared/domains/funnels/constants/trade-by-slug.ts`
- Create: `src/shared/domains/funnels/ui/blocks/portfolio-block.tsx`

**Interfaces:**
- Consumes: `PortfolioBlockContent` / `FunnelContext` (T9); `useTRPC()` from `@/trpc/helpers`; `scopesRouter.getAll` (returns `ScopeOrAddon[]`, each `{ id, relatedTrade, ... }`); `projectsRouter.showroomDisplay.getAll` (returns `PortfolioProject[]` = `{ project, heroImage, scopeIds }[]`); `getOptimizedSrc` from `@/shared/lib/get-optimized-urls`.
- Produces: `TRADE_BY_SLUG: Record<FunnelSlug, string>`; `PortfolioBlock({ content, ctx })`.

- [ ] **Step 1: Create the trade map**

```ts
// src/shared/domains/funnels/constants/trade-by-slug.ts
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
```

- [ ] **Step 2: Build the portfolio block**

Fetches scopes + projects, builds `scopeId → tradeId`, filters projects to the funnel's trade, renders a hero-image grid. Loading skeleton, empty → render nothing, drift → `console.warn`.

```tsx
// src/shared/domains/funnels/ui/blocks/portfolio-block.tsx
'use client'

import type { FunnelContext, PortfolioBlockContent } from '@/shared/domains/funnels/types'
import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { useMemo } from 'react'
import { TRADE_BY_SLUG } from '@/shared/domains/funnels/constants/trade-by-slug'
import { getOptimizedSrc } from '@/shared/lib/get-optimized-urls'
import { useTRPC } from '@/trpc/helpers'

export function PortfolioBlock({ content, ctx }: { content: PortfolioBlockContent, ctx: FunnelContext }) {
  const trpc = useTRPC()
  const scopesQ = useQuery(trpc.notionRouter.scopes.getAll.queryOptions())
  const projectsQ = useQuery(trpc.projectsRouter.showroomDisplay.getAll.queryOptions())

  const tradeId = TRADE_BY_SLUG[ctx.slug]

  const matched = useMemo(() => {
    const scopes = scopesQ.data
    const projects = projectsQ.data
    if (!scopes || !projects) {
      return null
    }
    const scopeToTrade = new Map(scopes.map(s => [s.id, s.relatedTrade]))
    const hits = projects.filter(p =>
      p.heroImage && p.scopeIds.some(id => scopeToTrade.get(id) === tradeId),
    )
    if (hits.length === 0) {
      console.warn(`[funnels] portfolio block: no projects matched trade ${tradeId} for funnel ${ctx.slug}`)
    }
    return hits.slice(0, content.maxItems ?? 6)
  }, [scopesQ.data, projectsQ.data, tradeId, ctx.slug, content.maxItems])

  if (matched === null) {
    return <div className="bg-muted/40 h-64 w-full animate-pulse rounded-2xl" />
  }
  if (matched.length === 0) {
    return null
  }

  return (
    <section className="flex flex-col gap-6 py-10">
      {content.title ? <h2 className="text-center text-2xl font-semibold">{content.title}</h2> : null}
      {content.subtitle ? <p className="text-muted-foreground text-center">{content.subtitle}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {matched.map(p => (
          <div key={p.project.id} className="overflow-hidden rounded-xl">
            <Image
              src={getOptimizedSrc(p.heroImage!)}
              alt={p.project.title}
              width={400}
              height={300}
              className="aspect-[4/3] h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
    </section>
  )
}
```

> Implementer note: confirm the exact tRPC accessor paths at call time — `trpc.notionRouter.scopes.getAll` and `trpc.projectsRouter.showroomDisplay.getAll` follow the router registration in `src/trpc/routers/app.ts` and the sub-router nesting (`notion.router/scopes.router.ts`, `projects.router/showroom-display.router.ts`). Adjust the accessor to match the registered names if they differ.

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

Throwaway logic assertion (`/tmp/t14.ts`, run with `pnpm exec tsx`, then delete) for the scope→trade filter:

```ts
const tradeId = 'T-kitchen'
const scopes = [{ id: 's1', relatedTrade: 'T-kitchen' }, { id: 's2', relatedTrade: 'T-bath' }]
const projects = [
  { id: 'p1', scopeIds: ['s1'] },
  { id: 'p2', scopeIds: ['s2'] },
  { id: 'p3', scopeIds: ['s2', 's1'] },
]
const scopeToTrade = new Map(scopes.map(s => [s.id, s.relatedTrade]))
const hits = projects.filter(p => p.scopeIds.some(id => scopeToTrade.get(id) === tradeId)).map(p => p.id)
if (JSON.stringify(hits) !== JSON.stringify(['p1', 'p3'])) {
  throw new Error(`got ${JSON.stringify(hits)}`)
}
console.log('ok')
```

Expected: `ok`.

- [ ] **Step 4: Playwright smoke**

Confirm the portfolio block renders trade-matched project images on the kitchens funnel landing (once T16 wires it). If the dev DB has no public kitchen projects, confirm it renders nothing (no empty shell) and logs the warn.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(funnels): live trade-filtered portfolio block

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/constants/trade-by-slug.ts src/shared/domains/funnels/ui/blocks/portfolio-block.tsx
```

---

### Task 15: Marketing registry + default landing blocks

**Files:**
- Create: `src/shared/domains/funnels/constants/marketing-registry.ts`
- Create: `src/shared/domains/funnels/constants/default-landing-blocks.ts`

**Interfaces:**
- Consumes: the five block components (T10–T14), `MarketingRegistry` + `MarketingBlock` (T9).
- Produces: `MARKETING_REGISTRY: MarketingRegistry`; `DEFAULT_LANDING_BLOCKS: MarketingBlock[]`.

- [ ] **Step 1: Build the registry**

Use `next/dynamic` for the heavier/below-fold blocks per T8's finding (at minimum `portfolio`, which fetches). Lighter static blocks can import directly.

```tsx
// src/shared/domains/funnels/constants/marketing-registry.ts
import type { MarketingRegistry } from '@/shared/domains/funnels/types'
import dynamic from 'next/dynamic'
import { GuaranteeBlock } from '@/shared/domains/funnels/ui/blocks/guarantee-block'
import { LicensingBlock } from '@/shared/domains/funnels/ui/blocks/licensing-block'
import { ReviewsBlock } from '@/shared/domains/funnels/ui/blocks/reviews-block'
import { TestimonialsBlock } from '@/shared/domains/funnels/ui/blocks/testimonials-block'

const PortfolioBlock = dynamic(
  () => import('@/shared/domains/funnels/ui/blocks/portfolio-block').then(m => m.PortfolioBlock),
)

/** kind → block component. Typed by MarketingRegistry so each slot matches its kind. */
export const MARKETING_REGISTRY: MarketingRegistry = {
  'guarantee': GuaranteeBlock,
  'licensing': LicensingBlock,
  'portfolio': PortfolioBlock,
  'reviews': ReviewsBlock,
  'testimonials': TestimonialsBlock,
}
```

- [ ] **Step 2: Build the default block list**

```ts
// src/shared/domains/funnels/constants/default-landing-blocks.ts
import type { MarketingBlock } from '@/shared/domains/funnels/types'

/**
 * Default ordered landing blocks, used when a FunnelSpec omits `landing`.
 * A funnel may override by setting its own `landing.blocks` (defaults-with-override).
 */
export const DEFAULT_LANDING_BLOCKS: MarketingBlock[] = [
  { kind: 'reviews', content: { rating: 4.9, count: 200 } },
  { kind: 'portfolio', content: { title: 'Recent projects in your area' } },
  { kind: 'testimonials', content: { title: 'What homeowners say' } },
  { kind: 'guarantee', content: { headline: 'Showcase-grade work, guaranteed', body: 'Every Showcase project is backed by our workmanship guarantee.', scarcityLine: 'Limited Showcase spots remain this month.' } },
  { kind: 'licensing', content: {} },
]
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean. The `MarketingRegistry` mapped type forces every kind to be present; `DEFAULT_LANDING_BLOCKS` entries are checked against the `MarketingBlock` union (wrong content shape fails compile).

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(funnels): marketing registry + default landing blocks

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/constants/marketing-registry.ts src/shared/domains/funnels/constants/default-landing-blocks.ts
```

---

### Task 16: `FunnelLanding` layout + engine wiring

The capstone: full-width landing (hero + Q1 inline + blocks + bottom CTA) shown while `isFirst`; focused column otherwise.

**Files:**
- Create: `src/shared/domains/funnels/ui/funnel-landing.tsx`
- Modify: `src/shared/domains/funnels/ui/funnel-engine.tsx`

**Interfaces:**
- Consumes: `MARKETING_REGISTRY` + `DEFAULT_LANDING_BLOCKS` (T15), `FunnelHero`, `FunnelSpec`, `FunnelContext`, `MarketingBlock` (T9).
- Produces: `FunnelLanding({ spec, ctx, children }: { spec: FunnelSpec, ctx: FunnelContext, children: ReactNode })` — renders hero, the Q1 step (`children`) under a scroll anchor, the resolved blocks, and a bottom CTA that scrolls to the anchor.

- [ ] **Step 1: Build `FunnelLanding`**

```tsx
// src/shared/domains/funnels/ui/funnel-landing.tsx
'use client'

import type { ReactNode } from 'react'
import type { FunnelContext, FunnelSpec, MarketingBlock } from '@/shared/domains/funnels/types'
import { Button } from '@/shared/components/ui/button'
import { DEFAULT_LANDING_BLOCKS } from '@/shared/domains/funnels/constants/default-landing-blocks'
import { MARKETING_REGISTRY } from '@/shared/domains/funnels/constants/marketing-registry'
import { FunnelHero } from '@/shared/domains/funnels/ui/funnel-hero'

const QUESTION_ANCHOR = 'funnel-q1'

function scrollToQuestion() {
  document.getElementById(QUESTION_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function renderBlock(block: MarketingBlock, ctx: FunnelContext, index: number) {
  // Re-narrow per kind: the registry is typed per kind; indexing by the union
  // widens the lookup, so cast through `never` content like the step seam does.
  const Block = MARKETING_REGISTRY[block.kind] as (props: { content: typeof block.content, ctx: FunnelContext }) => ReactNode
  return <Block key={`${block.kind}-${index}`} content={block.content} ctx={ctx} />
}

export function FunnelLanding({ spec, ctx, children }: { spec: FunnelSpec, ctx: FunnelContext, children: ReactNode }) {
  const blocks = spec.landing?.blocks ?? DEFAULT_LANDING_BLOCKS
  return (
    <div className="flex w-full flex-col items-center gap-16 py-10">
      <div className="flex w-full max-w-xl flex-col gap-8 px-5">
        <FunnelHero content={spec.hero} />
        <div id={QUESTION_ANCHOR} className="scroll-mt-6">{children}</div>
      </div>
      <div className="flex w-full max-w-5xl flex-col gap-12 px-5">
        {blocks.map((block, i) => renderBlock(block, ctx, i))}
      </div>
      <Button size="lg" onClick={scrollToQuestion}>Ready? See if you qualify ↑</Button>
    </div>
  )
}
```

- [ ] **Step 2: Wire the engine**

In `funnel-engine.tsx`: build the step element once, then render `FunnelLanding` (with the step as children) while `isFirst`, else the existing focused column. The Back/Next shell row stays only in focused mode. Updated render:

```tsx
import { FunnelLanding } from '@/shared/domains/funnels/ui/funnel-landing'
// (keep existing imports; remove the FunnelHero import if now only used by FunnelLanding)

// ...inside the component, after StepView is resolved:
const stepEl = (
  <StepView
    step={engine.step}
    content={engine.step.content}
    value={engine.value}
    isAnswered={engine.value != null}
    setValue={engine.setAnswer}
    answers={engine.answers}
    ctx={ctx}
    advance={engine.advance}
    back={engine.back}
    isFirst={engine.isFirst}
  />
)

if (engine.isFirst) {
  return (
    <div data-funnel={spec.slug} className="min-h-dvh w-full">
      <FunnelLanding spec={spec} ctx={ctx}>{stepEl}</FunnelLanding>
    </div>
  )
}

return (
  <div data-funnel={spec.slug} className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-8 px-5 py-10">
    <FunnelProgress total={spec.steps.length} currentIndex={currentIndex} />
    <AnimatePresence mode="wait">
      <motion.div
        key={engine.step.id}
        initial={reduceMotion ? false : STEP_VARIANTS.initial}
        animate={STEP_VARIANTS.animate}
        exit={reduceMotion ? undefined : STEP_VARIANTS.exit}
        transition={FUNNEL_TRANSITION}
        className="flex-1"
      >
        {stepEl}
      </motion.div>
    </AnimatePresence>
    <div className="flex items-center justify-between gap-3">
      <Button variant="ghost" onClick={engine.back}>← Back</Button>
      {engine.value != null && engine.hasNext
        ? <Button onClick={engine.advance}>Next →</Button>
        : <span />}
    </div>
  </div>
)
```

(The landing renders Q1 without the motion wrapper/AnimatePresence — first paint should be immediate. When the user answers Q1, `advance()` flips `isFirst` false and the focused column with the progress bar takes over. Optionally scroll to top on that transition via the existing `scrollToQuestion` pattern — not required for v1.)

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 4: Playwright smoke (the whole flow)**

With `pnpm dev`: load `/` of a funnel (or the funnel route). Confirm: (1) hero + Q1 cards render at top; (2) scrolling reveals reviews → portfolio → testimonials → guarantee → licensing; (3) the bottom CTA scrolls back to Q1; (4) selecting a Q1 option transitions into the focused funnel with the progress bar and Back/Next; (5) Back from step 2 returns to the landing. Screenshot each state.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(funnels): long-scroll landing with marketing blocks + engine wiring

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/ui/funnel-landing.tsx src/shared/domains/funnels/ui/funnel-engine.tsx
```

---

## Final verification (after all tasks)

- `pnpm tsc && pnpm lint` clean on the whole branch.
- Playwright end-to-end: landing → Q1 → ZIP checklist → PII (existing flow still works, real lead created in dev DB with `verified`/`unverified` phone as before).
- Confirm no `shared/` → `features/` import was introduced: `grep -rn "@/features/" src/shared/domains/funnels/` returns nothing.
- Confirm no `x-forwarded-for` reads remain in `src/trpc/`.

---

## Appendix A — R2 asset migration (DEFERRED — do NOT execute this run)

Requires the `tpr-funnel-assets` R2 bucket to be provisioned out-of-band and its public domain known. Not part of the execution run (spec §3: sequenced follow-up that must not block the visual fix).

When the bucket exists:
1. Add to `src/shared/services/providers/r2/types.ts`: `funnelAssets: 'tpr-funnel-assets'` in `R2_BUCKETS`, and `'tpr-funnel-assets': 'https://pub-<DOMAIN>.r2.dev'` in `R2_PUBLIC_DOMAINS`.
2. Upload `public/funnels/<slug>/*` to the bucket (presigned `r2Client.putObject` or a one-off script using the existing client).
3. Swap funnel option `asset.src` values from `/funnels/...` to the R2 public URL (or, if registered as `MediaFile`-shaped records, route through `getOptimizedSrc`).
4. Remove the migrated files from `public/funnels/`.
5. `pnpm tsc && pnpm lint`; Playwright-confirm images still render.

---

## Out of scope (→ Plan 2c, separate spec)

Lead enrichment, appointment booking, confirmation screen, the `enrichFunnelLead` mutation + its security review. Also flagged but NOT fixed here: the stale `TRADE_NAME` map in `build-lead-input.ts` (diverges from live Notion trade names) — recommend a standalone fix or folding into 2c.
