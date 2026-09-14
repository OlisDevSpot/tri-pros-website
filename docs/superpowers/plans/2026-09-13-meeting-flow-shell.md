# Meeting Flow Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the meeting-flow shell as one full-size stage with a customer-carrying top bar, a shell-owned inspector panel behind a hamburger and a right-hand rail, a floating step capsule, present mode, and one keyboard owner, without touching any step's content or the backend.

**Architecture:** The view root carries `data-stage`; the dashboard template drops its padding and the mobile nav hides through `:has()`. Inside the root: a top bar (grid, three columns), a stage row (`isolate`) holding the step scroller, the absolutely positioned capsule, the sliding panel (`z-20`) and the rail (`z-30`). One `keydown` listener on `window` owns every flow key; a `[data-step-root]` element on each step receives focus after every step change; the presentation exposes `next`/`prev` through a React 19 `ref`. Present mode is the shadcn sidebar hook's `setOpen` plus a hidden top bar.

**Tech Stack:** Next.js 15.5 App Router, React 19 (`ref` as a prop, `inert`, `useId`), nuqs 2.8, Tailwind v4 (`has-data-*`, named container queries, `motion-safe:`), shadcn/Radix (`Button`, `Avatar`, `Badge`, `Separator`, `useSidebar`), motion/react 12 (unchanged in the presentation), lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-13-meeting-flow-shell-design.md`
**Research the key map and the opt-out are built on:** `docs/plans/2026-09-13-meeting-flow-keyboard-focus-research.md`, `docs/plans/2026-09-13-meeting-flow-present-mode-research.md`

## Global Constraints

- Package manager is **pnpm**. Path alias `@/` → `src/`. Never run `pnpm build`; verification is `pnpm tsc` and `pnpm lint` (or `pnpm exec eslint <files>`) only (repo memory `feedback-verification-workflow`).
- The working tree is **shared with the user's live editor**. `git stash`, `git checkout <ref> -- .`, `git restore` beyond your own task's files, `git reset`, `git add -A`, `git add .`, and `git add -u` without a path are forbidden (repo memory `feedback-subagent-shared-tree-safety`). The tree already holds unrelated uncommitted changes: do not touch them.
- Work happens **on `main`**. Stage by explicit path only. Commit steps below run **only if the user has confirmed commits for this plan at execution start**; otherwise stop at staging by path and report.
- Coding conventions (repo memory `coding-conventions`): one React component per file; no file-level constants in component or view files (constants go in `constants/`); named exports; prop interfaces stay in the component file; hooks in `hooks/`; contexts in `contexts/`; prefer shadcn primitives over native elements; absolute `@/` imports.
- Eslint is `@antfu/eslint-config`: no semicolons, single quotes, sorted imports (type imports first, then packages, then `@/`), `react-hooks-extra/no-direct-set-state-in-use-effect` is on (precedent for a justified disable: `src/shared/hooks/use-mobile.ts`). Run `pnpm exec eslint --fix <files>` before `pnpm exec eslint <files>`.
- Company facts come from `src/shared/constants/company/`; the shell adds no company copy. Every user-facing string the shell introduces lives in `src/features/meeting-flow/constants/shell-copy.ts`.
- Design system is `docs/design-system/DESIGN.md` (Command Desk world) and `docs/ui-design-playbook.md` hard rules: one primary-colour moment at rest (the active step tab), hairline borders, every number `tabular-nums`, every touch target ≥ 44 px (`size-11` / `h-11`), all transitions behind `motion-safe:`, no `transition-all` in new code, no nested cards.
- Keyboard rules from the research note: the listener is on `window`, bubble phase, never `document` capture; bail on `event.defaultPrevented`, IME, modifier keys, targets outside the flow root, and typing targets; scroll beats with `scrollTo` to the exact snap position, never `scrollBy`; focus the step root with `{ preventScroll: true }`.
- Present mode uses `useSidebar()` from `@/shared/components/ui/sidebar` as it is. **Do not modify `sidebar.tsx`.**
- **Files off limits** (read only): `src/app/(frontend)/dashboard/layout.tsx`, `src/shared/components/ui/sidebar.tsx`, everything under `src/trpc/`, `src/shared/dal/`, `src/shared/db/`, `src/shared/services/`, `src/shared/entities/**/dal/`, `src/features/meeting-flow/dal/`, and every step component under `src/features/meeting-flow/ui/components/steps/` except the four Who We Are files named in Task 2.
- No unit test runner exists in this repo. Each task verifies with `pnpm tsc`, `pnpm exec eslint <files>`, and, where the task renders UI, a rendered check in a Playwright browser against the running dev server (`pnpm dev` on port 3000; `.env.local` has no `PORT` override). Before judging rendered CSS on a long-running dev server: stop it, `rm -rf .next`, restart (repo memory `project-tailwind-content-detection-gap`). Log in with `http://localhost:3000/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET from .env.local>&redirect=/dashboard/meetings` first (repo memory `reference-playwright-auth`). A dev meeting to open: `http://localhost:3000/dashboard/meetings/2069fa85-0357-4550-8eb5-6ae40eacf5a9?step=1`. Headless Playwright from Node: `import { chromium } from '<repo>/node_modules/playwright/index.mjs'`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/features/meeting-flow/types/index.ts` (modify) | `PanelSection`, `PresentationHandle`, `KeyHint` |
| `src/features/meeting-flow/constants/keyboard-hints.ts` (create) | key map for the help list, `aria-keyshortcuts` values, typing-target selector, key sets |
| `src/features/meeting-flow/constants/shell.ts` (create) | `PANEL_ID`, `PANEL_SECTIONS`, `DEFAULT_PANEL_SECTION` |
| `src/features/meeting-flow/constants/shell-copy.ts` (create) | every string the shell shows |
| `src/app/(frontend)/dashboard/template.tsx` (modify) | `has-data-stage:p-0` |
| `src/app/(frontend)/globals.css` (modify) | hide the mobile nav when a stage is inside the inset |
| `src/features/agent-dashboard/ui/components/mobile-bottom-nav.tsx` (modify) | `data-slot="dashboard-mobile-nav"` |
| `docs/codebase-conventions/app-shell.md` (modify) | rule `stage-routes-opt-out-with-data-stage` |
| `src/features/meeting-flow/contexts/presentation-context.tsx` (modify) | `registerSection` |
| `src/features/meeting-flow/ui/components/presentation/snap-section.tsx` (modify) | register its element |
| `src/features/meeting-flow/ui/components/presentation/snap-presentation.tsx` (modify) | `ref` handle, section registry, `scrollToIndex`, `data-step-root`, `--stage-inset-b` |
| `src/features/meeting-flow/ui/components/presentation/pinned-column.tsx` (modify) | `--pres-chrome-b` → `--stage-inset-b` |
| `src/features/meeting-flow/ui/components/steps/who-we-are/{hook,point,credentials}-section.tsx` (modify) | same rename |
| `src/features/meeting-flow/ui/components/steps/who-we-are/index.tsx` (modify) | forward `ref` |
| `src/features/meeting-flow/hooks/use-meeting-flow-keys.ts` (create) | the one keyboard owner |
| `src/features/meeting-flow/hooks/use-present-mode.ts` (create) | present mode over `useSidebar` |
| `src/features/meeting-flow/ui/components/shell/stage-frame.tsx` (create) | the `data-stage` root |
| `src/features/meeting-flow/ui/components/shell/step-region.tsx` (create) | page-step scroller, focusable step root |
| `src/features/meeting-flow/ui/components/shell/step-capsule.tsx` (create) | floating Prev / counter / Next / Present |
| `src/features/meeting-flow/ui/components/shell/step-tabs.tsx` (create) | top-bar step tabs (replaces `step-nav.tsx`) |
| `src/features/meeting-flow/ui/components/shell/customer-chip.tsx` (create) | customer identity, opens the profile modal |
| `src/features/meeting-flow/ui/components/shell/top-bar.tsx` (create) | three-column top bar |
| `src/features/meeting-flow/ui/components/shell/meeting-section.tsx` (create) | panel: date, type, outcome, Reschedule, View in schedule, keyboard list |
| `src/features/meeting-flow/ui/components/context-panel.tsx` (modify) | body only, no Sheet |
| `src/features/meeting-flow/ui/components/persona-profile-panel.tsx` (modify) | body only, no Sheet |
| `src/features/meeting-flow/ui/components/shell/inspector-rail.tsx` (create) | lg+ rail with three section buttons |
| `src/features/meeting-flow/ui/components/shell/meeting-panel.tsx` (create) | the sliding, non-modal panel container |
| `src/features/meeting-flow/ui/views/meeting-flow.tsx` (modify) | compose the shell, own panel and present state, mount the key hook |
| `src/features/meeting-flow/ui/components/step-nav.tsx` (delete) | superseded by `step-tabs.tsx` |
| `src/features/meeting-flow/ui/components/context-panel-trigger.tsx` (delete) | superseded by the rail |
| `src/features/meeting-flow/ui/components/persona-profile-trigger.tsx` (delete) | superseded by the rail |

---

### Task 1: Foundation — types, constants, template opt-out, app-shell rule

**Files:**
- Modify: `src/features/meeting-flow/types/index.ts` (append after the `MeetingStepLayout` type, line 79)
- Create: `src/features/meeting-flow/constants/keyboard-hints.ts`
- Create: `src/features/meeting-flow/constants/shell.ts`
- Create: `src/features/meeting-flow/constants/shell-copy.ts`
- Modify: `src/app/(frontend)/dashboard/template.tsx:12`
- Modify: `src/app/(frontend)/globals.css` (append at the end of the file)
- Modify: `src/features/agent-dashboard/ui/components/mobile-bottom-nav.tsx:16`
- Modify: `docs/codebase-conventions/app-shell.md` (insert before `### proposal-flow-layout-shape-fixed`, line 105)

**Interfaces:**
- Consumes: nothing new.
- Produces: `PanelSection`, `PresentationHandle`, `KeyHint` types; `MEETING_FLOW_KEY_HINTS: KeyHint[]`, `KEY_SHORTCUTS`, `TYPING_TARGET_SELECTOR: string`, `REPEATABLE_KEYS: ReadonlySet<string>`, `ARROW_KEYS: ReadonlySet<string>`; `PANEL_ID = 'meeting-panel'`, `PANEL_SECTIONS: PanelSection[]`, `DEFAULT_PANEL_SECTION: PanelSection`; `SHELL_COPY`, `PANEL_SECTION_LABELS: Record<PanelSection, string>`. The `[data-stage]` contract (template padding off, mobile nav hidden) that Task 8 activates.

- [ ] **Step 1: Add the shell types**

Append to `src/features/meeting-flow/types/index.ts` directly after the `MeetingStepLayout` line:

```ts
// ── Shell (top bar, inspector panel, keys) ─────────────────────────────────

/** Which inspector-panel section is open; the panel is closed when the view holds `null`. */
export type PanelSection = 'meeting' | 'context' | 'persona'

/** Imperative surface a presentation-layout step exposes to the shell's key map. */
export interface PresentationHandle {
  next: () => void
  prev: () => void
}

/** One row of the keyboard help list. */
export interface KeyHint {
  keys: string[]
  label: string
}
```

- [ ] **Step 2: Create the keyboard constants**

Create `src/features/meeting-flow/constants/keyboard-hints.ts`:

```ts
import type { KeyHint } from '@/features/meeting-flow/types'

/** Rendered as `<kbd>` badges in the panel's Meeting section. */
export const MEETING_FLOW_KEY_HINTS: KeyHint[] = [
  { keys: ['←', '→'], label: 'Previous / next step' },
  { keys: ['↑', '↓', 'A', 'Z'], label: 'Previous / next beat in the presentation' },
  { keys: ['1–7'], label: 'Jump to a step' },
  { keys: ['P'], label: 'Present mode on / off' },
  { keys: ['Esc'], label: 'Close the panel, then exit present mode' },
]

/** `aria-keyshortcuts` values (WAI-ARIA key names) for the controls each key drives. */
export const KEY_SHORTCUTS = {
  prevStep: 'ArrowLeft',
  nextStep: 'ArrowRight',
  present: 'P',
  presentation: 'ArrowUp ArrowDown A Z',
} as const

/**
 * Elements whose own keyboard interaction must win over the flow map: text entry
 * plus the APG roles that consume arrows, Home/End and printable characters
 * (Radix Select = combobox + listbox, Menu = menu/menuitem, cmdk = combobox).
 */
export const TYPING_TARGET_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="option"]',
  '[role="textbox"]',
  '[role="searchbox"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
].join(',')

/** Keys that may auto-repeat while held (hold-to-scroll); toggles and jumps must not flap. */
export const REPEATABLE_KEYS: ReadonlySet<string> = new Set(['ArrowUp', 'ArrowDown', 'a', 'A', 'z', 'Z'])

export const ARROW_KEYS: ReadonlySet<string> = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])
```

- [ ] **Step 3: Create the shell constants and copy**

Create `src/features/meeting-flow/constants/shell.ts`:

```ts
import type { PanelSection } from '@/features/meeting-flow/types'

/** DOM id of the inspector panel; `aria-controls` target for the hamburger and rail buttons. */
export const PANEL_ID = 'meeting-panel'

export const PANEL_SECTIONS: PanelSection[] = ['meeting', 'context', 'persona']

/** Section the hamburger opens the first time. */
export const DEFAULT_PANEL_SECTION: PanelSection = 'meeting'
```

