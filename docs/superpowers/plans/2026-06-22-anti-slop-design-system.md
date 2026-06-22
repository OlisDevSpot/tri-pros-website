# Anti-Slop Design Token System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an app-wide, multi-theme design-token system + anti-slop methodology (tokens, `<Decor>`, credential trust layer, DESIGN.md, checklist), proven on the redesigned funnel callout + FAQ accordion in a `/test` route.

**Architecture:** Tokens are CSS custom properties layered primitive → semantic → component, applied per-surface via a theme class (generalizing the existing `.funnel-light` pattern) — `.theme-marketing` for the warm-concrete "Blueprint Authority" showcase. A shared parametric `<Decor>` component renders the brand-blue top-right atmosphere; a shared `<CredentialStrip>` sources real trust data from `src/shared/constants/company/`. Marketing blocks consume these.

**Tech Stack:** Next.js 15 (App Router), Tailwind v4 (`@theme inline`), motion/react, TypeScript, shadcn token vars. Fonts already wired: `font-sans` = Syne (display), body default = Nunito (text), Space Mono = `font-mono` (BANNED in marketing).

## Global Constraints

- Work on **`main`** only — do NOT create a branch (user directive). Stage **only** the files for the task — never `git add -A` / `git add .` (other sessions have uncommitted WIP in this tree).
- **No monospace** anywhere in marketing components — never use `font-mono` / Space Mono.
- **Accent = brand blue `#03AFED` only** (small text on light: `#0784b3`). No purple/indigo, no ubiquitous gradients/glows.
- **One React component per file. Named exports only** — EXCEPT Next.js `page.tsx`/`layout.tsx` which require `export default`.
- **No file-level constants or helpers in component files** — constants → `constants/`, helpers → `lib/`. No barrel files.
- `shared/` never imports from `features/`. Path alias `@/` → `src/`.
- **Verification per task:** `pnpm tsc` (NOT `pnpm build`) + `pnpm lint`, plus visual confirmation on the `/test` route. There is no unit-test runner in this repo; do not invent one.
- Trust data comes from `src/shared/constants/company/` — never hardcode license/stats.
- Copy guardrail: "40+ years **combined** experience," never "40 years in business" (founded 2021).
- Motion uses `motion/react` gated by `useReducedMotion()`.
- Source of truth: `docs/superpowers/specs/2026-06-22-anti-slop-design-system-design.md`.

---

## File Structure

- `src/app/(frontend)/globals.css` — **modify**: add `.theme-marketing` (light + dark stub) semantic remap + new system/component tokens + decor keyframes/classes.
- `src/shared/components/decor/lib/build-decor-geometry.ts` — **create**: pure geometry builder (arc/square/triangle ring descriptors).
- `src/shared/components/decor/constants/decor-config.ts` — **create**: ring count, ramps, motion timings.
- `src/shared/components/decor/decor.tsx` — **create**: `<Decor>` client component (motion/react + reduced-motion).
- `src/shared/components/trust/lib/build-credentials.ts` — **create**: assemble credential items from company constants.
- `src/shared/components/trust/credential-strip.tsx` — **create**: `<CredentialStrip>`.
- `src/shared/domains/funnels/types.ts` — **modify**: add optional `ctaLabel?` to `CalloutBlockContent`.
- `src/shared/domains/funnels/ui/blocks/callout-block.tsx` — **rewrite**: Blueprint Authority callout.
- `src/shared/domains/funnels/ui/blocks/faq-block.tsx` — **modify**: token + decor restyle (2nd proof).
- `src/app/(frontend)/test/layout.tsx` — **create**: minimal isolated layout applying `.theme-marketing`.
- `src/app/(frontend)/test/page.tsx` — **create**: renders redesigned callout + accordion.
- `docs/design-system/DESIGN.md`, `tokens.md`, `anti-slop-checklist.md` — **create**.
- `docs/codebase-conventions/README.md`, `CLAUDE.md` — **modify**: add pointers.

---

## Task 1: Marketing theme + system tokens (globals.css)

**Files:**
- Modify: `src/app/(frontend)/globals.css` (append after the existing `.funnel-light` block, ~line 99; keep `.funnel-light` intact)

