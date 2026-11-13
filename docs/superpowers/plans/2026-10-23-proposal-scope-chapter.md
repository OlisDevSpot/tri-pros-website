# Proposal Scope Chapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the proposal page's Scope chapter, open every phase by default and add an expand/collapse-all button. Make the chapter label, the part header and the phase rows stick in a stack. Move "How we'll do it" into a recessed well on a new ladder token, with wider steps.

**Architecture:** Three sticky layers, each confined by its own containing block: chapter, then `<article>`, then phase `<li>`. Offsets come from one constant (the eyebrow height) and one measured CSS variable (the part header height). The well is a new relative surface class, `surface-well`, that re-derives every ladder token one rung below its parent. Pure open-set and fold-scroll helpers live in `lib/` with node:test coverage; everything else is checked in Playwright.

**Tech Stack:** Next.js 15, React 19, Tailwind v4 container queries (`@container/proposal`), shadcn `Button`, IntersectionObserver and ResizeObserver, node:test via `pnpm tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-23-proposal-scope-chapter-design.md` (APPROVED, K1–K13). Mock: `.superpowers/sdd/2026-10-23-proposal-scope-sticky/mock/scope-studies.html` (artifact v5).

## Global Constraints

- pnpm only. Verify with `pnpm theme:check`, `pnpm lint`, `pnpm tsc` and Playwright. **Never `pnpm build`.**
- Shared working tree on `main`. No `git stash`, `git checkout -- .`, `git restore` (beyond the task's own files), `git reset`, `git add -A`, `git add .` or `git add -u`. Commit only as `git commit -m "…" -- <explicit paths>`, then `git show --stat HEAD`. The Claude pre-commit hook runs about 110 s, so give the commit a timeout of at least 300000 ms. Commit only if the owner chose per-task commits; otherwise leave the task's files changed, unstaged.
- One component per file, named exports, no file-level constants in component files (they go in `constants/`), pure helpers in `lib/`, hooks in `hooks/`. Comments say why, never what.
- Container breakpoints are `@min-[700px]/proposal:` (step indent) and `@min-[1100px]/proposal:` (rail and tabs, unchanged).
- Inside a surface, an element that must paint its rung's fill without climbing uses `bg-(--card)`, never `bg-card` (a nested `bg-card` climbs a rung). Never put a new `bg-background` inside a surface. The only canvas fill is the Scope chapter wrapper's existing `bg-background`, which the sticky eyebrow matches.
- Sticky z-order: eyebrow `z-3`, part header `z-2`, phase row `z-1`.
- Values pinned by the spec:
  - eyebrow height **36 px**
  - step inset **34 px** below 700 px, **56 px** (`pl-14`) at 700 px and up
  - phase row padding `px-5`, row grid `26px · title · N steps · chevron`, gap 10 px
  - well bleeds `-mx-5`
  - toggle `variant="outline" size="sm"` plus `h-7 gap-1 px-2.5 text-xs`, icon `size-3.5`, coarse-pointer hit area about 36 px
  - labels "Collapse all" / "Expand all"; names "Collapse all phases" / "Expand all phases"
- Reduced motion: no new motion. Existing transitions keep `motion-reduce:transition-none`, and the fold-compensation scroll is instant.
- **Files off limits:** `src/shared/modules/**`, `src/shared/db/**`, `src/shared/dal/**`, `src/trpc/**`, `src/features/proposal-flow/lib/parse-sow-section.ts`, and everything outside the files each task lists.
- Playwright auth: `http://localhost:3000/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET from .env.local>&redirect=/proposal-flow/proposal/5876b363-bc8c-4c47-ae3e-4bce1cbd9f82`. Read the secret inside the script from `.env.local`; never print it. The dev server on :3000 belongs to the main tree (`ss -ltnp` first). Before judging rendered CSS: stop it, `rm -rf .next`, restart it.

## Review Focus

1. **A long part title that wraps (phone):** the phase rows must stick just below the taller header, not under it. Pinned by Task 3 measuring the header with ResizeObserver, and by Task 5's sweep at 390 px.
2. **Folding a phase while its row is stuck:** the next phase must arrive under the headers. Pinned by `foldScrollDelta` tests (Task 4) and the Task 5 fold check.
3. **Hovering a stuck phase row:** steps must not show through it. Pinned by Task 4's opaque fill with a pseudo-element hover, and the Task 5 hover screenshot.
4. **The Overview "parts" jump** (`select('scope-part-2')`): it must land the part header right under the stuck eyebrow, not behind it. Pinned by Task 3's `scroll-mt` and the Task 5 jump check.
5. **A SOW part that fails to parse** (HTML fallback): it renders, its header still sticks, and there is no well. Pinned by Task 3 keeping the fallback branch, and a Task 5 code-read check.

---

### Task 1: The `surface-well` token

**Files:**
- Modify: `src/app/(frontend)/globals.css`
  - the relative-block selector (around line 564)
  - after the depth rules (around line 657) and before the marketing `inherit` block (around line 691)
  - the marketing `:is(…)` list
  - the `@utility` section (around line 740)
- Modify: `scripts/check-theme-contrast.ts`
  - `type Place` (line 10)
  - `PLACES` (line 74)
  - `ON_SURFACES` (line 286)
  - `climb` (line 408)
- Modify: `DESIGN.md` (Neutral, beside **Bands**, around line 174) and `docs/design-system/theme-conventions.md` (§1 bullets around line 68; the banned-patterns row "`bg-background` inside a surface", around line 223).

**Interfaces:**
- Produces: the class `surface-well`, a surface whose `--card` is one rung below the surface it sits in, and whose `--border`, `--band`, `--muted` and `--control*` all re-derive from that rung. Paint it with the `surface-well` utility (`background-color: var(--card)`).

- [ ] **Step 1: Add the theme-check places and guards, then run them and watch them fail**
  - Add `'well 0' | 'well 1'` to `Place`.
  - `const wellBlock = readBlock(/^\.surface-well\s*\{/m)`.
  - `PLACES['well 0'] = new Map([...wellBlock, ['--depth', '0']])` (a well in a rung-1 card) and `PLACES['well 1'] = new Map([...wellBlock, ['--depth', '1']])` (a well in a rung-2 card, the Scope case). `--depth` goes last so it wins.
  - Add both to `ON_SURFACES`, so every on-surface pair (text, edges, controls, hover) is checked on the well.
  - Add climb entries `[['--card', 'well 0'], ['--card', 'rung 1']]` and `[['--card', 'well 1'], ['--card', 'rung 2']]`.
  - Run: `pnpm theme:check`. Expected: FAIL, because `readBlock` finds no `.surface-well` block.

- [ ] **Step 2: Declare `surface-well` in `globals.css`**
  - Append `.surface-well` to the relative block's `:is(...)` list and to the marketing `inherit` `:is(...)` list.
  - After the depth rules, add a well's depth, counted from the surfaces it sits in, minus one. Specificity rises with nesting, so each deeper rule wins:
    - `.surface-well { --depth: -1 }`
    - `:is(.bg-card, .surface) .surface-well { --depth: 0 }`
    - two `:is(…)` levels → `1`; three levels → `2`
  - In the same bare `.surface-well` block (it must come after the relative block so its `--here-l` wins), set `--here-l: calc(var(--canvas-l) + min(max(var(--depth), 0), 1) * var(--lift) + var(--depth) * var(--step))`. At depth −1 that equals `surface-beneath`, at 0 the canvas, at 1 rung 1.
  - Add `@utility surface-well { background-color: var(--card); }` beside `surface-beneath`.
  - Put one "why" comment on the depth rules: a well sits one rung below the surface it is cut into.

- [ ] **Step 3: Run `pnpm theme:check`.** Expected: PASS, including every new `well 0` / `well 1` pair and the two climb entries. If an existing pair fails on a well place, stop and report the failing pair and its numbers (BLOCKED). Do not retune the knobs; that is the owner's call.

- [ ] **Step 4: Document it.**
  - `DESIGN.md`: one bullet beside **Bands**. **Well** (`surface-well`): a region recessed one rung below the surface it is cut into (the Scope chapter's "How we'll do it"); its edges, text and controls derive from that rung.
  - theme-conventions §1: one bullet saying `surface-well` is the recessed region and `bg-background` stays a hole.
  - Banned-patterns row: the "Instead" column becomes "`bg-(--card)` or `bg-band`; recessed: `surface-well`".

- [ ] **Step 5: Run `pnpm lint`.** Expected: clean for the touched files.

- [ ] **Step 6: Commit (per the owner's commit answer)**
  ```bash
  git commit -m "feat(theme): surface-well, a region recessed one rung below its surface" -- "src/app/(frontend)/globals.css" scripts/check-theme-contrast.ts DESIGN.md docs/design-system/theme-conventions.md
  ```

### Task 2: Sticky chapter eyebrow

**Files:**
- Create:
  - `src/features/proposal-flow/constants/scope-sticky.ts`
  - `src/features/proposal-flow/ui/components/proposal/chapter-eyebrow.tsx`
  - `src/features/proposal-flow/hooks/use-is-stuck.ts`
- Modify: `src/features/proposal-flow/ui/components/proposal/chapter-header.tsx` and `src/features/proposal-flow/ui/components/proposal/scope-of-work.tsx`

**Interfaces:**
- Produces:
  - `export const SCOPE_EYEBROW_H_PX = 36` in `constants/scope-sticky.ts`
  - `export function ChapterEyebrow({ chapter, tone = 'page', className }: { chapter: ProposalAccessor, tone?: 'page' | 'media', className?: string })`, which renders today's eyebrow `<p>` (number plus `shortLabel`, the same classes as in `chapter-header.tsx`)
  - `ChapterHeader` gains `eyebrow?: boolean` (default `true`)
  - `export function useIsStuck(node: HTMLElement | null, top: number): boolean`
  - the CSS variable `--scope-eyebrow-h`, set on the Scope chapter wrapper as `${SCOPE_EYEBROW_H_PX}px`
- Consumes: `useScrollRoot()` from `@/features/proposal-flow/contexts/scroll-context` (`rootEl`).

- [ ] **Step 1: Write `useIsStuck`.**
  - Use an IntersectionObserver with `root: rootEl`, `rootMargin: \`${-(top + 1)}px 0px 0px 0px\`` and `threshold: [1]`.
  - It is stuck when `entry.intersectionRatio < 1 && entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0) + 1`.
  - Disconnect on cleanup. It returns `false` while `node` or `rootEl` is null.

- [ ] **Step 2: Extract `ChapterEyebrow`.** `ChapterHeader` renders it when `eyebrow` is true. Every other chapter's markup stays byte-identical in the browser.

- [ ] **Step 3: Restructure `ScopeOfWork`.**
  - The wrapper keeps `bg-background` and adds `style={{ '--scope-eyebrow-h': … }}`.
  - Children, in order:
    1. a spacer carrying `ChapterInner`'s top padding (`h-14 @min-[700px]/proposal:h-20`);
    2. a sticky row `sticky top-0 z-3 h-(--scope-eyebrow-h) bg-background`, inside the `mx-auto max-w-230 px-4.5 @min-[700px]/proposal:px-10` column, holding `<ChapterEyebrow chapter="scope" />` vertically centred, and a bottom hairline (`border-b`) that is transparent unless `useIsStuck(row, 0)`;
    3. `ChapterInner` with `className="pt-0 @min-[700px]/proposal:pt-0"` and `ChapterHeader … eyebrow={false}`.
  - The H2 must sit about 10 px under the eyebrow, as today: the row's vertical centring and a small `pt` on the header column absorb it.

- [ ] **Step 4: Run `pnpm lint && pnpm tsc`.** Expected: clean.

- [ ] **Step 5: Check it in Playwright at 1440 and 390.**
  - With the scroller at the chapter top, the eyebrow's top is within 1 px of its position before the change, and the H2's top within 2 px.
  - Scrolled to the middle of part 1, the eyebrow's top equals the scroller's top and its hairline is visible.
  - Scrolled to Funding, the eyebrow has scrolled away.

- [ ] **Step 6: Commit**
  ```bash
  git commit -m "feat(proposal-flow): sticky Scope chapter label" -- src/features/proposal-flow/constants/scope-sticky.ts src/features/proposal-flow/ui/components/proposal/chapter-eyebrow.tsx src/features/proposal-flow/hooks/use-is-stuck.ts src/features/proposal-flow/ui/components/proposal/chapter-header.tsx src/features/proposal-flow/ui/components/proposal/scope-of-work.tsx
  ```

### Task 3: Sticky part header; the chip goes

**Files:**
- Create: `src/features/proposal-flow/hooks/use-element-height.ts`
- Modify: `src/features/proposal-flow/ui/components/proposal/scope-spec-card.tsx`
- Delete: `src/features/proposal-flow/ui/components/proposal/scope-done-before-chip.tsx`

**Interfaces:**
- Produces:
  - `export function useElementHeight<T extends HTMLElement>(): readonly [ref: (node: T | null) => void, height: number]`, using ResizeObserver with `borderBoxSize[0].blockSize` and rounded px
  - the CSS variable `--scope-part-head-h`, set on each `<article>`, which Task 4's rows read
- Consumes: `--scope-eyebrow-h` (Task 2).

- [ ] **Step 1: Write `useElementHeight`** (a callback ref; it disconnects the old node when a new one attaches).

- [ ] **Step 2: Edit `ScopeSpecCard`.**
  - The `<article>`: `overflow-hidden` becomes `overflow-clip`, `scroll-mt-0` becomes `scroll-mt-(--scope-eyebrow-h)`, and it gets `style={{ '--scope-part-head-h': \`${height}px\` }}`.
  - The `<header>`: add `sticky top-(--scope-eyebrow-h) z-2 bg-(--card)` and attach the ref. Its visuals are otherwise unchanged.
  - Remove `<ScopeDoneBeforeChip>` and its import, and delete the file.
  - Leave the parsed/HTML fallback branch as it is.
  - Replace the "How we'll do it" `Block` with `<ScopePhaseList phases={parsed.phases} />` (Task 4 changes that component to own the label row).

- [ ] **Step 3: Run `pnpm lint && pnpm tsc`.** Expected: clean, and `grep -rn "scope-done-before" src` returns nothing.

- [ ] **Step 4: Check it in Playwright at 390 and 1440.**
  - With part 1's steps under the stack, part 1's header top equals the scroller top + 36.
  - At part 1's end, the header is pushed up by part 2's header.
  - At 390, read `--scope-part-head-h` on each article; it equals that header's `offsetHeight`.

- [ ] **Step 5: Commit**
  ```bash
  git commit -m "feat(proposal-flow): sticky Scope part header; drop the done-before chip" -- src/features/proposal-flow/hooks/use-element-height.ts src/features/proposal-flow/ui/components/proposal/scope-spec-card.tsx src/features/proposal-flow/ui/components/proposal/scope-done-before-chip.tsx
  ```

### Task 4: The phase well

**Files:**
- Create:
  - `src/features/proposal-flow/lib/scope-phase-open.ts`
  - `src/features/proposal-flow/lib/scope-phase-open.test.ts`
  - `src/features/proposal-flow/ui/components/proposal/scope-phases-toggle.tsx`
  - `src/features/proposal-flow/ui/components/proposal/scope-phase-row.tsx`
- Modify: `src/features/proposal-flow/ui/components/proposal/scope-phase-list.tsx`

**Interfaces:**
- Produces:
  - `allPhases(count: number): ReadonlySet<number>`
  - `togglePhase(open: ReadonlySet<number>, index: number): ReadonlySet<number>`
  - `isEveryPhaseOpen(open: ReadonlySet<number>, count: number): boolean`
  - `foldScrollDelta(rowTop: number, stickyTop: number): number`, which returns `rowTop - stickyTop` when the row has passed its sticky line (`rowTop < stickyTop`), otherwise `0`
  - `ScopePhasesToggle({ allOpen, onToggle }: { allOpen: boolean, onToggle: () => void })`
  - `ScopePhaseRow({ phase, index, open, onToggle }: { phase: ParsedSowPhase, index: number, open: boolean, onToggle: (rowEl: HTMLLIElement, wasStuck: boolean) => void })`
- Consumes:
  - `--scope-eyebrow-h` and `--scope-part-head-h` (Tasks 2–3)
  - `surface-well` (Task 1)
  - `useIsStuck` (Task 2)
  - `useScrollRoot()`
  - `SCOPE_EYEBROW_H_PX`

- [ ] **Step 1: Write the failing tests** in `scope-phase-open.test.ts`, in the node:test style of `parse-sow-section.test.ts`:
  - `allPhases(3)` → a set equal to `{0, 1, 2}`; `allPhases(0)` → empty.
  - `togglePhase({0,1,2}, 1)` → `{0, 2}`; `togglePhase({0, 2}, 1)` → `{0, 1, 2}`; the input set is not mutated.
  - `isEveryPhaseOpen({0,1,2}, 3)` → true; `isEveryPhaseOpen({0, 2}, 3)` → false; `isEveryPhaseOpen(new Set(), 0)` → true.
  - `foldScrollDelta(40, 120)` → `-80`; `foldScrollDelta(120, 120)` → `0`; `foldScrollDelta(300, 120)` → `0`.

- [ ] **Step 2: Run** `pnpm tsx --test src/features/proposal-flow/lib/scope-phase-open.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement `scope-phase-open.ts`.** Every function returns a new Set.

- [ ] **Step 4: Run the test command again.** Expected: PASS.

- [ ] **Step 5: Build `ScopePhaseRow`** (an `<li>`, with `+ li` dividers from the list):
  - **Button:**
    - classes `sticky top-[calc(var(--scope-eyebrow-h)+var(--scope-part-head-h))] z-1 grid min-h-12 w-full grid-cols-[26px_minmax(0,1fr)_auto_18px] items-center gap-2.5 bg-(--card) px-5 text-left text-base font-bold`, plus `relative` for the overlay
    - hover is `before:pointer-events-none before:absolute before:inset-0 before:bg-hover before:opacity-0 hover:before:opacity-100`; the fill never changes
    - `aria-expanded`; the number, title, "N steps" and chevron as they are today
  - **Stuck hairline:** `useIsStuck(button, SCOPE_EYEBROW_H_PX + partHeadH)`, where `partHeadH` is read from the closest article's computed `--scope-part-head-h`. When stuck, it shows a bottom hairline as `shadow-[0_1px_0_var(--border)]`.
  - **Body:** today's grid-rows fold with `inert={!open}`. The list is `pl-[34px] @min-[700px]/proposal:pl-14 pr-5 pb-3.5 pt-0.5 grid list-disc gap-1.5 text-base text-muted-foreground`.
  - **Click:** calls `onToggle(li, isStuck)`.

- [ ] **Step 6: Build `ScopePhasesToggle`.**
  - `<Button variant="outline" size="sm" className="relative h-7 gap-1 px-2.5 text-xs pointer-coarse:after:absolute pointer-coarse:after:-inset-1 pointer-coarse:after:content-['']">`.
  - Icon `ChevronsDownUpIcon` when `allOpen`, else `ChevronsUpDownIcon` (lucide), `size-3.5`.
  - Label "Collapse all" / "Expand all"; `aria-label` "Collapse all phases" / "Expand all phases".

- [ ] **Step 7: Rewrite `ScopePhaseList`.**
  - The root is `<section className="surface-well -mx-5 border-y border-border pt-4">` (its `--border` is the well's own edge).
  - The label row is `flex items-center justify-between gap-3 px-5 pb-2.5`, with the "How we'll do it" `h4` (the same classes as `Block`'s label) and `ScopePhasesToggle`.
  - `<ol>` with `[&>li+li]:border-t [&>li+li]:border-border`.
  - State: `useState(() => allPhases(phases.length))`.
  - The row's `onToggle(li, wasStuck)`:
    1. When closing a stuck row, `rootEl.scrollTop += foldScrollDelta(li.getBoundingClientRect().top - rootEl.getBoundingClientRect().top, stickyTop)`, where `stickyTop = SCOPE_EYEBROW_H_PX + partHeadH`.
    2. Then `togglePhase`.
  - Toggle-all closing all: if the well's top is above `stickyTop`, apply the same delta to the well's top, then set the empty set; opening all sets `allPhases`.
  - Render nothing when `phases.length === 0` (the card already guards this).

- [ ] **Step 8: Run `pnpm lint && pnpm tsc && pnpm theme:check`.** Expected: clean.

- [ ] **Step 9: Commit**
  ```bash
  git commit -m "feat(proposal-flow): Scope phase well, all phases open, collapse-all, sticky phase rows" -- src/features/proposal-flow/lib/scope-phase-open.ts src/features/proposal-flow/lib/scope-phase-open.test.ts src/features/proposal-flow/ui/components/proposal/scope-phases-toggle.tsx src/features/proposal-flow/ui/components/proposal/scope-phase-row.tsx src/features/proposal-flow/ui/components/proposal/scope-phase-list.tsx
  ```

### Task 5: Verify and polish

**Files:**
- Create (not committed): `.superpowers/sdd/2026-10-23-proposal-scope-sticky/verify.cjs`; screenshots in `.playwright-mcp/scope-*.png`

- [ ] **Step 1: Clear the CSS cache.** Confirm :3000 is the main tree (`ss -ltnp`, `readlink /proc/<pid>/cwd`), stop it, `rm -rf .next`, then restart `pnpm dev` in the background.

- [ ] **Step 2: Write `verify.cjs`.**
  - Use local Playwright (`node_modules/.pnpm/playwright@1.58.2/...`) and the auth URL from the Global Constraints.
  - Viewports 1440×900, 1024×768, 820×1180 and 390×844; `colorScheme` light and dark.
  - For each run:
    - On load, every `#scope ol > li > button` has `aria-expanded="true"`.
    - Sweep `#proposal-container.scrollTop` through `#scope` in 40 px steps, measuring at each stop:
      - eyebrow top equals the root top while inside the chapter;
      - each stuck part header's top equals the eyebrow bottom;
      - a stuck phase row's top equals the part header's bottom;
      - at most one stuck phase row per article;
      - once `#funding` reaches the root top, no sticky element remains at the root top.
    - Step text inset from the well's left edge: 34 px below 700 px of container width, 56 px at 700 px and up. Phase number inset: 20 px.
    - Fold a stuck phase: the next phase's button top equals the part header's bottom ± 1 px.
    - Toggle-all flips its text, its `aria-label` and every `aria-expanded`.
    - `select('scope-part-2')` through a click on the Overview part link: part 2's header top equals the root top + 36 ± 2.
    - `document.documentElement.scrollWidth <= innerWidth`.
  - Screenshots: chapter top, mid part 1 (stacked), the handoff between phases, the end of part 1, hovering a stuck row, and Funding (nothing stuck), in both schemes.
  - Print the measurements as JSON.

- [ ] **Step 3: Run it.** Read the JSON before the screenshots, then fix every failure in one batch.
  - Classify each drift as a missing token, a one-off, a conceptual mismatch or a local defect, and fix it at the narrowest correct level.
  - Code-read the HTML-fallback branch (Review Focus 5).

- [ ] **Step 4: Run `/impeccable polish src/features/proposal-flow/ui/components/proposal`.** Do one batched round, desktop and phone together, with at most one confirmation round.

- [ ] **Step 5: Run `pnpm theme:check && pnpm lint && pnpm tsc`.** Expected: all clean.

- [ ] **Step 6: Owner gate.** Send the owner the screenshots in both schemes (token-change gate, theme-conventions §11.6) and ask for a hands-on check on an iPad.

- [ ] **Step 7: Commit only the fixes from Steps 3–4,** by explicit path, if the owner chose per-task commits.

---

## Self-review

- **Spec coverage:**

  | Spec item | Task |
  |---|---|
  | K1 (all open) | 4 |
  | K2 (toggle-all) | 4 |
  | K3 (chip removed) | 3 |
  | K4 (well, ends before Notes) | 4 (Notes stay in the card after the list) |
  | K5 | 3 and 4 |
  | K6 | 2 |
  | K7 and K8 (34 px / 56 px) | 4 |
  | K9 (full header) | 3 |
  | K10 and K13 (relative well) | 1 |
  | K11 and K12 (button) | 4 |
  | §4.1 opaque fills and hover overlay | 3 and 4 |
  | Stuck hairlines (§10.1) | 2 and 4 |
  | Jump offset | 3 |
  | Verification §7 | 5 |
  | Docs §4.5 | 1 |

  No gaps.
- **Names:** `--scope-eyebrow-h`, `--scope-part-head-h`, `SCOPE_EYEBROW_H_PX`, `useIsStuck`, `useElementHeight`, `allPhases`, `togglePhase`, `isEveryPhaseOpen`, `foldScrollDelta`, `ScopePhaseRow` and `ScopePhasesToggle` are used consistently across Tasks 2–5.
- **Proportion:** signatures, values and checks only; no component bodies.