Create `src/features/meeting-flow/constants/shell-copy.ts`:

```ts
import type { PanelSection } from '@/features/meeting-flow/types'

export const SHELL_COPY = {
  backToMeetings: 'Meetings',
  noCustomer: 'No customer',
  viewCustomerProfile: 'View customer profile',
  stepsNavLabel: 'Meeting steps',
  openPanel: 'Open meeting panel',
  closePanel: 'Close meeting panel',
  panelLabel: 'Meeting panel',
  railLabel: 'Inspector',
  prevStep: 'Previous step',
  nextStep: 'Next step',
  present: 'Present',
  exitPresent: 'Exit present mode',
  reschedule: 'Reschedule',
  viewInSchedule: 'View in schedule',
  when: 'When',
  type: 'Type',
  outcome: 'Outcome',
  keyboardHeading: 'Keyboard',
} as const

export const PANEL_SECTION_LABELS: Record<PanelSection, string> = {
  meeting: 'Meeting',
  context: 'Context',
  persona: 'Persona',
}
```

- [ ] **Step 4: Template opt-out, mobile-nav slot, globals rule**

In `src/app/(frontend)/dashboard/template.tsx` line 12, change the `motion.main` className from

```
"relative min-h-0 min-w-0 flex-1 overflow-hidden px-4 pb-20 pt-4 md:px-6 md:py-6 md:pb-6"
```

to

```
"relative min-h-0 min-w-0 flex-1 overflow-hidden px-4 pb-20 pt-4 md:px-6 md:py-6 md:pb-6 has-data-stage:p-0"
```

In `src/features/agent-dashboard/ui/components/mobile-bottom-nav.tsx` line 16, change

```tsx
    <div className="fixed bottom-4 left-4 right-4 z-30 md:hidden">
```

to

```tsx
    <div className="fixed bottom-4 left-4 right-4 z-30 md:hidden" data-slot="dashboard-mobile-nav">
```

Append to the very end of `src/app/(frontend)/globals.css` (outside every `@layer`, so it wins over utilities):

```css
/* Stage routes (today: the meeting flow) opt out of the dashboard chrome. The
   template drops its padding via `has-data-stage:p-0`; this hides the mobile nav.
   Rule: docs/codebase-conventions/app-shell.md#stage-routes-opt-out-with-data-stage */
[data-slot='sidebar-inset']:has([data-stage]) [data-slot='dashboard-mobile-nav'] {
  display: none;
}
```

- [ ] **Step 5: Record the rule**

In `docs/codebase-conventions/app-shell.md`, insert before the line `### proposal-flow-layout-shape-fixed`:

```markdown
### stage-routes-opt-out-with-data-stage

A route that must render edge to edge inside the dashboard (today: the meeting flow, `/dashboard/meetings/[meetingId]`) marks its root element with `data-stage`. Two selectors react to it; `layout.tsx` does not change:

- `src/app/(frontend)/dashboard/template.tsx` — `motion.main` carries `has-data-stage:p-0`, so the template's page padding disappears only while a stage is inside it.
- `src/app/(frontend)/globals.css` — `[data-slot='sidebar-inset']:has([data-stage]) [data-slot='dashboard-mobile-nav'] { display: none }` hides the mobile bottom nav for that route.

The stage route then supplies its own gutters where it wants them (the meeting flow's page steps do; its presentation does not) and its own safe-area bottom padding.

**Why**: the dashboard layout shape is fixed (rule above). A route group or a nested layout would fork the shell or remount the sidebar; a pathname-aware template couples the template to routes. One attribute plus two `:has()` selectors keeps one layout and one template.
**Reference impl**: `src/features/meeting-flow/ui/views/meeting-flow.tsx` (root `data-stage`)
**Enforced by**: convention

```

- [ ] **Step 6: Verify**

```bash
pnpm tsc
pnpm exec eslint --fix src/features/meeting-flow/types/index.ts src/features/meeting-flow/constants/keyboard-hints.ts src/features/meeting-flow/constants/shell.ts src/features/meeting-flow/constants/shell-copy.ts "src/app/(frontend)/dashboard/template.tsx" src/features/agent-dashboard/ui/components/mobile-bottom-nav.tsx
pnpm exec eslint src/features/meeting-flow/types/index.ts src/features/meeting-flow/constants/keyboard-hints.ts src/features/meeting-flow/constants/shell.ts src/features/meeting-flow/constants/shell-copy.ts "src/app/(frontend)/dashboard/template.tsx" src/features/agent-dashboard/ui/components/mobile-bottom-nav.tsx
```

Expected: both exit 0. Then, with the dev server running and logged in, open `http://localhost:3000/dashboard/meetings` at 1440×900 and at 390×844 and evaluate

```js
(() => { const m = document.querySelector('main[data-slot="sidebar-inset"] main'); const n = document.querySelector('[data-slot="dashboard-mobile-nav"]'); return JSON.stringify({ padding: getComputedStyle(m).padding, nav: n ? getComputedStyle(n).display : 'absent' }) })()
```

Expected at 1440: `padding` is `24px`, `nav` is `none` (the `md:hidden` utility). Expected at 390: `padding` is `16px 16px 80px`, `nav` is `block`. Nothing on this list page has `data-stage`, so nothing changed here yet.

- [ ] **Step 7: Commit (only if commits are confirmed)**

```bash
git add src/features/meeting-flow/types/index.ts src/features/meeting-flow/constants/keyboard-hints.ts src/features/meeting-flow/constants/shell.ts src/features/meeting-flow/constants/shell-copy.ts "src/app/(frontend)/dashboard/template.tsx" "src/app/(frontend)/globals.css" src/features/agent-dashboard/ui/components/mobile-bottom-nav.tsx docs/codebase-conventions/app-shell.md
git commit -m "feat(meeting-flow): shell types, constants and the data-stage template opt-out

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Presentation handle — section registry, `scrollToIndex`, `ref`, `data-step-root`, retire `--pres-chrome-b`

**Files:**
- Modify: `src/features/meeting-flow/contexts/presentation-context.tsx`
- Modify: `src/features/meeting-flow/ui/components/presentation/snap-section.tsx`
- Modify: `src/features/meeting-flow/ui/components/presentation/snap-presentation.tsx`
- Modify: `src/features/meeting-flow/ui/components/presentation/pinned-column.tsx:27`
- Modify: `src/features/meeting-flow/ui/components/steps/who-we-are/hook-section.tsx:21`
- Modify: `src/features/meeting-flow/ui/components/steps/who-we-are/point-section.tsx:26`
- Modify: `src/features/meeting-flow/ui/components/steps/who-we-are/credentials-section.tsx:68`
- Modify: `src/features/meeting-flow/ui/components/steps/who-we-are/index.tsx`

**Interfaces:**
- Consumes: `PresentationHandle` (Task 1).
- Produces: `SnapPresentation` accepts `ref?: Ref<PresentationHandle>` and marks its scroller `data-step-root`; `WhoWeAreStep` accepts `ref?: Ref<PresentationHandle>`; `PresentationContextValue.registerSection(index, el)`; every bottom-anchored presentation element reads `--stage-inset-b` (published by the view root in Task 8; the scroller carries a temporary `[--stage-inset-b:3.5rem]` until then).

- [ ] **Step 1: Extend the context**

In `src/features/meeting-flow/contexts/presentation-context.tsx`, change the interface to:

```ts
export interface PresentationContextValue {
  /** The snapping scroll container. Pass as `root` to every `useInView` inside. */
  scrollerRef: RefObject<HTMLDivElement | null>
  /** Index of the section currently past the in-view threshold. */
  activeIndex: number
  reportInView: (index: number, inView: boolean) => void
  /** Sections register their element so the scroller can scroll to an index. */
  registerSection: (index: number, el: HTMLElement | null) => void
}
```

- [ ] **Step 2: Register each section**

In `src/features/meeting-flow/ui/components/presentation/snap-section.tsx`, change the imports and the body so the section element is registered through a callback ref while `useInView` keeps its object ref:

```tsx
import { useInView } from 'motion/react'
import { useCallback, useEffect, useRef } from 'react'
```

```tsx
export function SnapSection({ index, id, labelledBy, children, className }: SnapSectionProps) {
  const ref = useRef<HTMLElement>(null)
  const { scrollerRef, reportInView, registerSection } = usePresentation()
  const inView = useInView(ref, { root: scrollerRef, amount: 0.5 })

  const setRef = useCallback((el: HTMLElement | null) => {
    ref.current = el
    registerSection(index, el)
  }, [index, registerSection])

  useEffect(() => {
    reportInView(index, inView)
  }, [index, inView, reportInView])

  return (
    <SectionInViewContext value={inView}>
      <section
        ref={setRef}
        aria-labelledby={labelledBy}
        className={cn(
          'relative min-h-[calc(100cqh-var(--pin-h))] snap-start snap-always overflow-hidden',
          className,
        )}
        id={id}
        style={{ scrollMarginTop: 0 }}
      >
        {children}
      </section>
    </SectionInViewContext>
  )
}
```

- [ ] **Step 3: The scroller: registry, `scrollToIndex`, handle, step root, variable**

Replace the whole of `src/features/meeting-flow/ui/components/presentation/snap-presentation.tsx` with:

```tsx
'use client'

import type { PresentationHandle } from '@/features/meeting-flow/types'
import type { ReactNode, Ref } from 'react'
import { MotionConfig } from 'motion/react'
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { PresentationContext } from '@/features/meeting-flow/contexts/presentation-context'
import { cn } from '@/shared/lib/utils'

interface SnapPresentationProps {
  /** Accessible name for the scroll region, e.g. "Who we are presentation". */
  label: string
  /** The sticky companion: first grid column on lg+, top band below. */
  aside: ReactNode
  children: ReactNode
  className?: string
  /** Imperative `next` / `prev` for the shell's key map (↑ ↓ A Z). */
  ref?: Ref<PresentationHandle>
}

/**
 * Full-height, section-snapping scroller for `presentation`-layout steps.
 * Snap is the browser's (CSS scroll-snap); the JS is in-view tracking plus an
 * absolute `scrollTo` for keyboard beat navigation.
 * Recipes and citations: docs/plans/2026-09-11-meeting-flow-scroll-snap-research.md,
 * docs/plans/2026-09-13-meeting-flow-keyboard-focus-research.md §4.3.
 *
 * Sizing contract: the scroller is a size container, so children size with
 * `cqh`/`cqw`. `--pin-h` is the sticky band height below `lg` (0 on lg+); sections
 * subtract it and the scroller pads snap positions by it. `--stage-inset-b` is the
 * strip at the bottom of the stage that the shell's floating capsule covers; the
 * meeting-flow view publishes it and bottom-anchored content floors its offset at it.
 *
 * The scroller is the step root (`data-step-root`): the view focuses it after a
 * step change, so native scrolling and the flow's key map both target it.
 *
 * The scroller sits inside its own size container of the same box because an
 * element cannot query itself: `scroll-pt-(--pin-h)` is a property OF the
 * scroller, so its `cqh` resolves against the nearest ANCESTOR container. Without
 * the wrapper that is the viewport, and below `lg` snap positions get padded by
 * 30% of the viewport instead of the band, resting every section off the band's
 * edge. Descendants still resolve against the scroller itself.
 */