**Interfaces:**
- Produces: a `.theme-marketing` class exposing shadcn semantic vars (`--background`,`--card`,`--foreground`,`--primary`,`--muted-foreground`,`--border`,`--ring`,`--radius`) remapped to warm-concrete + brand blue, plus NEW vars consumed by later tasks: `--accent-ink`, `--body-text`, `--cred-ink`, `--cred-gap`, `--shadow-card`, `--ease-brand`, `--dur-fast/base/draw`, `--decor-stroke`, `--decor-gradient-alpha`; and CSS classes `.decor-sweep`, `.decor-breathe` with reduced-motion guards.

- [ ] **Step 1: Add the theme block.** Insert into `src/app/(frontend)/globals.css` immediately after the closing `}` of the existing `.funnel-light` override block (the one ending at ~line 99):

```css
/* ─────────────────────────────────────────────────────────────────────────
   MARKETING THEME — "Blueprint Authority" (warm concrete + brand blue).
   Applied via class on a wrapper (same mechanism as .funnel-light). Remaps the
   shadcn semantic vars so existing components inherit the look, and adds new
   system tokens consumed by <Decor>, <CredentialStrip>, and marketing blocks.
   See docs/superpowers/specs/2026-06-22-anti-slop-design-system-design.md
   ───────────────────────────────────────────────────────────────────────── */
.theme-marketing {
  color-scheme: light;

  /* semantic (shadcn) — warm-concrete neutrals + brand-blue accent */
  --background: #e9e2d6;        /* sand */
  --foreground: #2a2520;        /* warm ink */
  --card: #f4efe6;              /* panel */
  --card-foreground: #2a2520;
  --popover: #f4efe6;
  --popover-foreground: #2a2520;
  --primary: #03afed;           /* brand blue (the only accent) */
  --primary-foreground: #ffffff;
  --secondary: #efe7d7;         /* raised */
  --secondary-foreground: #2a2520;
  --muted: #efe7d7;
  --muted-foreground: #8a7c6a;  /* warm muted */
  --accent: #03afed;
  --accent-foreground: #ffffff;
  --border: #ddd4c4;            /* hairline */
  --input: #ddd4c4;
  --ring: #03afed;
  --radius: 0.375rem;           /* 6px panel — not the slop 8px-everywhere */

  /* NEW system tokens */
  --accent-ink: #0784b3;        /* brand blue darkened for small text on light */
  --body-text: #5f574b;         /* warm body copy */
  --cred-ink: #4a443c;          /* credential text */
  --cred-gap: 24px;
  --radius-chip: 3px;
  --shadow-card: 0 44px 64px -42px rgb(60 40 15 / 0.5);

  /* motion */
  --ease-brand: cubic-bezier(.32,.72,0,1);
  --dur-fast: .18s;
  --dur-base: .4s;
  --dur-draw: 1.4s;

  /* decor atmosphere */
  --decor-stroke: #03afed;
  --decor-gradient-alpha: .34;

  color: var(--foreground);
}

/* Dark stub — EXPLICIT opt-in only via `.theme-dark`. It must NOT auto-activate
   from the app-wide `<html class="dark">` ancestor, or the LIGHT showcase would
   render dark. The marketing theme is light by default (like .funnel-light).
   Full dark hardening deferred (spec §12). */
.theme-marketing.theme-dark {
  --background: #14110e;
  --foreground: #ece6d8;
  --card: #1c1813;
  --card-foreground: #ece6d8;
  --popover: #1c1813;
  --popover-foreground: #ece6d8;
  --secondary: #221d17;
  --muted: #221d17;
  --muted-foreground: #9a9082;
  --border: #2c2620;
  --input: #2c2620;
  --accent-ink: #5cc6f2;
  --body-text: #c4bbac;
  --cred-ink: #d8cfbf;
  color: var(--foreground);
}

/* Decor continuous motion — gated for reduced motion */
@keyframes decor-sweep { from { transform: rotate(-3deg); } to { transform: rotate(3deg); } }
@keyframes decor-breathe { 0%,100% { opacity:.9; } 50% { opacity:1.12; } }
.decor-sweep { transform-origin: 100% 0; animation: decor-sweep 18s ease-in-out infinite alternate; }
.decor-breathe { transform-origin: 100% 0; animation: decor-breathe 7s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .decor-sweep, .decor-breathe { animation: none; }
}
```