export function SnapPresentation({ label, aside, children, className, ref }: SnapPresentationProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const sectionsRef = useRef(new Map<number, HTMLElement>())
  const pendingIndexRef = useRef<number | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const reportInView = useCallback((index: number, inView: boolean) => {
    if (inView) {
      setActiveIndex(index)
    }
  }, [])

  const registerSection = useCallback((index: number, el: HTMLElement | null) => {
    if (el) {
      sectionsRef.current.set(index, el)
    }
    else {
      sectionsRef.current.delete(index)
    }
  }, [])

  // The pending target only matters while a smooth scroll is in flight.
  useEffect(() => {
    if (pendingIndexRef.current === activeIndex) {
      pendingIndexRef.current = null
    }
  }, [activeIndex])

  const scrollToIndex = useCallback((index: number) => {
    const scroller = scrollerRef.current
    const section = sectionsRef.current.get(index)
    if (!scroller || !section) {
      return
    }
    // Land exactly on the snap position: the section's offset minus the scroller's
    // scroll-padding-top (the pinned band below lg). `behavior` stays 'auto' so
    // `motion-safe:scroll-smooth` decides; an absolute scroll snaps in any direction
    // and is not trapped by `snap-always`.
    const padTop = Number.parseFloat(getComputedStyle(scroller).scrollPaddingTop) || 0
    pendingIndexRef.current = index
    scroller.scrollTo({ top: section.offsetTop - padTop })
  }, [])

  useImperativeHandle(ref, () => ({
    next: () => {
      const from = pendingIndexRef.current ?? activeIndex
      scrollToIndex(Math.min(sectionsRef.current.size - 1, from + 1))
    },
    prev: () => {
      const from = pendingIndexRef.current ?? activeIndex
      scrollToIndex(Math.max(0, from - 1))
    },
  }), [activeIndex, scrollToIndex])

  const value = useMemo(
    () => ({ scrollerRef, activeIndex, reportInView, registerSection }),
    [activeIndex, reportInView, registerSection],
  )

  return (
    <MotionConfig reducedMotion="user">
      <PresentationContext value={value}>
        <div className="relative isolate min-h-0 flex-1 [container-type:size]">
          <div
            ref={scrollerRef}
            aria-label={label}
            className={cn(
              'absolute inset-0 overflow-y-auto overscroll-contain',
              'snap-y snap-mandatory motion-safe:scroll-smooth [container-type:size]',
              '[--pin-h:30cqh] lg:[--pin-h:0px] scroll-pt-(--pin-h) [--stage-inset-b:3.5rem]',
              '[--presentation-ground:oklch(0.2_0.028_257)] [--presentation-accent:oklch(0.8_0.12_259.8)]',
              'bg-(--presentation-ground) text-white',
              'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset',
              className,
            )}
            data-step-root
            role="region"
            tabIndex={0}
          >
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(16rem,38%)_1fr]">
              {aside}
              <div>{children}</div>
            </div>
          </div>
        </div>
      </PresentationContext>
    </MotionConfig>
  )
}
```

The `[--stage-inset-b:3.5rem]` on the scroller is a bridge: it keeps the current footer clearance until Task 8 publishes the variable from the view root and removes this declaration.

- [ ] **Step 4: Rename the variable in its four consumers**

Replace every `var(--pres-chrome-b)` with `var(--stage-inset-b)`:

- `pinned-column.tsx:27`: `lg:pb-[max(5cqh,var(--pres-chrome-b))]` → `lg:pb-[max(5cqh,var(--stage-inset-b))]`
- `hook-section.tsx:21`: `bottom-[max(8cqh,var(--pres-chrome-b))]` → `bottom-[max(8cqh,var(--stage-inset-b))]` and `lg:bottom-[max(6cqh,var(--pres-chrome-b))]` → `lg:bottom-[max(6cqh,var(--stage-inset-b))]`
- `point-section.tsx:26`: `bottom-[max(6cqh,var(--pres-chrome-b))]` → `bottom-[max(6cqh,var(--stage-inset-b))]`
- `credentials-section.tsx:68`: `bottom-[max(5cqh,var(--pres-chrome-b))]` → `bottom-[max(5cqh,var(--stage-inset-b))]`

Then confirm nothing else references the old name:

```bash
grep -rn "pres-chrome-b" src/
```

Expected: no output.

- [ ] **Step 5: Forward the ref from the step**

Replace the props and signature in `src/features/meeting-flow/ui/components/steps/who-we-are/index.tsx`:

```tsx
import type { PresentationHandle } from '@/features/meeting-flow/types'
import type { Ref } from 'react'
```

```tsx
interface WhoWeAreStepProps {
  /** Advances the meeting flow to the Specialties step. */
  onContinue: () => void
  /** Beat navigation for the shell's key map; forwarded to the presentation. */
  ref?: Ref<PresentationHandle>
}

/**
 * Step 1 of the meeting flow as a snapping scroll presentation of the
 * due-diligence story (docs/sales/due-diligence-story.md).
 */
export function WhoWeAreStep({ onContinue, ref }: WhoWeAreStepProps) {
  return (
    <SnapPresentation ref={ref} aside={<PinnedColumn summaries={WHO_WE_ARE_PINNED} />} label="Who we are presentation">
```

The rest of the file is unchanged.

- [ ] **Step 6: Verify**

```bash
pnpm tsc
pnpm exec eslint --fix src/features/meeting-flow/contexts/presentation-context.tsx src/features/meeting-flow/ui/components/presentation src/features/meeting-flow/ui/components/steps/who-we-are
pnpm exec eslint src/features/meeting-flow/contexts/presentation-context.tsx src/features/meeting-flow/ui/components/presentation src/features/meeting-flow/ui/components/steps/who-we-are
```

Expected: exit 0. Then open the dev meeting at `?step=1` at 1440×900 and evaluate:

```js
(() => new Promise((resolve) => {
  const scroller = document.querySelector('[data-step-root]')
  const sections = [...scroller.querySelectorAll('section')]
  scroller.scrollBy({ top: scroller.clientHeight / 3 })
  setTimeout(() => resolve(JSON.stringify({
    hasStepRoot: !!scroller && scroller.getAttribute('role') === 'region',
    scrollTop: Math.round(scroller.scrollTop),
    sectionTops: sections.slice(0, 3).map(s => s.offsetTop),
    chromeB: getComputedStyle(scroller).getPropertyValue('--stage-inset-b').trim(),
  })), 1200)
}))()
```

Expected: `hasStepRoot` true, `scrollTop` equals one of `sectionTops` (snap still holds), `chromeB` is `3.5rem`. The rendered presentation is visually identical to before this task.

- [ ] **Step 7: Commit (only if commits are confirmed)**

```bash
git add src/features/meeting-flow/contexts/presentation-context.tsx src/features/meeting-flow/ui/components/presentation/snap-section.tsx src/features/meeting-flow/ui/components/presentation/snap-presentation.tsx src/features/meeting-flow/ui/components/presentation/pinned-column.tsx src/features/meeting-flow/ui/components/steps/who-we-are/hook-section.tsx src/features/meeting-flow/ui/components/steps/who-we-are/point-section.tsx src/features/meeting-flow/ui/components/steps/who-we-are/credentials-section.tsx src/features/meeting-flow/ui/components/steps/who-we-are/index.tsx
git commit -m "feat(meeting-flow): presentation exposes next/prev and a focusable step root; stage inset variable

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The two hooks — keyboard owner and present mode

**Files:**
- Create: `src/features/meeting-flow/hooks/use-meeting-flow-keys.ts`
- Create: `src/features/meeting-flow/hooks/use-present-mode.ts`

**Interfaces:**
- Consumes: `TOTAL_STEPS` (`constants/step-config.ts`); `TYPING_TARGET_SELECTOR`, `REPEATABLE_KEYS`, `ARROW_KEYS` (Task 1); `PresentationHandle` (Task 1); `useSidebar` from `@/shared/components/ui/sidebar` (returns `{ open, setOpen, isMobile, ... }`).
- Produces: `useMeetingFlowKeys(args: UseMeetingFlowKeysArgs): void` and `usePresentMode(): { presenting: boolean, toggle: () => void, exit: () => void }`.

- [ ] **Step 1: The keyboard owner**

Create `src/features/meeting-flow/hooks/use-meeting-flow-keys.ts`:

```ts
'use client'

import type { PresentationHandle } from '@/features/meeting-flow/types'
import type { RefObject } from 'react'
import { useEffect } from 'react'
import { ARROW_KEYS, REPEATABLE_KEYS, TYPING_TARGET_SELECTOR } from '@/features/meeting-flow/constants/keyboard-hints'
import { TOTAL_STEPS } from '@/features/meeting-flow/constants/step-config'

interface UseMeetingFlowKeysArgs {
  /** The flow root: top bar, stage, rail and panel. Radix layers are portaled outside it. */
  rootRef: RefObject<HTMLElement | null>
  step: number
  setStep: (step: number) => void
  presenting: boolean
  togglePresent: () => void
  panelOpen: boolean
  closePanel: () => void
  /** `current` is null on page steps; arrows then fall through to the browser. */
  presentationRef: RefObject<PresentationHandle | null>
}

/**
 * The one keyboard owner of the meeting flow. Mount it once, in the view.
 *
 * Listens on `window` in the bubble phase, which runs after Radix's Escape handling
 * (a `document` capture listener that calls `preventDefault()` when it dismisses a
 * layer) and after React's own handlers (Next hydrates `document`). So
 * `event.defaultPrevented` means "a Radix layer, the carousel or a slider consumed
 * this key". Single printable characters are never prevented by Radix typeahead,
 * hence the target guards.
 * Sources: docs/plans/2026-09-13-meeting-flow-keyboard-focus-research.md §1–2.
 */
export function useMeetingFlowKeys({
  rootRef,
  step,
  setStep,
  presenting,
  togglePresent,
  panelOpen,
  closePanel,
  presentationRef,
}: UseMeetingFlowKeysArgs) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) {
        return
      }
      if (event.isComposing || event.keyCode === 229) {
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }
      const root = rootRef.current
      const target = event.target
      if (!root || !(target instanceof Element)) {
        return
      }
      // Focus inside a portaled Radix layer (dialog, sheet, select, menu): not ours.
      if (target !== document.body && !root.contains(target)) {
        return
      }
      if (target.closest(TYPING_TARGET_SELECTOR) || (target instanceof HTMLElement && target.isContentEditable)) {
        return
      }

      const key = event.key

      if (key === 'Escape') {
        if (panelOpen) {
          event.preventDefault()
          closePanel()
        }
        else if (presenting) {
          event.preventDefault()
          togglePresent()
        }
        return
      }
      if (event.repeat && !REPEATABLE_KEYS.has(key)) {
        return
      }
      if (event.shiftKey && ARROW_KEYS.has(key)) {
        return
      }

      switch (key) {
        case 'ArrowLeft':
          event.preventDefault()
          if (step > 1) {
            setStep(step - 1)
          }
          return
        case 'ArrowRight':
          event.preventDefault()
          if (step < TOTAL_STEPS) {
            setStep(step + 1)
          }
          return
        case 'ArrowUp':
        case 'ArrowDown': {
          const handle = presentationRef.current
          if (!handle) {
            return // page step: the browser scrolls the focused step region
          }
          event.preventDefault()
          if (key === 'ArrowDown') {
            handle.next()
          }
          else {
            handle.prev()
          }
          return
        }
        case 'a':
        case 'A':
        case 'z':
        case 'Z': {
          const handle = presentationRef.current
          if (!handle) {
            return
          }
          event.preventDefault()
          if (key === 'z' || key === 'Z') {
            handle.next()
          }
          else {
            handle.prev()
          }
          return
        }
        case 'p':
        case 'P':
          event.preventDefault()
          togglePresent()
          return
        default: {
          if (/^[1-9]$/.test(key)) {
            const n = Number(key)
            if (n <= TOTAL_STEPS) {
              event.preventDefault()
              setStep(n)
            }
          }
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [rootRef, step, setStep, presenting, togglePresent, panelOpen, closePanel, presentationRef])
}
```

- [ ] **Step 2: Present mode over the sidebar hook**

Create `src/features/meeting-flow/hooks/use-present-mode.ts`:

```ts
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSidebar } from '@/shared/components/ui/sidebar'

/**
 * Present mode: collapse the app sidebar to icons (the view hides its own top
 * bar), then put the sidebar back the way the agent had it.
 *
 * Uses the shadcn provider's own `setOpen`, which also writes the
 * `sidebar_state` cookie; a reload while presenting therefore boots with the
 * sidebar collapsed (accepted, spec §2). Below `md` the sidebar is a sheet, so
 * only the top bar changes there.
 */
export function usePresentMode() {
  const { open, setOpen, isMobile } = useSidebar()
  const [presenting, setPresenting] = useState(false)
  const rememberedOpenRef = useRef(open)
  const latestRef = useRef({ presenting, isMobile, setOpen })

  useEffect(() => {
    latestRef.current = { presenting, isMobile, setOpen }
  }, [presenting, isMobile, setOpen])

  const enter = useCallback(() => {
    rememberedOpenRef.current = open
    if (!isMobile) {
      setOpen(false)
    }
    setPresenting(true)
  }, [open, isMobile, setOpen])

  const exit = useCallback(() => {
    if (!isMobile) {
      setOpen(rememberedOpenRef.current)
    }
    setPresenting(false)
  }, [isMobile, setOpen])

  const toggle = useCallback(() => {
    if (presenting) {
      exit()
    }
    else {
      enter()
    }
  }, [presenting, enter, exit])

  // ⌘/Ctrl+B or the sidebar's own rail re-opened the sidebar: chrome returns as one unit.
  useEffect(() => {
    if (presenting && open && !isMobile) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- the sidebar changed outside this hook; mirrors use-mobile.ts
      setPresenting(false)
    }
  }, [presenting, open, isMobile])

  // Leaving the route while presenting must not leave the sidebar collapsed.
  useEffect(() => {
    return () => {
      const latest = latestRef.current
      if (latest.presenting && !latest.isMobile) {
        latest.setOpen(rememberedOpenRef.current)
      }
    }
  }, [])

  return { presenting, toggle, exit }
}
```

- [ ] **Step 3: Verify**

```bash
pnpm tsc
pnpm exec eslint --fix src/features/meeting-flow/hooks/use-meeting-flow-keys.ts src/features/meeting-flow/hooks/use-present-mode.ts
pnpm exec eslint src/features/meeting-flow/hooks/use-meeting-flow-keys.ts src/features/meeting-flow/hooks/use-present-mode.ts
```

Expected: exit 0 (the hooks are not mounted until Task 8; behaviour is verified there and in Task 9). If eslint reports `react-hooks-extra/no-direct-set-state-in-use-effect` on the guarded `setPresenting(false)` despite the disable comment, move the comment to the line directly above the call and re-run.

- [ ] **Step 4: Commit (only if commits are confirmed)**

```bash
git add src/features/meeting-flow/hooks/use-meeting-flow-keys.ts src/features/meeting-flow/hooks/use-present-mode.ts
git commit -m "feat(meeting-flow): flow-level key map and present mode hooks

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Stage atoms — `StageFrame`, `StepRegion`, `StepCapsule`

**Files:**
- Create: `src/features/meeting-flow/ui/components/shell/stage-frame.tsx`
- Create: `src/features/meeting-flow/ui/components/shell/step-region.tsx`
- Create: `src/features/meeting-flow/ui/components/shell/step-capsule.tsx`

**Interfaces:**
- Consumes: `KEY_SHORTCUTS`, `SHELL_COPY` (Task 1); `TOTAL_STEPS`; shadcn `Button`, `Separator`.
- Produces: `StageFrame({ ref?, children })` — the `data-stage` root publishing `--stage-inset-b: 5rem`; `StepRegion({ labelledBy, children, className? })` — the page-step scroller marked `data-step-root`; `StepCapsule({ currentStep, stepTitle, tone, presenting, onPrev, onNext, onTogglePresent })`.

- [ ] **Step 1: The stage frame**

Create `src/features/meeting-flow/ui/components/shell/stage-frame.tsx`:

```tsx
'use client'

import type { ReactNode, Ref } from 'react'

interface StageFrameProps {
  ref?: Ref<HTMLDivElement>
  children: ReactNode
}

/**
 * The meeting-flow root. `data-stage` opts the route out of the dashboard
 * template's padding and hides the mobile nav (app-shell.md,
 * `stage-routes-opt-out-with-data-stage`). `--stage-inset-b` is the strip the
 * floating capsule covers: capsule 48px + 16px offset + 16px breathing.
 */
export function StageFrame({ ref, children }: StageFrameProps) {
  return (
    <div ref={ref} className="relative flex h-full min-w-0 flex-col [--stage-inset-b:5rem]" data-stage>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: The page-step region**

Create `src/features/meeting-flow/ui/components/shell/step-region.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

interface StepRegionProps {
  /** id of the visually hidden step heading rendered inside. */
  labelledBy: string
  children: ReactNode
  className?: string
}

/**
 * The page-step scroller and step root. `tabIndex={-1}` lets the view focus it
 * after a step change (with `preventScroll`), after which native ↑/↓/PageDown
 * scroll it and the flow's key map sees focus inside the stage. It restores the
 * gutters the dashboard template gives every other route and clears the floating
 * capsule with `--stage-inset-b`.
 */
export function StepRegion({ labelledBy, children, className }: StepRegionProps) {
  return (
    <div
      aria-labelledby={labelledBy}
      className={cn(
        'absolute inset-0 overflow-y-auto overscroll-contain px-4 pt-6 pb-(--stage-inset-b) md:px-6',
        'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset',
        className,
      )}
      data-step-root
      role="region"
      tabIndex={-1}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 3: The capsule**

Create `src/features/meeting-flow/ui/components/shell/step-capsule.tsx`:

```tsx
'use client'

import type { MeetingStepLayout } from '@/features/meeting-flow/types'
import { ArrowLeftIcon, ArrowRightIcon, MinimizeIcon, PresentationIcon } from 'lucide-react'
import { KEY_SHORTCUTS } from '@/features/meeting-flow/constants/keyboard-hints'
import { SHELL_COPY } from '@/features/meeting-flow/constants/shell-copy'
import { TOTAL_STEPS } from '@/features/meeting-flow/constants/step-config'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { cn } from '@/shared/lib/utils'

interface StepCapsuleProps {
  currentStep: number
  stepTitle: string
  /** Dark glass over the presentation ground, light glass over page steps. */
  tone: MeetingStepLayout
  presenting: boolean
  onPrev: () => void
  onNext: () => void
  onTogglePresent: () => void
}

/**
 * Floating Previous / counter / Next / Present control, centred at the bottom of
 * the stage. Always visible; no idle fade (spec §2). The visually hidden live
 * region announces the step after each change.
 */
export function StepCapsule({ currentStep, stepTitle, tone, presenting, onPrev, onNext, onTogglePresent }: StepCapsuleProps) {
  const presentLabel = presenting ? SHELL_COPY.exitPresent : SHELL_COPY.present

  return (
    <div
      className={cn(
        'absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-10 flex h-12 -translate-x-1/2 items-center gap-0.5 rounded-full border p-0.5 shadow-lg backdrop-blur-md',
        tone === 'presentation'
          ? 'border-white/15 bg-(--presentation-ground)/70 text-white'
          : 'border-border bg-background/80 text-foreground',
      )}
    >
      <Button
        aria-keyshortcuts={KEY_SHORTCUTS.prevStep}
        className="size-11 rounded-full"
        disabled={currentStep === 1}
        size="icon"
        title={SHELL_COPY.prevStep}
        variant="ghost"
        onClick={onPrev}
      >
        <ArrowLeftIcon className="size-5" />
        <span className="sr-only">{SHELL_COPY.prevStep}</span>
      </Button>

      <span className="min-w-[3.25rem] text-center text-xs font-semibold tabular-nums">
        {`${currentStep} / ${TOTAL_STEPS}`}
      </span>
      <span aria-atomic="true" aria-live="polite" className="sr-only">
        {`Step ${currentStep} of ${TOTAL_STEPS}: ${stepTitle}`}
      </span>

      <Button
        aria-keyshortcuts={KEY_SHORTCUTS.nextStep}
        className="size-11 rounded-full"
        disabled={currentStep === TOTAL_STEPS}
        size="icon"
        title={SHELL_COPY.nextStep}
        variant="ghost"
        onClick={onNext}
      >
        <ArrowRightIcon className="size-5" />
        <span className="sr-only">{SHELL_COPY.nextStep}</span>
      </Button>

      <Separator className="mx-0.5 data-[orientation=vertical]:h-6" orientation="vertical" />

      <Button
        aria-keyshortcuts={KEY_SHORTCUTS.present}
        aria-pressed={presenting}
        className="size-11 rounded-full"
        size="icon"
        title={presentLabel}
        variant="ghost"
        onClick={onTogglePresent}
      >
        {presenting ? <MinimizeIcon className="size-5" /> : <PresentationIcon className="size-5" />}
        <span className="sr-only">{presentLabel}</span>
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: Verify**

```bash
pnpm tsc
pnpm exec eslint --fix src/features/meeting-flow/ui/components/shell
pnpm exec eslint src/features/meeting-flow/ui/components/shell
```

Expected: exit 0. These components are not mounted until Task 8.

- [ ] **Step 5: Commit (only if commits are confirmed)**

```bash
git add src/features/meeting-flow/ui/components/shell/stage-frame.tsx src/features/meeting-flow/ui/components/shell/step-region.tsx src/features/meeting-flow/ui/components/shell/step-capsule.tsx
git commit -m "feat(meeting-flow): stage frame, step region and floating step capsule

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Top bar — `StepTabs`, `CustomerChip`, `TopBar`

**Files:**
- Create: `src/features/meeting-flow/ui/components/shell/step-tabs.tsx`
- Create: `src/features/meeting-flow/ui/components/shell/customer-chip.tsx`
- Create: `src/features/meeting-flow/ui/components/shell/top-bar.tsx`

**Interfaces:**
- Consumes: `MEETING_STEPS`; `SHELL_COPY`, `PANEL_ID` (Task 1); `SyncStatusIndicator` (existing); `Logo` (`@/shared/components/logo`); `CustomerProfileModal` (`@/shared/entities/customers/components/profile/customer-profile-modal`, props `{ customerId, defaultTab?, highlightMeetingId? }`); `useModalStore` (`@/shared/hooks/use-modal-store`, `{ open, setModal }`); `getInitials(name: string)` (`@/shared/entities/users/lib/get-initials`); `formatCustomerAddress(parts)` (`@/shared/lib/formatters`, returns `{ hasAddress, line1, line2, singleLine }`); `CustomerWithProfile` type.
- Produces: `StepTabs({ currentStep, onStepClick })`; `CustomerChip({ customer, meetingId })`; `TopBar({ customer, meetingId, currentStep, onStepClick, syncStatus, panelOpen, onTogglePanel })`.

- [ ] **Step 1: Step tabs**

Create `src/features/meeting-flow/ui/components/shell/step-tabs.tsx`:

```tsx
'use client'

import { SHELL_COPY } from '@/features/meeting-flow/constants/shell-copy'
import { MEETING_STEPS } from '@/features/meeting-flow/constants/step-config'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface StepTabsProps {
  currentStep: number
  onStepClick: (step: number) => void
}

/**
 * Step tabs for the top bar. The short label shows only while the top bar's
 * container (`@container/topbar`) is at least 81.25rem (1300px) wide; below that
 * the numbered roundel carries the tab and the title is its tooltip and name.
 * The active tab is the top bar's one primary-colour moment.
 */
export function StepTabs({ currentStep, onStepClick }: StepTabsProps) {
  return (
    <nav aria-label={SHELL_COPY.stepsNavLabel} className="flex items-center gap-0.5">
      {MEETING_STEPS.map((step) => {
        const isActive = step.stepNumber === currentStep
        const isDone = step.stepNumber < currentStep

        return (
          <Button
            key={step.id}
            aria-current={isActive ? 'step' : undefined}
            aria-keyshortcuts={String(step.stepNumber)}
            aria-label={step.title}
            className={cn(
              'h-11 gap-2 rounded-md px-2 text-xs font-semibold motion-safe:transition-colors',
              isActive && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
              isDone && 'text-foreground hover:bg-muted hover:text-foreground',
              !isActive && !isDone && 'text-muted-foreground/70 hover:bg-muted hover:text-foreground',
            )}
            size="sm"
            title={step.title}
            variant="ghost"
            onClick={() => onStepClick(step.stepNumber)}
          >
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums',
                isActive && 'bg-primary text-primary-foreground',
                isDone && 'bg-foreground/10 text-foreground',
                !isActive && !isDone && 'bg-muted text-muted-foreground',
              )}
            >
              {step.stepNumber}
            </span>
            <span className="hidden @[81.25rem]/topbar:inline">{step.shortLabel}</span>
          </Button>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 2: Customer chip**

Create `src/features/meeting-flow/ui/components/shell/customer-chip.tsx`:

```tsx
'use client'

import type { CustomerWithProfile } from '@/shared/entities/customers/dal/server/queries'
import { SHELL_COPY } from '@/features/meeting-flow/constants/shell-copy'
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar'
import { Button } from '@/shared/components/ui/button'
import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { getInitials } from '@/shared/entities/users/lib/get-initials'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { formatCustomerAddress } from '@/shared/lib/formatters'

interface CustomerChipProps {
  customer: Pick<CustomerWithProfile, 'id' | 'name' | 'address' | 'city' | 'state' | 'zip'> | null
  meetingId: string
}

/**
 * The customer's identity in the top bar. One click opens the customer profile
 * modal; there are no contact actions here because the screen faces the homeowner.
 */
export function CustomerChip({ customer, meetingId }: CustomerChipProps) {
  const { open, setModal } = useModalStore()

  if (!customer) {
    return (
      <Button className="h-11 rounded-full px-3 text-muted-foreground" disabled size="sm" variant="ghost">
        {SHELL_COPY.noCustomer}
      </Button>
    )
  }

  const customerId = customer.id
  const address = formatCustomerAddress(customer)

  function handleClick() {
    setModal({
      accessor: 'CustomerProfile',
      Component: CustomerProfileModal,
      props: { customerId, highlightMeetingId: meetingId },
    })
    open()
  }

  return (
    <Button
      className="h-11 min-w-0 max-w-full gap-2 rounded-full pl-1.5 pr-3 hover:bg-muted hover:text-foreground"
      size="sm"
      title={SHELL_COPY.viewCustomerProfile}
      variant="ghost"
      onClick={handleClick}
    >
      <Avatar className="size-7">
        <AvatarFallback className="bg-primary/10 text-[11px] font-bold text-primary">
          {getInitials(customer.name)}
        </AvatarFallback>
      </Avatar>
      <span className="hidden min-w-0 text-left leading-tight md:grid">
        <span className="truncate text-[13px] font-semibold">{customer.name}</span>
        {address.hasAddress && (
          <span className="truncate text-[11px] font-normal text-muted-foreground">{address.singleLine}</span>
        )}
      </span>
      <span className="sr-only md:hidden">{customer.name}</span>
    </Button>
  )
}
```

- [ ] **Step 3: Top bar**

Create `src/features/meeting-flow/ui/components/shell/top-bar.tsx`:

```tsx
'use client'

import type { CustomerWithProfile } from '@/shared/entities/customers/dal/server/queries'
import { ArrowLeftIcon, MenuIcon, XIcon } from 'lucide-react'
import Link from 'next/link'
import { PANEL_ID } from '@/features/meeting-flow/constants/shell'
import { SHELL_COPY } from '@/features/meeting-flow/constants/shell-copy'
import { CustomerChip } from '@/features/meeting-flow/ui/components/shell/customer-chip'
import { StepTabs } from '@/features/meeting-flow/ui/components/shell/step-tabs'
import { SyncStatusIndicator } from '@/features/meeting-flow/ui/components/sync-status-indicator'
import { Logo } from '@/shared/components/logo'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'

interface TopBarProps {
  customer: Pick<CustomerWithProfile, 'id' | 'name' | 'address' | 'city' | 'state' | 'zip'> | null
  meetingId: string
  currentStep: number
  onStepClick: (step: number) => void
  syncStatus: string
  panelOpen: boolean
  onTogglePanel: () => void
}

/**
 * Three-column top bar: back link + customer | step tabs | sync + logo + hamburger.
 * The outer columns are `min-w-0 overflow-hidden`, so nothing collides at 1024px;
 * the centre column takes its natural width. `@container/topbar` drives the tab labels.
 */
export function TopBar({ customer, meetingId, currentStep, onStepClick, syncStatus, panelOpen, onTogglePanel }: TopBarProps) {
  const panelLabel = panelOpen ? SHELL_COPY.closePanel : SHELL_COPY.openPanel

  return (
    <header className="@container/topbar grid h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-border/40 px-3 md:px-4">
      <div className="flex min-w-0 items-center gap-1 overflow-hidden">
        <Button
          asChild
          className="size-11 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground md:w-auto md:px-3"
          size="icon"
          variant="ghost"
        >
          <Link href={ROOTS.dashboard.meetings.root()} title={SHELL_COPY.backToMeetings}>
            <ArrowLeftIcon className="size-5" />
            <span className="hidden md:inline">{SHELL_COPY.backToMeetings}</span>
          </Link>
        </Button>
        <CustomerChip customer={customer} meetingId={meetingId} />
      </div>

      <StepTabs currentStep={currentStep} onStepClick={onStepClick} />

      <div className="flex min-w-0 items-center justify-end gap-2 overflow-hidden">
        <SyncStatusIndicator status={syncStatus} />
        <div className="hidden h-8 w-28 shrink-0 sm:block">
          <Logo variant="right" />
        </div>
        <Button
          aria-controls={PANEL_ID}
          aria-expanded={panelOpen}
          className="size-11 shrink-0"
          size="icon"
          title={panelLabel}
          variant="ghost"
          onClick={onTogglePanel}
        >
          {panelOpen ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
          <span className="sr-only">{panelLabel}</span>
        </Button>
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Verify**

```bash
pnpm tsc
pnpm exec eslint --fix src/features/meeting-flow/ui/components/shell
pnpm exec eslint src/features/meeting-flow/ui/components/shell
```

Expected: exit 0. If `tsc` rejects `props: { customerId, highlightMeetingId: meetingId }` because the modal store types `props` against the component, keep `customerId` and drop `highlightMeetingId` (it is a nicety, not a requirement) and note it in the report.

- [ ] **Step 5: Commit (only if commits are confirmed)**

```bash
git add src/features/meeting-flow/ui/components/shell/step-tabs.tsx src/features/meeting-flow/ui/components/shell/customer-chip.tsx src/features/meeting-flow/ui/components/shell/top-bar.tsx
git commit -m "feat(meeting-flow): top bar with customer chip, step tabs and panel toggle

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Panel bodies — context, persona, meeting section

**Files:**
- Modify: `src/features/meeting-flow/ui/components/context-panel.tsx` (imports, props, return)
- Modify: `src/features/meeting-flow/ui/components/persona-profile-panel.tsx` (imports, props, the `PersonaProfilePanel` function)
- Create: `src/features/meeting-flow/ui/components/shell/meeting-section.tsx`

**Interfaces:**
- Consumes: `MEETING_FLOW_KEY_HINTS`, `SHELL_COPY` (Task 1); `formatMeetingShortStamp` (`@/shared/lib/formatters`); `MEETING_OUTCOME_LABELS` (`@/shared/entities/meetings/constants/status-colors`); `canRescheduleFromOutcome`, `CANNOT_RESCHEDULE_REASON` (`@/shared/constants/enums/meetings`); `ROOTS.dashboard.scheduleWithMeetingHighlight(meetingId, scheduledFor)`; `Meeting` type (`@/shared/db/schema`).
- Produces: `ContextPanel({ customer, meeting, onContextChange, onCustomerProfileChange, onOutcomeChange, onAgentNotesChange })` (no `isOpen`, no `onOpenChange`); `PersonaProfilePanel({ meetingId })` (mount it only while its section is open); `MeetingSection({ meeting, onReschedule })`.

- [ ] **Step 1: Context panel becomes a body**

In `src/features/meeting-flow/ui/components/context-panel.tsx`:

Remove the line `import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/components/ui/sheet'`.

Change the props interface and signature to:

```tsx
interface ContextPanelProps {
  customer: CustomerWithProfile | null
  meeting: Meeting
  onContextChange: (patch: Record<string, unknown>) => void
  onCustomerProfileChange: (patch: Record<string, unknown>) => void
  onOutcomeChange: (outcome: string) => void
  onAgentNotesChange: (notes: string) => void
}

/** The six context sections. Rendered inside the shell's inspector panel. */
export function ContextPanel({
  customer,
  meeting,
  onContextChange,
  onCustomerProfileChange,
  onOutcomeChange,
  onAgentNotesChange,
}: ContextPanelProps) {
```

Replace the `return ( <Sheet …> … </Sheet> )` block so that only the section list remains:

```tsx
  return (
    <div className="flex flex-col gap-1">
      {/* Section 1 — Situational */}
      <ContextPanelSection
        fields={SITUATIONAL_FIELDS}
        title="Situational"
        values={situationalValues}
        onFieldChange={(id, value) => {
          if (id === 'agentNotes') {
            handleAgentNotesChange(id, value)
          }
          else {
            handlePreMeetingChange(id, value)
          }
        }}
      />

      {/* Section 2 — Customer Profile */}
      <ContextPanelSection
        defaultOpen={false}
        fields={CUSTOMER_PROFILE_FIELDS}
        title="Customer Profile"
        values={customerRow}
        onFieldChange={handleCustomerProfileChange}
      />

      {/* Section 3 — Property */}
      <ContextPanelSection
        defaultOpen={false}
        fields={PROPERTY_PROFILE_FIELDS}
        title="Property"
        values={customerRow}
        onFieldChange={handleCustomerProfileChange}
      />

      {/* Section 4 — Financial */}
      <ContextPanelSection
        defaultOpen={false}
        fields={FINANCIAL_PROFILE_FIELDS}
        title="Financial"
        values={customerRow}
        onFieldChange={handleCustomerProfileChange}
      />

      {/* Section 5 — Agent Observations */}
      <ContextPanelSection
        defaultOpen={false}
        fields={OBSERVATION_FIELDS}
        title="Agent Observations"
        values={observationValues}
        onFieldChange={handleObservationsChange}
      />

      {/* Section 6 — Outcome */}
      <ContextPanelSection
        defaultOpen={false}
        fields={OUTCOME_FIELDS}
        title="Outcome"
        values={outcomeValues}
        onFieldChange={handleOutcomeChange}
      />
    </div>
  )
```

Everything above the `return` (field definitions, handlers, value objects) stays as it is.

- [ ] **Step 2: Persona panel becomes a body**

In `src/features/meeting-flow/ui/components/persona-profile-panel.tsx`:

Remove the line `import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/components/ui/sheet'`.

Change the props interface to:

```tsx
interface PersonaProfilePanelProps {
  meetingId: string
}
```

Replace the exported function at the bottom of the file with:

```tsx
/**
 * The persona profile body. Mount it only while the Persona section is open so
 * the profile query keeps running lazily, exactly as it did behind the old Sheet.
 */
export function PersonaProfilePanel({ meetingId }: PersonaProfilePanelProps) {
  const trpc = useTRPC()

  const profileQuery = useQuery(
    trpc.meetingFlowRouter.getPersonaProfile.queryOptions({ meetingId }),
  )

  return (
    <div className="-mx-4">
      {profileQuery.isLoading && (
        <LoadingState description="Analyzing customer data..." title="Building profile" />
      )}

      {profileQuery.data && <ProfileContent profile={profileQuery.data} />}

      {profileQuery.isError && (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Failed to load persona profile. Try again later.
        </div>
      )}
    </div>
  )
}
```

(`-mx-4` cancels the panel body's horizontal padding because `PersonaProfileSection` already pads its rows.) The list components above it are unchanged.

- [ ] **Step 3: Meeting section**

Create `src/features/meeting-flow/ui/components/shell/meeting-section.tsx`:

```tsx
'use client'

import type { MeetingOutcome } from '@/shared/constants/enums'
import type { Meeting } from '@/shared/db/schema'
import { CalendarClockIcon, CalendarSearchIcon } from 'lucide-react'
import Link from 'next/link'
import { Fragment } from 'react'
import { MEETING_FLOW_KEY_HINTS } from '@/features/meeting-flow/constants/keyboard-hints'
import { SHELL_COPY } from '@/features/meeting-flow/constants/shell-copy'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'
import { CANNOT_RESCHEDULE_REASON, canRescheduleFromOutcome } from '@/shared/constants/enums/meetings'
import { MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'
import { formatMeetingShortStamp } from '@/shared/lib/formatters'

interface MeetingSectionProps {
  meeting: Pick<Meeting, 'id' | 'scheduledFor' | 'meetingType' | 'meetingOutcome'>
  onReschedule: () => void
}

/** Panel section: when, type, outcome, the meeting actions, and the keyboard list. */
export function MeetingSection({ meeting, onReschedule }: MeetingSectionProps) {
  const outcome = (meeting.meetingOutcome ?? 'not_set') as MeetingOutcome
  const canReschedule = canRescheduleFromOutcome(outcome)

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{SHELL_COPY.when}</dt>
        <dd className="font-medium tabular-nums">{formatMeetingShortStamp(meeting.scheduledFor)}</dd>
        <dt className="text-muted-foreground">{SHELL_COPY.type}</dt>
        <dd className="font-medium">{meeting.meetingType}</dd>
        <dt className="text-muted-foreground">{SHELL_COPY.outcome}</dt>
        <dd>
          <Badge variant="outline">{MEETING_OUTCOME_LABELS[outcome]}</Badge>
        </dd>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button
          className="h-11 gap-2"
          disabled={!canReschedule}
          title={canReschedule ? undefined : CANNOT_RESCHEDULE_REASON}
          variant="outline"
          onClick={onReschedule}
        >
          <CalendarClockIcon className="size-4" />
          {SHELL_COPY.reschedule}
        </Button>
        <Button asChild className="h-11 gap-2" variant="outline">
          <Link href={ROOTS.dashboard.scheduleWithMeetingHighlight(meeting.id, meeting.scheduledFor)}>
            <CalendarSearchIcon className="size-4" />
            {SHELL_COPY.viewInSchedule}
          </Link>
        </Button>
      </div>

      <section aria-labelledby="meeting-panel-keys">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground" id="meeting-panel-keys">
          {SHELL_COPY.keyboardHeading}
        </h3>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 text-xs">
          {MEETING_FLOW_KEY_HINTS.map(hint => (
            <Fragment key={hint.label}>
              <dt className="flex gap-1">
                {hint.keys.map(key => (
                  <kbd
                    key={key}
                    className="rounded border border-border/70 bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground"
                  >
                    {key}
                  </kbd>
                ))}
              </dt>
              <dd className="text-muted-foreground">{hint.label}</dd>
            </Fragment>
          ))}
        </dl>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Verify**

```bash
pnpm tsc
pnpm exec eslint --fix src/features/meeting-flow/ui/components/context-panel.tsx src/features/meeting-flow/ui/components/persona-profile-panel.tsx src/features/meeting-flow/ui/components/shell/meeting-section.tsx
pnpm exec eslint src/features/meeting-flow/ui/components/context-panel.tsx src/features/meeting-flow/ui/components/persona-profile-panel.tsx src/features/meeting-flow/ui/components/shell/meeting-section.tsx
```

Expected: `tsc` reports errors **only** in `src/features/meeting-flow/ui/views/meeting-flow.tsx` (it still passes `isOpen` / `onOpenChange`; Task 8 rewrites it). Eslint exits 0 for the three files. If `ROOTS.dashboard.scheduleWithMeetingHighlight` rejects `meeting.scheduledFor`'s type, pass `meeting.scheduledFor ?? undefined`.

- [ ] **Step 5: Commit (only if commits are confirmed)**

```bash
git add src/features/meeting-flow/ui/components/context-panel.tsx src/features/meeting-flow/ui/components/persona-profile-panel.tsx src/features/meeting-flow/ui/components/shell/meeting-section.tsx
git commit -m "feat(meeting-flow): context and persona as panel bodies; meeting section with actions and key list

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Inspector rail and meeting panel container

**Files:**
- Create: `src/features/meeting-flow/ui/components/shell/inspector-rail.tsx`
- Create: `src/features/meeting-flow/ui/components/shell/meeting-panel.tsx`

**Interfaces:**
- Consumes: `PanelSection` (Task 1); `PANEL_ID`, `PANEL_SECTIONS` (Task 1); `PANEL_SECTION_LABELS`, `SHELL_COPY` (Task 1); shadcn `Button`, `Badge`.
- Produces: `InspectorRail({ openSection, contextFilledCount, contextTotalCount, personaHasData, onSelect })`; `MeetingPanel({ openSection, headerRef, onSelect, onClose, children })`.

- [ ] **Step 1: The rail**

Create `src/features/meeting-flow/ui/components/shell/inspector-rail.tsx`:

```tsx
'use client'

import type { PanelSection } from '@/features/meeting-flow/types'
import type { ReactNode } from 'react'
import { BrainIcon, CalendarClockIcon, ClipboardListIcon } from 'lucide-react'
import { PANEL_ID } from '@/features/meeting-flow/constants/shell'
import { PANEL_SECTION_LABELS, SHELL_COPY } from '@/features/meeting-flow/constants/shell-copy'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface InspectorRailProps {
  openSection: PanelSection | null
  contextFilledCount: number
  contextTotalCount: number
  personaHasData: boolean
  onSelect: (section: PanelSection) => void
}

/**
 * The lg+ strip on the stage's right edge: one button per panel section. Sits
 * above the panel (`z-30` over `z-20`) so the panel slides out from behind it.
 * Stays visible in present mode; the internal material is one click away.
 */
export function InspectorRail({ openSection, contextFilledCount, contextTotalCount, personaHasData, onSelect }: InspectorRailProps) {
  const items: { section: PanelSection, icon: ReactNode, badge?: ReactNode, accent?: boolean }[] = [
    { section: 'meeting', icon: <CalendarClockIcon className="size-5" /> },
    {
      section: 'context',
      icon: <ClipboardListIcon className="size-5" />,
      badge: (
        <Badge
          className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[9px] tabular-nums"
          variant={contextFilledCount > 0 ? 'secondary' : 'outline'}
        >
          {`${contextFilledCount}/${contextTotalCount}`}
        </Badge>
      ),
    },
    { section: 'persona', icon: <BrainIcon className="size-5" />, accent: personaHasData },
  ]

  return (
    <aside
      aria-label={SHELL_COPY.railLabel}
      className="z-30 hidden w-12 shrink-0 flex-col items-center gap-1 border-l border-border/40 bg-card py-2 lg:flex"
    >
      {items.map(({ section, icon, badge, accent }) => {
        const isOpen = openSection === section

        return (
          <Button
            key={section}
            aria-controls={PANEL_ID}
            aria-expanded={isOpen}
            className={cn(
              'relative size-11 hover:bg-muted hover:text-foreground motion-safe:transition-colors',
              isOpen && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
              !isOpen && accent && 'text-primary',
            )}
            size="icon"
            title={PANEL_SECTION_LABELS[section]}
            variant="ghost"
            onClick={() => onSelect(section)}
          >
            {icon}
            {badge}
            <span className="sr-only">{PANEL_SECTION_LABELS[section]}</span>
          </Button>
        )
      })}
    </aside>
  )
}
```

- [ ] **Step 2: The panel container**

Create `src/features/meeting-flow/ui/components/shell/meeting-panel.tsx`:

```tsx
'use client'

import type { PanelSection } from '@/features/meeting-flow/types'
import type { ReactNode, RefObject } from 'react'
import { XIcon } from 'lucide-react'
import { PANEL_ID, PANEL_SECTIONS } from '@/features/meeting-flow/constants/shell'
import { PANEL_SECTION_LABELS, SHELL_COPY } from '@/features/meeting-flow/constants/shell-copy'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface MeetingPanelProps {
  openSection: PanelSection | null
  /** The view focuses this header when the panel opens. */
  headerRef: RefObject<HTMLDivElement | null>
  onSelect: (section: PanelSection) => void
  onClose: () => void
  children: ReactNode
}

/**
 * The shell-owned inspector panel: fixed to the stage's right edge, slides in
 * over the stage, never a Sheet. Non-modal on purpose (no focus trap, no scroll
 * lock): the stage stays usable while it is open. Closed, it is translated out,
 * clipped by the stage row, and `inert`, so nothing inside is focusable or announced.
 * On lg+ it sits under the rail (`right-12`, `z-20` under `z-30`) and slides out
 * from behind it.
 */
export function MeetingPanel({ openSection, headerRef, onSelect, onClose, children }: MeetingPanelProps) {
  const isOpen = openSection !== null

  return (
    <aside
      aria-label={SHELL_COPY.panelLabel}
      className={cn(
        'absolute inset-y-0 right-0 z-20 grid w-full max-w-full grid-rows-[auto_minmax(0,1fr)] border-l border-border/40 bg-card shadow-lg sm:w-[380px] lg:right-12',
        'motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-[cubic-bezier(.32,.72,0,1)]',
        isOpen ? 'translate-x-0' : 'translate-x-full',
      )}
      id={PANEL_ID}
      inert={!isOpen}
    >
      <div ref={headerRef} className="flex items-center gap-1 border-b border-border/40 px-2 py-2 outline-none" tabIndex={-1}>
        <div className="flex min-w-0 flex-1 items-center gap-0.5">
          {PANEL_SECTIONS.map((section) => {
            const isCurrent = openSection === section

            return (
              <Button
                key={section}
                aria-pressed={isCurrent}
                className={cn(
                  'h-11 flex-1 text-xs font-semibold motion-safe:transition-colors',
                  isCurrent
                    ? 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                size="sm"
                variant="ghost"
                onClick={() => onSelect(section)}
              >
                {PANEL_SECTION_LABELS[section]}
              </Button>
            )
          })}
        </div>
        <Button className="size-11 shrink-0" size="icon" title={SHELL_COPY.closePanel} variant="ghost" onClick={onClose}>
          <XIcon className="size-5" />
          <span className="sr-only">{SHELL_COPY.closePanel}</span>
        </Button>
      </div>
      <div className="overflow-y-auto overscroll-contain px-4 py-3">{children}</div>
    </aside>
  )
}
```

- [ ] **Step 3: Verify**

```bash
pnpm tsc
pnpm exec eslint --fix src/features/meeting-flow/ui/components/shell/inspector-rail.tsx src/features/meeting-flow/ui/components/shell/meeting-panel.tsx
pnpm exec eslint src/features/meeting-flow/ui/components/shell/inspector-rail.tsx src/features/meeting-flow/ui/components/shell/meeting-panel.tsx
```

Expected: `tsc` still reports only the `meeting-flow.tsx` errors left by Task 6; eslint exits 0. If `tsc` rejects `inert={!isOpen}` (the installed `@types/react` predates the boolean `inert` prop), use `inert={isOpen ? undefined : true}` and note it in the report.

- [ ] **Step 4: Commit (only if commits are confirmed)**

```bash
git add src/features/meeting-flow/ui/components/shell/inspector-rail.tsx src/features/meeting-flow/ui/components/shell/meeting-panel.tsx
git commit -m "feat(meeting-flow): inspector rail and sliding meeting panel

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Compose the shell in the view, retire the old chrome

**Files:**
- Modify: `src/features/meeting-flow/ui/views/meeting-flow.tsx` (whole file)
- Modify: `src/features/meeting-flow/ui/components/presentation/snap-presentation.tsx` (remove the bridge variable)
- Delete: `src/features/meeting-flow/ui/components/step-nav.tsx`
- Delete: `src/features/meeting-flow/ui/components/context-panel-trigger.tsx`
- Delete: `src/features/meeting-flow/ui/components/persona-profile-trigger.tsx`

**Interfaces:**
- Consumes: everything produced in Tasks 1–7.
- Produces: the shipped shell. `MeetingFlowView({ meetingId })` keeps its signature.

- [ ] **Step 1: Rewrite the view**

Replace the whole of `src/features/meeting-flow/ui/views/meeting-flow.tsx` with:

```tsx
'use client'

import type { MeetingFlowContext, PanelSection, PresentationHandle } from '@/features/meeting-flow/types'
import type { MeetingOutcome } from '@/shared/constants/enums'
import type { CustomerWithProfile } from '@/shared/entities/customers/dal/server/queries'
import type { MeetingContext, MeetingFlowState } from '@/shared/entities/meetings/schemas'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ChannelProvider } from 'ably/react'
import { useQueryState } from 'nuqs'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { stepParser } from '@/features/meeting-flow/constants/query-parsers'
import { DEFAULT_PANEL_SECTION } from '@/features/meeting-flow/constants/shell'
import { MEETING_STEPS, TOTAL_STEPS } from '@/features/meeting-flow/constants/step-config'
import { useMeetingFlowKeys } from '@/features/meeting-flow/hooks/use-meeting-flow-keys'
import { useMeetingSync } from '@/features/meeting-flow/hooks/use-meeting-sync'
import { usePresentMode } from '@/features/meeting-flow/hooks/use-present-mode'
import { computeContextFilledCount, CONTEXT_TOTAL_FIELDS } from '@/features/meeting-flow/lib/context-fill-count'
import { ContextPanel } from '@/features/meeting-flow/ui/components/context-panel'
import { PersonaProfilePanel } from '@/features/meeting-flow/ui/components/persona-profile-panel'
import { InspectorRail } from '@/features/meeting-flow/ui/components/shell/inspector-rail'
import { MeetingPanel } from '@/features/meeting-flow/ui/components/shell/meeting-panel'
import { MeetingSection } from '@/features/meeting-flow/ui/components/shell/meeting-section'
import { StageFrame } from '@/features/meeting-flow/ui/components/shell/stage-frame'
import { StepCapsule } from '@/features/meeting-flow/ui/components/shell/step-capsule'
import { StepRegion } from '@/features/meeting-flow/ui/components/shell/step-region'
import { TopBar } from '@/features/meeting-flow/ui/components/shell/top-bar'
import { ClosingStep } from '@/features/meeting-flow/ui/components/steps/closing-step'
import { CreateProposalStep } from '@/features/meeting-flow/ui/components/steps/create-proposal-step'
import { DealStructureStep } from '@/features/meeting-flow/ui/components/steps/deal-structure-step'
import { PortfolioStep } from '@/features/meeting-flow/ui/components/steps/portfolio-step'
import { ProgramStep } from '@/features/meeting-flow/ui/components/steps/program-step'
import { SpecialtiesStep } from '@/features/meeting-flow/ui/components/steps/specialties-step'
import { WhoWeAreStep } from '@/features/meeting-flow/ui/components/steps/who-we-are'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { hasCustomerProfileData } from '@/shared/entities/customers/lib/customer-predicates'
import { useOutcomeChange } from '@/shared/entities/meetings/hooks/use-outcome-change'
import { useRescheduleChange } from '@/shared/entities/meetings/hooks/use-reschedule-change'
import { useTRPC } from '@/trpc/helpers'

interface MeetingFlowViewProps {
  meetingId: string
}

export function MeetingFlowView({ meetingId }: MeetingFlowViewProps) {
  return (
    <ChannelProvider channelName={`meeting:${meetingId}`}>
      <MeetingFlowViewInner meetingId={meetingId} />
    </ChannelProvider>
  )
}

function MeetingFlowViewInner({ meetingId }: MeetingFlowViewProps) {
  const trpc = useTRPC()
  const { invalidateMeeting } = useInvalidation()
  const [currentStep, setCurrentStep] = useQueryState('step', stepParser)
  const { status: syncStatus } = useMeetingSync(meetingId)
  const { changeOutcome, OutcomeReasonDialog } = useOutcomeChange()
  const { reschedule, RescheduleDialog } = useRescheduleChange()
  const { presenting, toggle: togglePresentMode } = usePresentMode()
  const stepTitleId = useId()

  const rootRef = useRef<HTMLDivElement>(null)
  const panelHeaderRef = useRef<HTMLDivElement>(null)
  const presentationRef = useRef<PresentationHandle>(null)
  const lastSectionRef = useRef<PanelSection>(DEFAULT_PANEL_SECTION)
  const previousPanelRef = useRef<PanelSection | null>(null)
  const [panel, setPanel] = useState<PanelSection | null>(null)

  const meetingQuery = useQuery(
    trpc.meetingsRouter.reads.getByIdWithJoins.queryOptions({ id: meetingId }),
  )

  const invalidateMeetingQueries = useCallback(() => {
    invalidateMeeting()
  }, [invalidateMeeting])

  const updateMeeting = useMutation(
    trpc.meetingsRouter.crud.update.mutationOptions({
      onSuccess: invalidateMeetingQueries,
      onError: () => toast.error('Failed to save'),
    }),
  )

  const updateCustomerProfile = useMutation(
    trpc.meetingFlowRouter.updateCustomerProfile.mutationOptions({
      onSuccess: invalidateMeetingQueries,
      onError: () => toast.error('Failed to save customer data'),
    }),
  )

  const meeting = meetingQuery.data
  const customer = meeting?.customer?.id ? meeting.customer : null
  const isReady = Boolean(meeting)

  const handleFlowStateChange = useCallback((patch: Partial<MeetingFlowState>) => {
    const current = meeting?.flowStateJSON ?? {}
    updateMeeting.mutate({
      id: meetingId,
      data: { flowStateJSON: { ...current, ...patch } },
    })
  }, [meeting?.flowStateJSON, meetingId, updateMeeting])

  const handleCustomerProfileChange = useCallback((patch: Record<string, unknown>) => {
    if (!customer?.id) {
      return
    }
    // Flat column patch (epic #256/#259) — send only the changed field(s),
    // no read-modify-merge needed since each column IS the field.
    updateCustomerProfile.mutate({
      meetingId,
      customerId: customer.id,
      patch,
    })
  }, [customer, meetingId, updateCustomerProfile])

  const handleContextChange = useCallback((patch: Record<string, unknown>) => {
    const current = (meeting?.contextJSON ?? {}) as MeetingContext
    updateMeeting.mutate({
      id: meetingId,
      data: { contextJSON: { ...current, ...patch } as MeetingContext },
    })
  }, [meeting?.contextJSON, meetingId, updateMeeting])

  const handleOutcomeChange = useCallback((outcome: string) => {
    void changeOutcome(meetingId, outcome as MeetingOutcome)
  }, [changeOutcome, meetingId])

  const handleAgentNotesChange = useCallback((notes: string) => {
    updateMeeting.mutate({
      id: meetingId,
      data: { agentNotes: notes },
    })
  }, [meetingId, updateMeeting])

  const flowContext = useMemo<MeetingFlowContext | null>(() => {
    if (!meeting) {
      return null
    }
    return {
      meetingId,
      customerId: meeting.customerId ?? null,
      customer: customer as CustomerWithProfile | null,
      flowState: meeting.flowStateJSON ?? null,
      onFlowStateChange: handleFlowStateChange,
      onCustomerProfileChange: handleCustomerProfileChange,
    }
  }, [meeting, meetingId, customer, handleFlowStateChange, handleCustomerProfileChange])

  const contextFilledCount = useMemo(
    () => (meeting ? computeContextFilledCount(meeting, customer as CustomerWithProfile | null) : 0),
    [meeting, customer],
  )

  // ── Steps ──────────────────────────────────────────────────────────────────

  const setStep = useCallback((step: number) => {
    void setCurrentStep(step)
  }, [setCurrentStep])

  const handleNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS) {
      setStep(currentStep + 1)
    }
  }, [currentStep, setStep])

  const handlePrev = useCallback(() => {
    if (currentStep > 1) {
      setStep(currentStep - 1)
    }
  }, [currentStep, setStep])

  // ── Panel ──────────────────────────────────────────────────────────────────

  const openSection = useCallback((section: PanelSection) => {
    lastSectionRef.current = section
    setPanel(section)
  }, [])

  const closePanel = useCallback(() => {
    setPanel(null)
  }, [])

  const togglePanel = useCallback(() => {
    if (panel === null) {
      openSection(lastSectionRef.current)
    }
    else {
      closePanel()
    }
  }, [panel, openSection, closePanel])

  const selectFromRail = useCallback((section: PanelSection) => {
    if (panel === section) {
      closePanel()
    }
    else {
      openSection(section)
    }
  }, [panel, openSection, closePanel])

  // ── Present mode: entering closes the panel (the screen faces the homeowner) ─

  const togglePresent = useCallback(() => {
    if (!presenting) {
      setPanel(null)
    }
    togglePresentMode()
  }, [presenting, togglePresentMode])

  // ── Focus: the step root after every step change, the panel header on open ──

  const focusStepRoot = useCallback(() => {
    rootRef.current?.querySelector<HTMLElement>('[data-step-root]')?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    focusStepRoot()
  }, [currentStep, isReady, focusStepRoot])

  useEffect(() => {
    const wasOpen = previousPanelRef.current !== null
    const isOpen = panel !== null
    previousPanelRef.current = panel
    if (isOpen && !wasOpen) {
      panelHeaderRef.current?.focus({ preventScroll: true })
    }
    else if (!isOpen && wasOpen) {
      focusStepRoot()
    }
  }, [panel, focusStepRoot])

  useMeetingFlowKeys({
    rootRef,
    step: currentStep,
    setStep,
    presenting,
    togglePresent,
    panelOpen: panel !== null,
    closePanel,
    presentationRef,
  })

  // ── Render ─────────────────────────────────────────────────────────────────

  if (meetingQuery.isLoading) {
    return (
      <StageFrame ref={rootRef}>
        <LoadingState title="Loading meeting" description="Fetching meeting details..." />
      </StageFrame>
    )
  }

  if (!meeting || !flowContext) {
    return (
      <StageFrame ref={rootRef}>
        <ErrorState title="Meeting not found" description="This meeting could not be loaded." />
      </StageFrame>
    )
  }

  const stepConfig = MEETING_STEPS[currentStep - 1]
  if (!stepConfig) {
    return (
      <StageFrame ref={rootRef}>
        <ErrorState title="Invalid step" description="This step does not exist." />
      </StageFrame>
    )
  }

  return (
    <StageFrame ref={rootRef}>
      {!presenting && (
        <TopBar
          currentStep={currentStep}
          customer={customer}
          meetingId={meetingId}
          panelOpen={panel !== null}
          syncStatus={syncStatus}
          onStepClick={setStep}
          onTogglePanel={togglePanel}
        />
      )}

      <div className="relative isolate flex min-h-0 flex-1 overflow-hidden">
        {/* Stage: the step owns its scroller; the capsule floats over it */}
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          {stepConfig.layout === 'presentation'
            ? (
                <>
                  <h1 className="sr-only" id={stepTitleId}>{stepConfig.title}</h1>
                  {stepConfig.id === 'who-we-are' && <WhoWeAreStep ref={presentationRef} onContinue={handleNext} />}
                </>
              )
            : (
                <StepRegion labelledBy={stepTitleId}>
                  <h1 className="sr-only" id={stepTitleId}>{stepConfig.title}</h1>
                  {stepConfig.id === 'specialties' && <SpecialtiesStep flowContext={flowContext} />}
                  {stepConfig.id === 'portfolio' && <PortfolioStep flowContext={flowContext} />}
                  {stepConfig.id === 'program' && (
                    <ProgramStep flowContext={flowContext} meetingType={meeting.meetingType} />
                  )}
                  {stepConfig.id === 'deal-structure' && <DealStructureStep flowContext={flowContext} />}
                  {stepConfig.id === 'closing' && (
                    <ClosingStep
                      flowContext={flowContext}
                      meetingOutcome={meeting.meetingOutcome}
                      onOutcomeChange={handleOutcomeChange}
                      proposalState={{
                        proposalCount: meeting.proposalCount ?? 0,
                        hasSentProposal: meeting.hasSentProposal ?? false,
                        hasApprovedProposal: meeting.hasApprovedProposal ?? false,
                      }}
                    />
                  )}
                  {stepConfig.id === 'create-proposal' && (
                    <CreateProposalStep flowContext={flowContext} meetingId={meetingId} />
                  )}
                </StepRegion>
              )}

          <StepCapsule
            currentStep={currentStep}
            presenting={presenting}
            stepTitle={stepConfig.title}
            tone={stepConfig.layout}
            onNext={handleNext}
            onPrev={handlePrev}
            onTogglePresent={togglePresent}
          />
        </div>

        <MeetingPanel headerRef={panelHeaderRef} openSection={panel} onClose={closePanel} onSelect={openSection}>
          {panel === 'meeting' && (
            <MeetingSection meeting={meeting} onReschedule={() => void reschedule(meetingId)} />
          )}
          {panel === 'context' && (
            <ContextPanel
              customer={customer as CustomerWithProfile | null}
              meeting={meeting}
              onAgentNotesChange={handleAgentNotesChange}
              onContextChange={handleContextChange}
              onCustomerProfileChange={handleCustomerProfileChange}
              onOutcomeChange={handleOutcomeChange}
            />
          )}
          {panel === 'persona' && <PersonaProfilePanel meetingId={meetingId} />}
        </MeetingPanel>

        <InspectorRail
          contextFilledCount={contextFilledCount}
          contextTotalCount={CONTEXT_TOTAL_FIELDS}
          openSection={panel}
          personaHasData={hasCustomerProfileData(customer)}
          onSelect={selectFromRail}
        />
      </div>

      <OutcomeReasonDialog />
      <RescheduleDialog />
    </StageFrame>
  )
}
```

- [ ] **Step 2: Remove the bridge variable from the scroller**

In `src/features/meeting-flow/ui/components/presentation/snap-presentation.tsx`, change

```
'[--pin-h:30cqh] lg:[--pin-h:0px] scroll-pt-(--pin-h) [--stage-inset-b:3.5rem]',
```

to

```
'[--pin-h:30cqh] lg:[--pin-h:0px] scroll-pt-(--pin-h)',
```

The view root (`StageFrame`) now publishes `--stage-inset-b: 5rem`.

- [ ] **Step 3: Delete the superseded files**

```bash
git rm src/features/meeting-flow/ui/components/step-nav.tsx src/features/meeting-flow/ui/components/context-panel-trigger.tsx src/features/meeting-flow/ui/components/persona-profile-trigger.tsx
grep -rn "step-nav'\|context-panel-trigger'\|persona-profile-trigger'\|prevNextHeight" src/
```

Expected: the grep prints nothing. (`git rm` on these three paths is a pathspec operation on files this plan owns; it is the one allowed staging of a deletion.)

- [ ] **Step 4: Static verification**

```bash
pnpm tsc
pnpm exec eslint --fix src/features/meeting-flow
pnpm exec eslint src/features/meeting-flow
```

Expected: both exit 0 with no errors anywhere (the Task 6 and 7 view errors are gone).

- [ ] **Step 5: Rendered verification**

Stop the dev server, `rm -rf .next`, start `pnpm dev`, log in, open the dev meeting at `?step=2` at 1440×900. Evaluate:

```js
(() => {
  const box = el => { const b = el?.getBoundingClientRect(); return b ? [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)] : null }
  const main = document.querySelector('main[data-slot="sidebar-inset"] main')
  const stage = document.querySelector('[data-stage]')
  return JSON.stringify({
    mainPadding: getComputedStyle(main).padding,
    main: box(main),
    stage: box(stage),
    topBar: box(stage.querySelector('header')),
    stepRoot: box(document.querySelector('[data-step-root]')),
    capsule: box(document.querySelector('[aria-keyshortcuts="ArrowRight"]')?.parentElement),
    rail: box(stage.querySelector('aside[aria-label="Inspector"]')),
    panelInert: document.getElementById('meeting-panel').hasAttribute('inert'),
    focusOnStepRoot: document.activeElement?.hasAttribute('data-step-root') ?? false,
  })
})()
```

Expected: `mainPadding` is `0px`; `stage` equals `main`; `topBar` height 48 and width equal to the stage width; `stepRoot` fills the stage below the top bar minus the 48px rail; the capsule sits centred within the step root's width, 16px above its bottom; `panelInert` true; `focusOnStepRoot` true.

Then, with no click: press `ArrowRight` → the URL reads `?step=3`; press `2` → `?step=2`; press `p` → the top bar is gone and `document.querySelector('[data-slot="sidebar"]').dataset.state` is `collapsed`; press `p` → both restored. Click the hamburger → the panel's `transform` is `none` and `document.activeElement` is inside `#meeting-panel`; press `Escape` → `inert` is back and focus is on the step root. Click the rail's Context button → the Context sections render; the badge text equals `filled/total`.

Step 1 (`?step=1`): press `ArrowDown` twice, wait 1s: `[data-step-root].scrollTop` equals the third `section`'s `offsetTop` minus the computed `scroll-padding-top`; press `a`: the second's.

- [ ] **Step 6: Commit (only if commits are confirmed)**

```bash
git add src/features/meeting-flow/ui/views/meeting-flow.tsx src/features/meeting-flow/ui/components/presentation/snap-presentation.tsx
git commit -m "feat(meeting-flow): single-stage shell with top bar, inspector panel, floating capsule, present mode and one keyboard owner

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

(The three `git rm` deletions from Step 3 are already staged and land in this commit.)

---

### Task 9: Four-viewport verification, responsive fixes, design audits

**Files:**
- Create (gitignored, not committed): `.playwright-mcp/shell-verify.mjs`
- Modify (only as findings require): files created or modified in Tasks 1–8.

**Interfaces:**
- Consumes: the shipped shell from Task 8.
- Produces: `.playwright-mcp/shell-after.json` and `.playwright-mcp/shell-after-<w>-<scheme>-step<n>.png`, a punch list applied in place, or listed as follow-ups in the final report.

- [ ] **Step 1: Write and run the verification script**

Stop the dev server, `rm -rf .next`, start `pnpm dev`. Create `.playwright-mcp/shell-verify.mjs`:

```js
import fs from 'node:fs'
import { chromium } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/node_modules/playwright/index.mjs'

const ROOT = '/home/olis-solutions/olis-v3/nextjs/tri-pros-website'
const BASE = 'http://localhost:3000'
const MEETING = '2069fa85-0357-4550-8eb5-6ae40eacf5a9'
const OUT = `${ROOT}/.playwright-mcp`
const VIEWPORTS = [[1440, 900], [1024, 768], [820, 1180], [390, 844]]
const secret = fs.readFileSync(`${ROOT}/.env.local`, 'utf8').match(/^DEV_LOGIN_SECRET=(.*)$/m)[1].trim()

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const results = {}
const stepOf = () => new URL(page.url()).searchParams.get('step') ?? '1'
const wait = ms => page.waitForTimeout(ms)
const sidebarState = () => page.evaluate(() => ({
  sidebar: document.querySelector('[data-slot="sidebar"]')?.getAttribute('data-state') ?? 'absent',
  cookie: document.cookie.match(/sidebar_state=(\w+)/)?.[1] ?? null,
  topBar: !!document.querySelector('[data-stage] header'),
}))
const snapProbe = () => page.evaluate(() => {
  const s = document.querySelector('[data-step-root]')
  const secs = [...s.querySelectorAll('section')]
  const pad = Number.parseFloat(getComputedStyle(s).scrollPaddingTop) || 0
  return { scrollTop: Math.round(s.scrollTop), snaps: secs.slice(0, 4).map(x => Math.round(x.offsetTop - pad)) }
})

await page.goto(`${BASE}/api/dev/playwright-session?secret=${secret}&redirect=/dashboard/meetings/${MEETING}?step=1`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('[data-stage]')

for (const [w, h] of VIEWPORTS) {
  const r = (results[`${w}x${h}`] = {})
  await page.setViewportSize({ width: w, height: h })
  await page.goto(`${BASE}/dashboard/meetings/${MEETING}?step=1`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-step-root]')

  r.layout = await page.evaluate(() => {
    const box = el => { const b = el?.getBoundingClientRect(); return b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null }
    const main = document.querySelector('main[data-slot="sidebar-inset"] main')
    const stage = document.querySelector('[data-stage]')
    const nav = document.querySelector('[data-slot="dashboard-mobile-nav"]')
    const small = [...stage.querySelectorAll('button, a')]
      .filter(el => { const b = el.getBoundingClientRect(); return b.width > 0 && (b.width < 44 || b.height < 44) })
      .map(el => el.getAttribute('title') || el.textContent.trim().slice(0, 24))
    return {
      mainPadding: getComputedStyle(main).padding,
      main: box(main),
      stage: box(stage),
      topBar: box(stage.querySelector('header')),
      mobileNav: nav ? getComputedStyle(nav).display : 'absent',
      hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth || stage.scrollWidth > stage.clientWidth,
      smallTargets: small,
    }
  })

  // Keys from a fresh load, no click.
  await page.keyboard.press('ArrowRight'); await wait(200)
  await page.keyboard.press('ArrowRight'); await wait(200)
  r.afterRightRight = stepOf()
  await page.keyboard.press('ArrowLeft'); await wait(200)
  r.afterLeft = stepOf()
  r.focusOnStepRoot = await page.evaluate(() => document.activeElement?.hasAttribute('data-step-root') ?? false)
  await page.keyboard.press('5'); await wait(200)
  r.afterDigit5 = stepOf()
  await page.keyboard.press('9'); await wait(200)
  r.afterDigit9 = stepOf()
  await page.keyboard.press('2'); await wait(400)
  const pageScrollBefore = await page.evaluate(() => document.querySelector('[data-step-root]').scrollTop)
  await page.keyboard.press('ArrowDown'); await wait(400)
  r.pageStepArrowDown = { stepStill: stepOf(), scrolled: await page.evaluate(() => document.querySelector('[data-step-root]').scrollTop) > pageScrollBefore }
  await page.keyboard.press('1'); await wait(600)
  await page.keyboard.press('ArrowDown'); await wait(900)
  await page.keyboard.press('ArrowDown'); await wait(900)
  r.presentationAfterDownDown = await snapProbe()
  await page.keyboard.press('a'); await wait(900)
  r.presentationAfterA = await snapProbe()

  // Present mode and its restore.
  const before = await sidebarState()
  await page.keyboard.press('p'); await wait(500)
  r.presenting = await sidebarState()
  // A Radix layer eats Escape first.
  const doc = page.getByRole('button', { name: /Open Contractor license/i })
  if (await doc.count()) {
    await doc.first().click(); await wait(500)
    await page.keyboard.press('Escape'); await wait(500)
    r.escapeLayerFirst = { dialogOpen: await page.locator('[role="dialog"][data-state="open"]').count() > 0, ...(await sidebarState()) }
  }
  await page.keyboard.press('Escape'); await wait(500)
  r.presentRestore = { before, after: await sidebarState() }

  // Panel: open, z-order, focus, Escape, typing guard.
  await page.click(`[aria-controls="meeting-panel"]`); await wait(500)
  r.panelOpen = await page.evaluate(() => {
    const p = document.getElementById('meeting-panel')
    const rail = document.querySelector('[data-stage] aside[aria-label="Inspector"]')
    return { transform: getComputedStyle(p).transform, inert: p.hasAttribute('inert'), focusInside: p.contains(document.activeElement), panelZ: getComputedStyle(p).zIndex, railZ: rail ? getComputedStyle(rail).zIndex : 'no-rail', width: Math.round(p.getBoundingClientRect().width) }
  })
  await page.click('#meeting-panel button:has-text("Context")'); await wait(400)
  const textarea = page.locator('#meeting-panel textarea').first()
  if (await textarea.count()) {
    await textarea.focus()
    const stepBefore = stepOf()
    await page.keyboard.press('ArrowRight'); await wait(200)
    r.typingGuard = { before: stepBefore, after: stepOf() }
  }
  await page.click('#meeting-panel button[title="Close meeting panel"]'); await wait(500)
  r.panelClosed = await page.evaluate(() => ({ inert: document.getElementById('meeting-panel').hasAttribute('inert'), focusOnStepRoot: document.activeElement?.hasAttribute('data-step-root') ?? false }))

  // Screenshots, both schemes, three steps.
  await page.evaluate(() => localStorage.removeItem('theme'))
  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme })
    for (const step of [1, 2, 4]) {
      await page.goto(`${BASE}/dashboard/meetings/${MEETING}?step=${step}`, { waitUntil: 'networkidle' }); await wait(600)
      await page.screenshot({ path: `${OUT}/shell-after-${w}-${scheme}-step${step}.png` })
    }
  }
  await page.emulateMedia({ colorScheme: null })
}

await browser.close()
fs.writeFileSync(`${OUT}/shell-after.json`, JSON.stringify(results, null, 2))
console.log(JSON.stringify(results, null, 2))
```

Run `node .playwright-mcp/shell-verify.mjs` and read the JSON before the pictures. Expected, at every viewport unless noted:

- `layout.mainPadding` `0px`; `layout.stage` equals `layout.main`; `layout.topBar.h` 48; `layout.hscroll` false; `layout.smallTargets` empty; `layout.mobileNav` `none` at 390 (`none` via `md:hidden` elsewhere).
- `afterRightRight` `"3"`, `afterLeft` `"2"`, `focusOnStepRoot` true, `afterDigit5` `"5"`, `afterDigit9` `"5"`.
- `pageStepArrowDown.stepStill` `"2"` and `scrolled` true when the Specialties step overflows at that viewport (it may be false at 1440×900 if the page fits; then it is not a failure).
- `presentationAfterDownDown.scrollTop` equals `snaps[2]`; `presentationAfterA.scrollTop` equals `snaps[1]`.
- `presenting.topBar` false; `presenting.sidebar` `collapsed` at 1440, 1024 and 820; `absent` or unchanged at 390 (sheet sidebar).
- `escapeLayerFirst.dialogOpen` false and `escapeLayerFirst.topBar` false (still presenting after the dialog's Escape).
- `presentRestore.after.sidebar` and `.cookie` equal `presentRestore.before`'s.
- `panelOpen.transform` `none`, `inert` false, `focusInside` true, `panelZ` `20`, `railZ` `30` at 1440 and 1024 (`no-rail` below), `width` 380 at ≥ 640 and the viewport width at 390.
- `typingGuard.after` equals `typingGuard.before`.
- `panelClosed.inert` true, `panelClosed.focusOnStepRoot` true.

Then open the 24 screenshots. Compare `shell-after-1440-light-step1.png` with `shell-baseline-1440-light-step1.png`: the presentation must fill everything below the 48px top bar, edge to edge, with the capsule centred at the bottom and the rail on the right.

- [ ] **Step 2: Fix what the numbers show**

Fix each failure in the file that owns it: layout sizes in `top-bar.tsx`, `meeting-panel.tsx`, `inspector-rail.tsx`, `step-capsule.tsx`; key behaviour in `use-meeting-flow-keys.ts` and the view's focus effects; beat scrolling in `snap-presentation.tsx`; present mode in `use-present-mode.ts`. Re-run the script after each fix round; stop after the second round and list what remains as a follow-up.

- [ ] **Step 3: Design audits**

Run the two audits from `docs/ui-design-playbook.md` against the new files (the impeccable detector already ran on every edit through the hook):

1. Invoke the `ui-ux-pro-max` skill on `src/features/meeting-flow/ui/components/shell` and `src/features/meeting-flow/ui/views/meeting-flow.tsx`.
2. Invoke the `web-design-guidelines` skill on the same paths.

For each finding: fix it in the owning file, or, if it conflicts with the spec, record it in the final report with the reason. Then:

```bash
pnpm tsc
pnpm lint
```

Expected: both exit 0 (warnings in unrelated files are acceptable; errors are not).

- [ ] **Step 4: Commit (only if commits are confirmed)**

```bash
git status --porcelain src/features/meeting-flow "src/app/(frontend)" src/features/agent-dashboard docs/codebase-conventions/app-shell.md
```

Stage only the files that list from this plan's File Structure, by explicit path, then:

```bash
git commit -m "fix(meeting-flow): shell responsive and audit fixes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review against the spec

- **§1 root causes**: keyboard owner (Task 3 + Task 8 focus effect), stage share (Task 1 opt-out + Task 4 frame + Task 8), header collisions (Task 5 grid with clipping outer columns), mobile nav (Task 1 rule), `--pres-chrome-b` retired (Task 2 rename, Task 8 removes the bridge).
- **§2 decisions**: B + P1 (Tasks 4–8); present mode via `useSidebar` with no provider change (Task 3; `sidebar.tsx` is off limits); capsule always visible (Task 4); window-bubble listener with the five guards (Task 3); absolute `scrollTo` with pending index (Task 2); `data-stage` opt-out (Task 1); `motion-safe:` on every transition, `MotionConfig` untouched (Tasks 4, 5, 7); panel never in the URL and closed on present (Task 8); present toggle in the capsule (Task 4), rail has three buttons (Task 7); customer chip opens the profile modal only (Task 5); tab labels at ≥ 81.25rem (Task 5); page gutters restored in `StepRegion` (Task 4); cookie side effect accepted (Task 3 doc comment).
- **§3 content**: every string in `shell-copy.ts` and `keyboard-hints.ts` (Task 1); customer name, initials, address, profile modal (Task 5); steps from `MEETING_STEPS` (Task 5); sync, logo (Task 5); capsule labels and live region (Task 4); Meeting section fields and actions (Task 6); Context and Persona bodies unchanged in content (Task 6).
- **§4.1 shape and layering**: `StageFrame` + stage row `isolate` with capsule `z-10`, panel `z-20`, rail `z-30` (Tasks 4, 7, 8); early returns inside the frame (Task 8).
- **§4.2 top bar**: three-column grid, `@container/topbar`, 44px controls, hamburger `aria-expanded` + `aria-controls` (Task 5).
- **§4.3 scroll ownership**: `StepRegion` (Task 4) and the presentation scroller (Task 2) both `data-step-root`; `--stage-inset-b: 5rem` published by the frame (Task 4), read by the region (Task 4) and the four presentation consumers (Task 2).
- **§4.4 rail and panel**: `InspectorRail`, `MeetingPanel` with `inert`, section tabs, close, focus to header on open and to the step root on close (Tasks 7, 8); Context and Persona bodies (Task 6); Persona mounted only while open (Task 8).
- **§4.5 keys and focus**: hook (Task 3), `aria-keyshortcuts` on Prev/Next/tabs/present (Tasks 4, 5), live region (Task 4), focus effect keyed on step and readiness (Task 8), `PresentationHandle` through `ref` (Task 2).
- **§4.6 capsule**: Task 4. **§4.7 present mode**: Task 3 + Task 8 (`togglePresent` closes the panel). **§4.8 responsive**: rail `hidden lg:flex`, panel `right-0 lg:right-12`, `w-full sm:w-[380px]`, chip text `hidden md:grid`, logo `hidden sm:block`, back label `hidden md:inline` (Tasks 5, 7); verified across four viewports (Task 9). **§4.9 motion**: `motion-safe:` everywhere new (Tasks 4, 5, 7). **§4.10 accessibility**: landmarks, roles, `aria-*`, 44px, focus rings (Tasks 4–8).
- **§5 data access**: no new reads or writes; `getPersonaProfile` still lazy (Task 6 + 8); the shell reads only `id`, `name`, `address`, `city`, `state`, `zip` (Task 5 `Pick`).
- **§6 edge cases**: early returns in the frame, no-customer chip, Radix layers and typing guard, panel persists across steps and closes on present, safe-area bottom on the capsule, ⌘B exits present (Tasks 3, 4, 5, 8); the toolbar shortcut hook is not mounted on this route (verified during research).
- **§7 verification**: Task 8 Step 5 (first rendered check) and Task 9 Step 1 (the full script) cover every listed probe; `pnpm tsc` + `pnpm lint` in Task 9 Step 3.
- **§8 files**: every create, modify and delete appears in a task; the three deletions in Task 8 Step 3.
- **Type consistency**: `PanelSection`, `PresentationHandle`, `KeyHint` (Task 1) match their uses in Tasks 2, 3, 7, 8; `usePresentMode` returns `{ presenting, toggle, exit }` and the view uses `toggle` (Task 8); `useMeetingFlowKeys` args match the view's call; `StepCapsule.tone` is `MeetingStepLayout` and receives `stepConfig.layout`; `MeetingPanel.headerRef` is `RefObject<HTMLDivElement | null>` and the view passes `useRef<HTMLDivElement>(null)`; `WhoWeAreStep` and `SnapPresentation` both take `ref?: Ref<PresentationHandle>`.