- [ ] **Step 2: Type-check + lint.** Run: `pnpm tsc && pnpm lint` — Expected: PASS (CSS-only change; no TS impact).

- [ ] **Step 3: Commit.**

```bash
git add "src/app/(frontend)/globals.css"
git commit -m "feat(design-system): add .theme-marketing tokens + decor motion classes"
```

---

## Task 2: Decor geometry builder + config

**Files:**
- Create: `src/shared/components/decor/constants/decor-config.ts`
- Create: `src/shared/components/decor/lib/build-decor-geometry.ts`

**Interfaces:**
- Produces:
  - `DECOR_VIEWBOX = 520`, `DECOR_ORIGIN = { x: 460, y: 60 }`, `DECOR_RING_COUNT = 8`, `DECOR_DRAW_STAGGER = 0.06`, `DECOR_DRAW_DURATION = 1.2`.
  - `type DecorShape = 'arc' | 'square' | 'triangle'`
  - `type RingDescriptor = { kind: 'circle', cx:number, cy:number, r:number, strokeWidth:number, opacity:number } | { kind: 'rect', x:number, y:number, size:number, strokeWidth:number, opacity:number } | { kind: 'path', d:string, strokeWidth:number, opacity:number }`
  - `buildDecorGeometry(shape: DecorShape, count?: number): RingDescriptor[]`

- [ ] **Step 1: Write the config constants.** Create `src/shared/components/decor/constants/decor-config.ts`:

```ts
export const DECOR_VIEWBOX = 520
export const DECOR_ORIGIN = { x: 460, y: 60 } as const
export const DECOR_RING_COUNT = 8
export const DECOR_DRAW_STAGGER = 0.06 // seconds between rings drawing in
export const DECOR_DRAW_DURATION = 1.2

export type DecorShape = 'arc' | 'square' | 'triangle'
```

- [ ] **Step 2: Write the geometry builder.** Create `src/shared/components/decor/lib/build-decor-geometry.ts`:

```ts
import type { DecorShape } from '@/shared/components/decor/constants/decor-config'
import { DECOR_ORIGIN, DECOR_RING_COUNT } from '@/shared/components/decor/constants/decor-config'

export type RingDescriptor
  = | { kind: 'circle', cx: number, cy: number, r: number, strokeWidth: number, opacity: number }
    | { kind: 'rect', x: number, y: number, size: number, strokeWidth: number, opacity: number }
    | { kind: 'path', d: string, strokeWidth: number, opacity: number }

// Linear interpolate across the ring index so stroke + opacity fall off from
// the corner outward — the tokenized "subtle but noticeable" ramp.
function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t
}

export function buildDecorGeometry(shape: DecorShape, count = DECOR_RING_COUNT): RingDescriptor[] {
  const { x, y } = DECOR_ORIGIN
  const base = 52
  const step = 44
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1)
    const strokeWidth = lerp(2.8, 1.5, t)
    const opacity = lerp(0.82, 0.1, t)
    const size = base + i * step
    if (shape === 'square') {
      return { kind: 'rect', x: x - size, y, size, strokeWidth, opacity }
    }
    if (shape === 'triangle') {
      const d = `M ${x} ${y} L ${x - size} ${y} L ${x} ${y + size} Z`
      return { kind: 'path', d, strokeWidth, opacity }
    }
    return { kind: 'circle', cx: x, cy: y, r: size, strokeWidth, opacity }
  })
}
```

- [ ] **Step 3: Type-check + lint.** Run: `pnpm tsc && pnpm lint` — Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add src/shared/components/decor/constants/decor-config.ts src/shared/components/decor/lib/build-decor-geometry.ts
git commit -m "feat(decor): geometry builder + config for atmosphere motif"
```

---

## Task 3: `<Decor>` component

**Files:**
- Create: `src/shared/components/decor/decor.tsx`

**Interfaces:**
- Consumes: `buildDecorGeometry`, `DECOR_*` config, `RingDescriptor`.
- Produces: `export function Decor(props: { shape?: DecorShape, rings?: number, className?: string }): JSX.Element`. Absolutely-positioned SVG anchored top-right; draws rings via motion/react `pathLength` with stagger; radial gradient band under strokes (`--decor-gradient-alpha`); origin dot; blueprint ticks only when `shape === 'arc'`. `useReducedMotion()` → static final state. Wraps rings in `.decor-sweep`, gradient in `.decor-breathe`. Stroke color `var(--decor-stroke)`.

- [ ] **Step 1: Write the component.** Create `src/shared/components/decor/decor.tsx`:

```tsx
'use client'

import type { DecorShape } from '@/shared/components/decor/constants/decor-config'
import { motion, useReducedMotion } from 'motion/react'
import {
  DECOR_DRAW_DURATION,
  DECOR_DRAW_STAGGER,
  DECOR_ORIGIN,
  DECOR_VIEWBOX,
} from '@/shared/components/decor/constants/decor-config'
import { buildDecorGeometry } from '@/shared/components/decor/lib/build-decor-geometry'
import { cn } from '@/shared/lib/utils'

/**
 * Brand-blue "atmosphere" layer — always anchored top-right, clipped by the
 * parent's overflow. One DNA (thin strokes + gradient band + falloff), varied
 * by `shape`. The parent MUST set `overflow-hidden` + `isolate`; content sits
 * on a higher z-index. Motion (draw-in) via motion/react; sweep/breathe via the
 * .decor-sweep/.decor-breathe CSS classes. Reduced motion → static final state.
 */
export function Decor({ shape = 'arc', rings, className }: { shape?: DecorShape, rings?: number, className?: string }) {
  const reduce = useReducedMotion()
  const geometry = buildDecorGeometry(shape, rings)
  const { x, y } = DECOR_ORIGIN

  return (
    <div className={cn('pointer-events-none absolute -top-[150px] -right-[150px] z-0 h-[500px] w-[500px]', className)} aria-hidden="true">
      <svg width="100%" height="100%" viewBox={`0 0 ${DECOR_VIEWBOX} ${DECOR_VIEWBOX}`} fill="none">
        <defs>
          <radialGradient id="decor-grad" cx={x} cy={y} r={420} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--decor-stroke)" stopOpacity="var(--decor-gradient-alpha)" />
            <stop offset="34%" stopColor="var(--decor-stroke)" stopOpacity="0.12" />
            <stop offset="66%" stopColor="var(--decor-stroke)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="var(--decor-stroke)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle className="decor-breathe" cx={x} cy={y} r={420} fill="url(#decor-grad)" />

        <g className="decor-sweep" stroke="var(--decor-stroke)" fill="none" strokeLinecap="round">
          {geometry.map((ring, i) => {
            const common = {
              strokeWidth: ring.strokeWidth,
              initial: reduce ? false : { pathLength: 0, opacity: 0 },
              animate: { pathLength: 1, opacity: ring.opacity },
              transition: { duration: DECOR_DRAW_DURATION, delay: reduce ? 0 : i * DECOR_DRAW_STAGGER, ease: [0.32, 0.72, 0, 1] as const },
            }
            if (ring.kind === 'rect') {
              return <motion.rect key={i} x={ring.x} y={ring.y} width={ring.size} height={ring.size} {...common} />
            }
            if (ring.kind === 'path') {
              return <motion.path key={i} d={ring.d} {...common} />
            }
            return <motion.circle key={i} cx={ring.cx} cy={ring.cy} r={ring.r} {...common} />
          })}

          {shape === 'arc'
            ? (
                <g strokeWidth={1.6} opacity={0.55}>
                  <line x1={x} y1={y} x2={x - 108} y2={y} />
                  <line x1={x} y1={y} x2={x - 84} y2={y + 68} />
                  <line x1={x} y1={y} x2={x - 36} y2={y + 106} />
                  <line x1={150} y1={44} x2={150} y2={150} />
                  <line x1={144} y1={50} x2={156} y2={50} />
                  <line x1={144} y1={144} x2={156} y2={144} />
                </g>
              )
            : null}
        </g>

        <circle cx={x} cy={y} r={7} fill="var(--decor-stroke)" />
      </svg>
    </div>
  )
}
```

- [ ] **Step 2: Type-check + lint.** Run: `pnpm tsc && pnpm lint` — Expected: PASS. (Confirms `cn`, motion/react imports, and prop types resolve.)

- [ ] **Step 3: Commit.**

```bash
git add src/shared/components/decor/decor.tsx
git commit -m "feat(decor): parametric <Decor> atmosphere component (arc/square/triangle)"
```

---

## Task 4: `<CredentialStrip>` + credential data

**Files:**
- Create: `src/shared/components/trust/lib/build-credentials.ts`
- Create: `src/shared/components/trust/credential-strip.tsx`

**Interfaces:**
- Consumes: `companyInfo` / `licenses` / `insurances` from `@/shared/constants/company`.
- Produces:
  - `type Credential = { label: string }`
  - `buildCredentials(): Credential[]` → `[{label:'Licensed #1076760'},{label:'Bonded & Insured'},{label:'BBB A+ Rated'}]` (3 items, derived from constants).
  - `export function CredentialStrip(props: { className?: string }): JSX.Element` — left-aligned row, single-line items, brand-blue diamond per item, Nunito 600, `--cred-gap`, top hairline.

- [ ] **Step 1: Verify the constant import path.** Run: `grep -n "licenseNumber\|numProjects\|export const licenses\|export const companyInfo" src/shared/constants/company/licenses.ts src/shared/constants/company/company-info.ts` — Expected: shows `licenseNumber: '1076760'` and `companyInfo`. Confirm barrel `@/shared/constants/company` re-exports them (check `src/shared/constants/company/index.ts`).

- [ ] **Step 2: Write the credential builder.** Create `src/shared/components/trust/lib/build-credentials.ts`:

```ts
import { licenses } from '@/shared/constants/company/licenses'

export interface Credential { label: string }

// Derived from company constants — never hardcode trust facts in components.
// 3 items so the row fills cleanly and never orphan-wraps (spec §7).
export function buildCredentials(): Credential[] {
  return [
    { label: `Licensed #${licenses[0].licenseNumber}` },
    { label: 'Bonded & Insured' },
    { label: 'BBB A+ Rated' },
  ]
}
```

- [ ] **Step 3: Write the component.** Create `src/shared/components/trust/credential-strip.tsx`:

```tsx
import { buildCredentials } from '@/shared/components/trust/lib/build-credentials'
import { cn } from '@/shared/lib/utils'

/**
 * Trust credential row — left-aligned, single-line items separated by air (not
 * borders), each led by a brand-blue diamond (geometric DNA). Nunito 600, one
 * size: nothing orphan-wraps. Facts come from company constants. Spec §7.
 */
export function CredentialStrip({ className }: { className?: string }) {
  const credentials = buildCredentials()
  return (
    <div className={cn('flex flex-wrap items-center border-t pt-4', className)} style={{ columnGap: 'var(--cred-gap)', rowGap: '10px' }}>
      {credentials.map(c => (
        <span key={c.label} className="inline-flex items-center gap-2 whitespace-nowrap text-[13px] font-semibold" style={{ color: 'var(--cred-ink)' }}>
          <span className="size-[7px] shrink-0 rotate-45 rounded-[1px]" style={{ background: 'var(--primary)' }} />
          {c.label}
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Type-check + lint.** Run: `pnpm tsc && pnpm lint` — Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/shared/components/trust/lib/build-credentials.ts src/shared/components/trust/credential-strip.tsx
git commit -m "feat(trust): credential strip sourced from company constants"
```

---

## Task 5: Rewrite the Callout block (Blueprint Authority)

**Files:**
- Modify: `src/shared/domains/funnels/types.ts:177-181` (add `ctaLabel?`)
- Rewrite: `src/shared/domains/funnels/ui/blocks/callout-block.tsx`

**Interfaces:**
- Consumes: `CalloutBlockContent`, `FunnelContext`, `<Decor>`, `<CredentialStrip>`.
- Produces: `export function CalloutBlock({ content, ctx }: { content: CalloutBlockContent, ctx: FunnelContext }): JSX.Element` — keeps the registry signature; renders eyebrow → headline → body → `<CredentialStrip>` → CTA, with `<Decor shape="arc">` top-right.

- [ ] **Step 1: Extend the content type.** In `src/shared/domains/funnels/types.ts`, change the `CalloutBlockContent` interface (line 177) to:

```ts
export interface CalloutBlockContent {
  headline: string
  body: string
  points?: string[]
  eyebrow?: string
  ctaLabel?: string
}
```

- [ ] **Step 2: Rewrite the block.** Replace the entire contents of `src/shared/domains/funnels/ui/blocks/callout-block.tsx`:

```tsx
import type { CalloutBlockContent, FunnelContext } from '@/shared/domains/funnels/types'
import { ArrowRight } from 'lucide-react'
import { Decor } from '@/shared/components/decor/decor'
import { CredentialStrip } from '@/shared/components/trust/credential-strip'

/**
 * "Blueprint Authority" callout — warm-concrete panel + brand-blue blueprint
 * atmosphere (top-right), credential trust row, single accent CTA. Consumes the
 * marketing theme tokens; must render inside a `.theme-marketing` scope.
 * Design: docs/superpowers/specs/2026-06-22-anti-slop-design-system-design.md
 */
export function CalloutBlock({ content }: { content: CalloutBlockContent, ctx: FunnelContext }) {
  return (
    <section className="bg-background relative w-full overflow-hidden py-10">
      <div className="bg-card relative isolate mx-auto w-full max-w-[560px] overflow-hidden rounded-md px-9 py-9" style={{ boxShadow: 'var(--shadow-card)' }}>
        <Decor shape="arc" />

        <p className="font-sans text-[11.5px] font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--accent-ink)' }}>
          {content.eyebrow ?? 'Financing · in writing'}
        </p>
        <h2 className="text-foreground font-sans mt-3 text-[21px] leading-[1.2] font-bold tracking-[-0.01em]">
          {content.headline}
        </h2>
        <p className="mt-2.5 max-w-[48ch] text-[14.5px]" style={{ color: 'var(--body-text)' }}>
          {content.body}
        </p>

        <CredentialStrip className="mt-6" />

        <button type="button" className="bg-foreground text-card font-sans mt-6 inline-flex items-center gap-2.5 rounded-[3px] px-6 py-3.5 text-[14.5px] font-bold">
          {content.ctaLabel ?? 'See what you qualify for'}
          <ArrowRight className="size-4" style={{ color: 'var(--primary)' }} />
        </button>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Type-check + lint.** Run: `pnpm tsc && pnpm lint` — Expected: PASS. (`ctx` is intentionally unused now; if lint flags unused param, prefix the destructure as `{ content }` only — already done; the `FunnelContext` type stays in the signature.)

- [ ] **Step 4: Commit.**

```bash
git add "src/shared/domains/funnels/types.ts" "src/shared/domains/funnels/ui/blocks/callout-block.tsx"
git commit -m "feat(funnel): rebuild callout block in Blueprint Authority direction"
```

---

## Task 6: `/test` route (proof surface)

**Files:**
- Create: `src/app/(frontend)/test/layout.tsx`
- Create: `src/app/(frontend)/test/page.tsx`

**Interfaces:**
- Consumes: `CalloutBlock`, `MarketingBlock`/`FunnelContext` types.
- Produces: a page at `/test` rendering the redesigned callout inside `.theme-marketing`.

- [ ] **Step 1: Write the isolated layout.** Create `src/app/(frontend)/test/layout.tsx`:

```tsx
import type { ReactNode } from 'react'

// Isolated design-system proof surface. `.theme-marketing` scopes the warm
// showcase tokens; `text-foreground` re-asserts color under the app-wide
// `<html class="dark">` (same reason as the funnel layout).
export default function TestLayout({ children }: { children: ReactNode }) {
  return <div className="theme-marketing bg-background text-foreground min-h-dvh">{children}</div>
}
```

- [ ] **Step 2: Write the page.** Create `src/app/(frontend)/test/page.tsx`:

```tsx
import type { FunnelContext } from '@/shared/domains/funnels/types'
import { CalloutBlock } from '@/shared/domains/funnels/ui/blocks/callout-block'
import { EMPTY_UTM } from '@/shared/domains/funnels/hooks/use-funnel-utm'

// FunnelTheme is `{ accent: string }`; FunnelUtm is the EMPTY_UTM shape.
const DEMO_CTX: FunnelContext = { slug: 'kitchens', offer: 'kitchen remodel', theme: { accent: '#03AFED' }, utm: EMPTY_UTM }

export default function TestPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-5 py-16">
      <CalloutBlock
        ctx={DEMO_CTX}
        content={{
          headline: 'A Showcase kitchen, without draining your savings.',
          body: 'Fixed, low monthly payments. We walk you through the options you qualify for during your consultation — no obligation, clear written numbers.',
        }}
      />
    </main>
  )
}
```

- [ ] **Step 3: (resolved) `FunnelContext` shape is already correct above** — `theme: { accent }` and `utm: EMPTY_UTM`. No action unless tsc complains.

- [ ] **Step 4: Type-check + lint.** Run: `pnpm tsc && pnpm lint` — Expected: PASS.

- [ ] **Step 5: Visual verification.** Run `pnpm dev`, open `http://localhost:3000/test`. Confirm: warm-concrete card, brand-blue blueprint arcs animating in top-right, left-aligned credential row (Licensed #1076760 · Bonded & Insured · BBB A+ Rated), dark CTA with blue arrow, no monospace, no purple. (Optional: capture a screenshot via Playwright MCP `browser_navigate`.)

- [ ] **Step 6: Commit.**

```bash
git add "src/app/(frontend)/test/layout.tsx" "src/app/(frontend)/test/page.tsx"
git commit -m "feat(test): /test proof route rendering Blueprint Authority callout"
```

---

## Task 7: Restyle FAQ accordion (2nd proof)

**Files:**
- Modify: `src/shared/domains/funnels/ui/blocks/faq-block.tsx`
- Modify: `src/app/(frontend)/test/page.tsx` (add the accordion below the callout)

**Interfaces:**
- Consumes: `<Decor shape="square">`, marketing tokens, existing `FaqBlockContent`.
- Produces: FAQ block restyled to the system (tokens, brand-blue chevron, square decor variant), unchanged props/signature.

- [ ] **Step 1: Restyle the block.** In `src/shared/domains/funnels/ui/blocks/faq-block.tsx`, wrap the `<section>` so it carries the decor + token surface, and re-point colors to tokens. Replace the `<section>` open tag and add decor as its first child:

```tsx
// add import at top:
import { Decor } from '@/shared/components/decor/decor'

// change the section wrapper to:
<section className="bg-background relative isolate w-full overflow-hidden py-10">
  <Decor shape="square" />
  {content.title ? <h2 className="text-foreground font-sans relative z-[1] text-center text-2xl font-bold tracking-[-0.01em]">{content.title}</h2> : null}
  <div className="relative z-[1] mx-auto flex w-full max-w-[560px] flex-col gap-2">
```

Then update each item card to use tokens: the item wrapper keeps `bg-card`, and the answer paragraph uses `style={{ color: 'var(--body-text)' }}`; the `ChevronDown` gets `style={{ color: 'var(--primary)' }}` (brand-blue chevron). Close the extra `<div>` and `</section>` accordingly. Keep all existing motion/`useReducedMotion`/`AnimatePresence` logic intact.

- [ ] **Step 2: Render it on /test.** In `src/app/(frontend)/test/page.tsx`, import `FaqBlock` and add below the callout:

```tsx
import { FaqBlock } from '@/shared/domains/funnels/ui/blocks/faq-block'
// ...inside <main>, after <CalloutBlock />:
<FaqBlock
  ctx={DEMO_CTX}
  content={{
    title: 'Common questions',
    items: [
      { q: 'How long does it take?', a: 'A typical Showcase kitchen runs about 3–10 weeks of active construction after design and permits.' },
      { q: 'Is financing available?', a: 'Yes — fixed, low monthly payments so you can start now and pay over time.' },
    ],
  }}
/>
```

- [ ] **Step 3: Type-check + lint.** Run: `pnpm tsc && pnpm lint` — Expected: PASS.

- [ ] **Step 4: Visual verification.** Reload `http://localhost:3000/test`. Confirm the accordion matches the system (warm cards, brand-blue chevrons, square decor top-right), and that opening/closing animation + reduced-motion still work.

- [ ] **Step 5: Commit.**

```bash
git add "src/shared/domains/funnels/ui/blocks/faq-block.tsx" "src/app/(frontend)/test/page.tsx"
git commit -m "feat(funnel): restyle FAQ accordion to design system (2nd proof)"
```

---

## Task 8: Author the docs (DESIGN.md, tokens, checklist) + pointers

**Files:**
- Create: `docs/design-system/DESIGN.md`
- Create: `docs/design-system/tokens.md`
- Create: `docs/design-system/anti-slop-checklist.md`
- Modify: `docs/codebase-conventions/README.md` (add pointer), `CLAUDE.md` ("Where to find things")

**Interfaces:** none (documentation).

- [ ] **Step 1: Write `docs/design-system/DESIGN.md`.** Author the constitution using spec §3, §5, §6, §7, §11 as the source content. Required sections, each filled with the verbatim rules from the spec (no placeholders): **Brand POV**; **Per-dimension rules** (typography: Syne/Nunito, no mono, weight/size extremes; color: neutrals + lone `#03AFED`; spacing; radius; elevation hairline-first; motion + reduced-motion law; atmosphere/decor always on hero surfaces; layout one-primitive-left-aligned; copy specificity + "40+ yrs combined" guardrail); **Negative constraints** (the banned slop fingerprint list from spec §2/§5); **Theme contract** (marketing vs app, shared primitives); **Communication protocol** (spec §11). Cross-link tokens.md + anti-slop-checklist.md.

- [ ] **Step 2: Write `docs/design-system/tokens.md`.** Document the three tiers and every token from Task 1 (name → value → meaning), the theme-via-class mechanism, and how components consume tokens (Tailwind semantic utilities + `var(--x)` for the new tokens). Note OKLCH conversion as a follow-up (spec §13).

- [ ] **Step 3: Write `docs/design-system/anti-slop-checklist.md`.** Copy the checklist from spec §8 as a runnable gate (the `- [ ]` list + the 0-1/2-3/4+ scoring).

- [ ] **Step 4: Add pointers.** In `docs/codebase-conventions/README.md`, add a line under the appropriate index section: `- [Design System](../design-system/DESIGN.md) — app-wide tokens, anti-slop rules, decor + trust patterns`. In `CLAUDE.md` under "Where to find things" → "Engineering", add: `- `docs/design-system/` — design tokens, anti-slop DESIGN.md + checklist`.

- [ ] **Step 5: Lint (markdown is ignored by tsc).** Run: `pnpm lint` — Expected: PASS (or no JS/TS impact).

- [ ] **Step 6: Commit.**

```bash
git add docs/design-system "docs/codebase-conventions/README.md" CLAUDE.md
git commit -m "docs(design-system): DESIGN.md constitution, tokens, anti-slop checklist + pointers"
```

---

## Self-Review

**Spec coverage:**
- §3 locked decisions → Task 1 (tokens/theme/blue/no-mono), Tasks 3/5/7 (decor, callout, accordion). ✔
- §4 token architecture → Task 1. ✔
- §5 DESIGN.md → Task 8. ✔
- §6 decor system → Tasks 2–3. ✔
- §7 trust layer → Task 4. ✔
- §8 checklist → Task 8. ✔
- §9 proof component + /test → Tasks 5–7. ✔
- §10 file placement → all tasks follow it. ✔
- §11 communication protocol → Task 8 (DESIGN.md). ✔
- §12 phasing → dashboard re-theme intentionally NOT a task (deferred). ✔
- §13 open questions resolved: theme = **class** (`.theme-marketing`, Task 1); `<Decor>` home = **shared** (`src/shared/components/decor/`, Task 3); OKLCH conversion = deferred follow-up (noted Task 8 step 2). ✔

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to". Doc-authoring tasks reference the committed spec for verbatim content (concrete, in-repo), not vague instructions.

**Type consistency:** `DecorShape`, `RingDescriptor`, `buildDecorGeometry`, `buildCredentials`/`Credential`, `CalloutBlock({content,ctx})`, `Decor({shape,rings,className})`, `CredentialStrip({className})` are used consistently across tasks. New token names (`--accent-ink`,`--body-text`,`--cred-ink`,`--cred-gap`,`--shadow-card`,`--decor-stroke`,`--decor-gradient-alpha`) defined in Task 1 and consumed in Tasks 3–7.

**Note on adaptation:** This repo has no unit-test runner, so the TDD red-green loop is replaced by `pnpm tsc` + `pnpm lint` + explicit visual verification on `/test` (Task 6/7), per the project's stated verification flow. This is intentional, not an omission.
