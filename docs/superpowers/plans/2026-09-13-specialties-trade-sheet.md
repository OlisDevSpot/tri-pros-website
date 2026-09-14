# Specialties Trade Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild meeting-flow step 2 ("Which Specialties Matter to You") as a project strip, a catalog grid, and one trade sheet, all reading one selection model, with no layout shift on the page.

**Architecture:** A view-scoped `TradeSelectionProvider` owns the selection shadow (seeded from `flowState.tradeSelections`, written back through the existing debounce contract), the catalog (two list queries grouped once), and the open-trade state (in the URL as `?trade=`). One `TradeSheetHost`, mounted by the view, renders the sheet through a new shared `ResponsiveSheet` (shadcn Sheet at `lg` and up, shadcn Drawer below). Scopes and reasons are Radix `ToggleGroup`s, so pressed state, roving focus, and `aria-pressed` come from the library and a toggle updates one item. The step is composition only.

**Tech Stack:** Next.js 15 (app router, `next/image`), React 19 (`createContext` + `use`, render-phase state adjustment), nuqs 2 (`parseAsString`), TanStack Query via tRPC, shadcn/ui `Sheet` (Radix Dialog), `Drawer` (vaul), `ToggleGroup`/`Toggle` (Radix), `Button`, `Input`, `Textarea`, `Label`, `Badge`, `EmptyState`/`LoadingState`/`ErrorState`, `motion/react` v12 (`AnimatePresence`, `MotionConfig`), Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-13-specialties-trade-sheet-design.md`
**Process:** `docs/how-to/ui-exploration.md` (Phases 5 to 8)
**Studies page (direction B):** https://claude.ai/code/artifact/d7cab77d-5924-492e-aebc-0de7dc32c5d6
**Rebased 2026-09-14** onto the meeting-flow shell (`cfb963d6..be4db514`, spec `docs/superpowers/specs/2026-09-13-meeting-flow-shell-design.md`). The shell supersedes this spec's footer-trigger clearance variable (the shell's `StepRegion` already pads by `--stage-inset-b`) and the idea that the context and persona panels adopt `ResponsiveSheet` (the shell panel is not a sheet). See the spec's Amendments section.

## Global Constraints

- Package manager is **pnpm**. Path alias `@/` maps to `src/`. Never run `pnpm build`; verification is `pnpm tsc` and `pnpm lint` (or `pnpm exec eslint <files>`) only (repo memory `feedback-verification-workflow`).
- The working tree is **shared with the user's live editor**. `git stash`, `git checkout <ref> -- .`, `git restore` beyond your own task's files, `git reset`, `git add -A`, `git add .`, and `git add -u` are forbidden. (repo memory `feedback-subagent-shared-tree-safety`).
- Work happens **on `main`**. Every commit is `git commit -m "…" -- <explicit paths>` followed by `git show --stat HEAD` to confirm only those paths landed. The tree holds many unrelated uncommitted changes: never touch them (repo memory `feedback-work-on-main`).
- Commit steps run **only if the user confirmed per-task commits at execution start**; otherwise stop before the commit step and report the staged paths.
- Commit messages end with the trailer `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- **Foreign uncommitted work (state at execution start, 2026-09-14).** Another session's Who We Are corrections are uncommitted in the tree, and the user's proposals reorganisation is staged in the index. Two files this plan must edit already hold foreign hunks: `src/features/meeting-flow/types/index.ts` and `src/features/meeting-flow/ui/views/meeting-flow.tsx`. **Edit them, but never stage or commit them**; leave them out of your `git commit -- <paths>` and name them in your report. The controller commits only this plan's hunks in those two files with a merge-based tool. **Never edit any other file with foreign changes**: everything under `ui/components/steps/who-we-are/`, `constants/who-we-are-sections.ts`, `constants/due-diligence.ts`, `lib/to-presentation-agent.ts`, `lib/build-proposal-defaults.ts`. **Commit recipe (exact; a bare `git commit` sweeps the user's staged work into your commit, which happened on 2026-09-14):** (1) `git diff --cached --name-status | wc -l` and note the count N; (2) `git add -- <only the NEW files you created>` (a pathspec commit cannot name untracked files); (3) `git commit -m "…" -- <every path of your task: new, modified, and deleted>` — the `-- <paths>` is mandatory, never commit without it; (4) `git show --stat HEAD` lists only your paths, and `git diff --cached --name-status | wc -l` prints N again. If either check fails, stop and report BLOCKED immediately; do not try to repair git state.
- **UI only.** Tasks change `ui/`, `constants/`, `contexts/`, `hooks/`, `lib/`, feature `types/`, and one shared component. **Files off limits:** `src/shared/entities/**` (schemas, DAL, hooks), `src/trpc/**`, `src/shared/db/**`, `src/shared/services/**`, `src/features/meeting-flow/lib/build-proposal-defaults.ts`, `src/features/meeting-flow/constants/programs.ts`, `src/features/meeting-flow/constants/energy-trades.ts`, `scripts/**`. If a task seems to need one of these, stop and report BLOCKED; the spec's §9 table is the user's list.
- Coding conventions (repo memory `coding-conventions`): one React component per file; no file-level constants or helpers in component, view, hook, or context files (constants go to `constants/`, pure functions to `lib/`); named exports only; prop interfaces stay in the component file; contexts in `contexts/`; hooks in `hooks/`; shadcn components over native elements; shared state components over inline loading/error/empty markup; `import type` for type-only imports; explicit `{ }` on every `if`.
- Lint rules that bite here: `perfectionist/sort-imports` (type imports first, then external packages alphabetically, then `@/` paths alphabetically), `antfu/if-newline`, `react-hooks-extra/no-direct-set-state-in-use-effect` (a warning; the plan avoids it by adjusting state during render and keeping the write bookkeeping in a ref), `react/no-unstable-context-value` (memoize every context value). Run `pnpm exec eslint --fix <files>` after writing a file; it sorts imports for you.
- Company facts and sales copy come only from `src/shared/constants/company/`, existing typed constants, or `docs/sales/in-home-meeting-playbook.md` lines 184 to 195 (the five outcome lines and the pairings, verbatim). No invented outcome line for any trade; trades without one show nothing.
- Design tokens: the app theme (`:root`) with `primary` as the only accent; selected state is border plus fill plus check mark, never color alone; highlights use `outline-2 outline-primary -outline-offset-2`, never `ring`, inside scrolling containers; `box-shadow` and `overflow-hidden` never on the same element (`docs/codebase-conventions/frontend-stack.md#never-co-locate-shadow-and-overflow`); body text 16px (`text-base`) in customer-facing surfaces; touch targets at least 44px on tiles and chips.
- **The meeting-flow view is the shell.** `StageFrame` is the root (`data-stage`, `--stage-inset-b:5rem`); page steps render inside `StepRegion` (the scroller, `px-4 pt-6 pb-(--stage-inset-b) md:px-6`), which already clears the floating `StepCapsule`; `MeetingPanel` and `InspectorRail` host Context and Persona. `useMeetingFlowKeys` is the one keyboard owner: ←/→ steps, ↑/↓ and A/Z presentation beats, 1–7 jump, P present, Escape closes the panel then present mode. It ignores events already `defaultPrevented` (Radix Escape), events whose target is outside the flow root (portaled dialogs, so the trade sheet), and typing targets (`input`, `textarea`, …). Add no key handlers of your own.
- Tailwind v4 content scanning does not reliably pick up classes that appear only in `.ts` files (repo memory `reference-tailwind-ts-classmap-scan-gap`). Keep every utility class literal inside `.tsx` files; the constants files in this plan hold copy and data, not class strings.
- Motion: `motion/react` only, tokens from `src/shared/constants/motion.ts`. No animation on toggle. `MotionConfig reducedMotion="user"` wraps the view content.
- Rendering rule from the spec (binding): a toggle changes one item's pressed state. No ancestor is keyed on selection, no list is rebuilt on toggle, and the sheet body is keyed on the trade id only.
- No unit test runner exists in this repo. Pure functions in `lib/` get a throwaway assertion script under the scratchpad directory (`$SCRATCH` below), run with `pnpm exec tsx` from the repo root; write the script first, watch it fail, then implement. Components verify with `pnpm tsc`, `pnpm exec eslint`, and a rendered check in the Playwright MCP browser against `pnpm dev` (port 3000). Log in first with `http://localhost:3000/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET from .env.local>&redirect=/dashboard/meetings` (repo memory `reference-playwright-auth`; never print the secret). Dev meeting: `http://localhost:3000/dashboard/meetings/2069fa85-0357-4550-8eb5-6ae40eacf5a9?step=2`; if that id no longer exists, open any meeting from `/dashboard/meetings` and use its id.
- **The dev server on port 3000 is the user's** (started 2026-09-14 05:37). Never start, stop, or restart it, and never delete `.next` or anything in it (repo memory `feedback-preflight-staged-index-and-dev-server`). It compiled its CSS at boot, so any Tailwind class that did not exist in the codebase then renders as nothing. Before judging a rendered style, build the current CSS with `node .superpowers/sdd/2026-09-13-specialties-trade-sheet/tools/build-css.mjs <out.css>` (about one second) and inject it with Playwright `page.addStyleTag({ path: '<out.css>' })` after load. Judge visibility from `offsetWidth`/`offsetHeight` and computed styles, never from the absence of overflow.
- **Browser.** Use the Playwright MCP browser if it responds; if another session holds it, write a standalone Node script: `import { chromium } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/node_modules/playwright/index.mjs'`, headless, reading `DEV_LOGIN_SECRET` from `.env.local` at runtime (never print it or write it into a file). Screenshots go to `.playwright-mcp/` (gitignored).
- `$SCRATCH` = `/tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/653d8fe9-43af-47b1-9087-a9bf54a9f03e/scratchpad`. Create `$SCRATCH/checks/` on first use.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/features/meeting-flow/types/index.ts` (modify) | `TradeScopeGroup`, `TradeCatalog`, `SelectionItem`, `TradeSelectionActions`, `TradeSelectionContextValue`, `OpenTradeOptions`, `TradeSheetState`, `TradePhoto`, `TradePairing` |
| `src/features/meeting-flow/constants/query-parsers.ts` (modify) | `tradeSheetParser` |
| `src/features/meeting-flow/constants/specialties-copy.ts` (create) | every static string the step and sheet show |
| `src/features/meeting-flow/constants/trade-selection.ts` (create) | `SELECTION_WRITE_DEBOUNCE_MS` |
| `src/features/meeting-flow/constants/trade-outcomes.ts` (create) | five playbook outcome lines keyed by trade slug |
| `src/features/meeting-flow/constants/trade-pairings.ts` (create) | playbook pairings keyed by trade slug |
| `src/features/meeting-flow/constants/trade-photos.ts` (create) | `TRADE_PHOTOS` (7 slugs) and `SCOPE_PHOTOS` (7 scope names) under `public/portfolio-photos/projects/` |
| `src/features/meeting-flow/lib/trade-selection.ts` (create) | pure selection model: find, count, normalize, canonical JSON, toggles, diff, orphans |
| `src/features/meeting-flow/lib/format-count.ts` (create) | `formatCount(n, [one, many])` |
| `src/features/meeting-flow/lib/format-selection-summary.ts` (create) | counts to "2 scopes · 1 reason" |
| `src/features/meeting-flow/lib/format-trade-meta.ts` (create) | catalog group to "4 scopes · 2 add-ons" |
| `src/features/meeting-flow/lib/group-scopes-by-trade.ts` (create) | `ScopeOrAddon[]` to `Map<tradeId, TradeScopeGroup>` |
| `src/features/meeting-flow/lib/group-trades-by-category.ts` (create) | the grouping the old step did inline |
| `src/features/meeting-flow/lib/filter-trades-by-query.ts` (create) | case-insensitive name filter |
| `src/features/meeting-flow/lib/derive-lead-trades.ts` (create) | requested trade ids to catalog trades |
| `src/features/meeting-flow/hooks/use-trade-catalog.ts` (create) | the two list queries, grouped once, as `TradeCatalog` |
| `src/features/meeting-flow/contexts/trade-selection-context.tsx` (create) | `TradeSelectionContext`, `TradeSheetContext`, `useTradeSelection`, `useTradeSheet` |
| `src/features/meeting-flow/contexts/trade-selection-provider.tsx` (create) | `TradeSelectionProvider`: shadow, write path, open state, actions |
| `src/shared/components/dialogs/sheets/responsive-sheet.tsx` (create) | Sheet at `lg`+, Drawer below; header, scrolling body, footer |
| `src/features/meeting-flow/ui/components/trade-sheet/trade-sheet-host.tsx` (create) | mounted once by the view; `ResponsiveSheet` + body keyed on trade id |
| `.../trade-sheet/trade-sheet-body.tsx` (create) | composition for one trade |
| `.../trade-sheet/trade-sheet-header.tsx` (create) | live summary line and "not in the catalog" hint |
| `.../trade-sheet/trade-photo.tsx` (create) | `next/image` or `PlaceholderSlot` in a 16:10 frame |
| `.../trade-sheet/outcome-line.tsx` (create) | the playbook line, nothing when absent |
| `.../trade-sheet/scope-tile-group.tsx` (create) | `ToggleGroup type="multiple"` of `ScopeTile`s, focus-scope handling |
| `.../trade-sheet/scope-tile.tsx` (create) | one card, `mode="toggle"` (ToggleGroupItem) or `mode="open"` (Button) |
| `.../trade-sheet/orphan-item-chips.tsx` (create) | stored items no longer in the catalog, removable |
| `.../trade-sheet/reason-chip-group.tsx` (create) | `ToggleGroup` of the eleven `meetingPainTypes` |
| `.../trade-sheet/trade-note-field.tsx` (create) | `Textarea`, writes on blur |
| `.../trade-sheet/pairing-card.tsx` (create) | playbook pairing, appears when the trade is selected |
| `.../trade-sheet/trade-sheet-footer.tsx` (create) | Remove from project (when selected) and Done |
| `.../trade-sheet/addon-chip-group.tsx` (create, USER GATE) | `ToggleGroup` of the trade's add-ons |
| `src/features/meeting-flow/ui/components/steps/specialties/index.tsx` (create) | `SpecialtiesStep`, composition only |
| `.../specialties/step-intro.tsx` (create) | heading and lead-aware intro line |
| `.../specialties/project-strip.tsx` (create) | selected trades as pressed chips that open the sheet |
| `.../specialties/start-hint.tsx` (create) | `EmptyState` when nothing was requested |
| `.../specialties/trade-catalog.tsx` (create) | search plus category grids |
| `.../specialties/trade-tile.tsx` (create) | `Button aria-pressed` with item count; opens the sheet |
| `.../specialties/lead-panels.tsx`, `lead-panel.tsx` (create, USER GATE) | one panel per requested trade with `ScopeTile mode="open"` |
| `src/features/meeting-flow/lib/get-requested-trades.ts` (create, USER GATE) | the one edge mapper from the customer to requested trade ids |
| `src/features/meeting-flow/ui/views/meeting-flow.tsx` (modify; foreign hunks, controller commits) | provider and `MotionConfig` around `StageFrame`, sheet host, new step import |
| `src/features/meeting-flow/ui/components/steps/{specialties-step,trade-card,trade-detail,scope-card}.tsx` (delete) | the old step |

Deviations from the spec's file list, each for a repo rule: the provider is split from the context file (one component per file, mirroring `presentation-context.tsx` plus `snap-presentation.tsx`); `trade-sheet-footer.tsx` and `orphan-item-chips.tsx` are separate components; `format-*.ts`, `group-trades-by-category.ts`, and `filter-trades-by-query.ts` exist because helpers may not live in component files; `constants/specialties-copy.ts` and `constants/trade-selection.ts` exist because strings and numbers may not live in component or context files. `PlaceholderSlot` stays at `ui/components/steps/who-we-are/placeholder-slot.tsx` and is imported from there: moving it would commit another session's uncommitted edits and break their untracked importer (`team-section.tsx`); the move is a follow-up. The spec's view clearance variable is dropped: the shell's `StepRegion` already clears the capsule. `toggleScope` and `toggleAddon` from the spec collapse into one `toggleItem`, because both write the same `selectedScopes` list.

---

### Task 1: Foundation: types, URL parser, copy, playbook data, photos

**Files:**
- Modify: `src/features/meeting-flow/types/index.ts` (append at the END of the file; the file holds foreign hunks, so edit but do not commit it)
- Modify: `src/features/meeting-flow/constants/query-parsers.ts`
- Create: `src/features/meeting-flow/constants/specialties-copy.ts`
- Create: `src/features/meeting-flow/constants/trade-selection.ts`
- Create: `src/features/meeting-flow/constants/trade-outcomes.ts`
- Create: `src/features/meeting-flow/constants/trade-pairings.ts`
- Create: `src/features/meeting-flow/constants/trade-photos.ts`

**Interfaces:**
- Consumes: `TradeSelection` from `@/shared/entities/meetings/schemas`; `Trade` from `@/shared/services/providers/notion/lib/trades/schema`; `ScopeOrAddon` from `@/shared/services/providers/notion/lib/scopes/schema`.
- Produces: the types below (every later task imports them from `@/features/meeting-flow/types`), `tradeSheetParser`, `SPECIALTIES_COPY`, `SELECTION_WRITE_DEBOUNCE_MS`, `TRADE_OUTCOMES`, `TRADE_PAIRINGS`, `TRADE_PHOTOS`, `SCOPE_PHOTOS`.

- [ ] **Step 1: Add the specialties types**

Append to the end of `src/features/meeting-flow/types/index.ts`, and add the two Notion type imports to the file's import block (keep imports sorted; `eslint --fix` sorts them). Touch nothing else in the file: its other uncommitted changes belong to another session.

```ts
import type { ScopeOrAddon } from '@/shared/services/providers/notion/lib/scopes/schema'
import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'
```

```ts
// ── Specialties (trade selection) ───────────────────────────────────────────

/** A trade's catalog entries, split by Notion `entryType`. */
export interface TradeScopeGroup {
  scopes: ScopeOrAddon[]
  addons: ScopeOrAddon[]
}

export interface TradeCatalog {
  trades: Trade[]
  tradesById: ReadonlyMap<string, Trade>
  tradesBySlug: ReadonlyMap<string, Trade>
  scopesByTrade: ReadonlyMap<string, TradeScopeGroup>
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

/** One chosen scope or add-on, as persisted in `TradeSelection.selectedScopes`. */
export type SelectionItem = TradeSelection['selectedScopes'][number]

export interface TradeSelectionActions {
  /** Adds the item when absent, removes it when present. Creates the trade entry on first add. */
  toggleItem: (tradeId: string, item: SelectionItem) => void
  toggleReason: (tradeId: string, reason: string) => void
  setNote: (tradeId: string, note: string) => void
  /** Drops the trade entry entirely: items, reasons, and note. */
  clearTrade: (tradeId: string) => void
}

export interface TradeSelectionContextValue extends TradeSelectionActions {
  selections: TradeSelection[]
  catalog: TradeCatalog
}

export interface OpenTradeOptions {
  /** Scope to scroll into view and focus once the sheet opens. */
  focusScopeId?: string
}

export interface TradeSheetState {
  openTradeId: string | null
  focusScopeId: string | null
  openTrade: (tradeId: string, options?: OpenTradeOptions) => void
  closeTrade: () => void
}

export interface TradePhoto {
  src: string
  alt: string
}

export interface TradePairing {
  pairedSlug: string
  reason: string
}
```

- [ ] **Step 2: Add the trade sheet URL parser**

Replace `src/features/meeting-flow/constants/query-parsers.ts` with:

```ts
import { parseAsInteger, parseAsString } from 'nuqs'

export const stepParser = parseAsInteger.withDefault(1)

/** Notion trade id of the open trade sheet; the param is absent when the sheet is closed. */
export const tradeSheetParser = parseAsString
```

- [ ] **Step 3: Write the copy constants**

Create `src/features/meeting-flow/constants/specialties-copy.ts`:

```ts
export const SPECIALTIES_COPY = {
  heading: 'What areas of your home matter most?',
  introWithLead: 'Start with what they called about. Add anything the walk-through turned up.',
  introNoLead: 'Start with what made them call. Every trade opens its own sheet.',
  catalogLoading: { title: 'Loading trades', description: 'Fetching the catalog…' },
  catalogError: { title: 'The catalog could not be loaded', description: 'Your selections are kept. Try again.' },
  retry: 'Retry',
  project: {
    eyebrow: 'Project',
    empty: 'Nothing picked yet. Open a trade to start.',
  },
  start: {
    title: 'Nothing requested on this lead.',
    body: 'Pick the trade that made them call. Each one opens its sheet.',
  },
  lead: {
    eyebrow: 'You called about',
    customize: 'Customize',
  },
  catalog: {
    headingWithLead: 'Anything else while we’re here?',
    headingNoLead: 'Every trade',
    hint: 'Tap a trade to open its sheet.',
    searchLabel: 'Filter trades',
    searchPlaceholder: 'Type to filter…',
    noMatches: 'No trades match.',
    scopesToDefine: 'Scopes to define',
  },
  sheet: {
    notOnProject: 'Not on the project yet',
    notInCatalog: 'Not in the current catalog',
    work: 'Work',
    noScopes: 'No scopes in the catalog yet.',
    noScopesAddonsOnly: 'No scopes in the catalog yet. Add-ons only.',
    addons: 'Add-ons',
    reasons: 'Reasons for this work',
    note: 'Note',
    notePlaceholder: (tradeName: string) => `What they said about ${tradeName}…`,
    orphanHint: 'Picked earlier, not in the current catalog. Tap one to remove it.',
    pairsWith: 'Pairs well with',
    pairedOnProject: 'is on the project.',
    open: 'Open',
    remove: 'Remove from project',
    done: 'Done',
  },
  units: {
    scope: ['scope', 'scopes'],
    addon: ['add-on', 'add-ons'],
    reason: ['reason', 'reasons'],
    item: ['item', 'items'],
  },
} as const
```

Create `src/features/meeting-flow/constants/trade-selection.ts`:

```ts
/** Delay between the last edit and the `flowStateJSON` write. Same value the old step used. */
export const SELECTION_WRITE_DEBOUNCE_MS = 800
```

- [ ] **Step 4: Write the playbook data constants**

Create `src/features/meeting-flow/constants/trade-outcomes.ts`. The lines are verbatim from `docs/sales/in-home-meeting-playbook.md` lines 184 to 189 (Roofing, Insulation, Windows, HVAC, Bathroom). The playbook's Solar line has no catalog trade and is left out.

```ts
/** Outcome lines by Notion trade slug. Source: docs/sales/in-home-meeting-playbook.md (Outcome lines table). */
export const TRADE_OUTCOMES: Record<string, string> = {
  'roof-and-gutters': 'Your home will be fully protected from weather damage for the next 30 years, and the cool-roof system will reduce attic heat by up to 30%.',
  'attic-and-basement': 'You\'ll notice the difference in comfort within the first month, and most customers see their energy bill drop by 20-40%.',
  'windows-and-doors': 'No more drafts, no more noise from outside, and your home will hold temperature much more consistently.',
  'hvac': 'Your system will be efficient enough that most customers cut their cooling bill nearly in half.',
  'bathroom-remodel': 'You\'ll have a completely updated bathroom that feels brand new — and it adds significantly to your home\'s resale value.',
}
```

Create `src/features/meeting-flow/constants/trade-pairings.ts`. Three playbook pairings (lines 193 to 195); the insulation and HVAC pairing is entered from both sides so either sheet offers the other.

```ts
import type { TradePairing } from '@/features/meeting-flow/types'

/** Natural scope pairings by Notion trade slug. Source: docs/sales/in-home-meeting-playbook.md (Natural Scope Pairings). */
export const TRADE_PAIRINGS: Record<string, TradePairing> = {
  'roof-and-gutters': { pairedSlug: 'attic-and-basement', reason: 'attic is already accessible' },
  'attic-and-basement': { pairedSlug: 'hvac', reason: 'energy savings compound' },
  'hvac': { pairedSlug: 'attic-and-basement', reason: 'energy savings compound' },
  'windows-and-doors': { pairedSlug: 'attic-and-basement', reason: 'envelope sealing — complete comfort story' },
}
```

Create `src/features/meeting-flow/constants/trade-photos.ts`. Every file exists under `public/portfolio-photos/projects/` (verified 2026-09-13). Scope photos are keyed by the scope's Notion name.

```ts
import type { TradePhoto } from '@/features/meeting-flow/types'

const PROJECTS = '/portfolio-photos/projects'

/** Curated project photos by trade slug. Replaced by `mediaFiles` when the R2 cover-image migration lands (#243, #244). */
export const TRADE_PHOTOS: Record<string, TradePhoto> = {
  'kitchen-remodel': { src: `${PROJECTS}/Monique/Arcadia3.jpg`, alt: 'Remodeled kitchen, Monique project' },
  'bathroom-remodel': { src: `${PROJECTS}/Monique/Arcadia10.jpg`, alt: 'Remodeled bathroom, Monique project' },
  'pool-remodel': { src: `${PROJECTS}/Riviera/hero-after.jpeg`, alt: 'Finished pool and deck, Riviera project' },
  'dryscaping': { src: `${PROJECTS}/Altura/after-1.JPG`, alt: 'Artificial turf yard, Altura project' },
  'tile': { src: `${PROJECTS}/Olympia/after-5.JPG`, alt: 'Tile work, Olympia project' },
  'exterior-upgrades-and-lot-layout': { src: `${PROJECTS}/Atlas/patio-2.jpeg`, alt: 'Covered patio, Atlas project' },
  'garage': { src: `${PROJECTS}/Atlas/garage-driveway.jpeg`, alt: 'Garage and driveway, Atlas project' },
}

/** Curated project photos by scope name. */
export const SCOPE_PHOTOS: Record<string, TradePhoto> = {
  'Full kitchen remodel': { src: `${PROJECTS}/Olympia/after-1.JPG`, alt: 'Full kitchen remodel, Olympia project' },
  'Full bathroom remodel': { src: `${PROJECTS}/Monique/Arcadia10.jpg`, alt: 'Full bathroom remodel, Monique project' },
  'New pool construction': { src: `${PROJECTS}/Riviera/hero-after.jpeg`, alt: 'New pool, Riviera project' },
  'Outdoor kitchen installation': { src: `${PROJECTS}/Atlas/outdoor-kitchen-1.jpeg`, alt: 'Outdoor kitchen, Atlas project' },
  'Patio cover installation': { src: `${PROJECTS}/Atlas/patio-2.jpeg`, alt: 'Patio cover, Atlas project' },
  'Install artificial grass': { src: `${PROJECTS}/Altura/after-1.JPG`, alt: 'Artificial grass, Altura project' },
  'Install pavers': { src: `${PROJECTS}/Bliss/hero-after.jpeg`, alt: 'Pavers, Bliss project' },
}
```

- [ ] **Step 5: Type-check and lint**

Run:

```bash
pnpm tsc
pnpm exec eslint --fix src/features/meeting-flow/types/index.ts src/features/meeting-flow/constants/query-parsers.ts src/features/meeting-flow/constants/specialties-copy.ts src/features/meeting-flow/constants/trade-selection.ts src/features/meeting-flow/constants/trade-outcomes.ts src/features/meeting-flow/constants/trade-pairings.ts src/features/meeting-flow/constants/trade-photos.ts
```

Expected: eslint clean. `pnpm tsc` reports no errors in these files (the controller's baseline lists any pre-existing errors elsewhere; do not fix those).

- [ ] **Step 6: Commit (everything except `types/index.ts`, which the controller commits)**

```bash
git commit -m "feat(meeting-flow): specialties foundation: trade sheet URL parser, copy, playbook outcomes and pairings, curated photos

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -- src/features/meeting-flow/constants/query-parsers.ts src/features/meeting-flow/constants/specialties-copy.ts src/features/meeting-flow/constants/trade-selection.ts src/features/meeting-flow/constants/trade-outcomes.ts src/features/meeting-flow/constants/trade-pairings.ts src/features/meeting-flow/constants/trade-photos.ts
git show --stat HEAD
```

Expected: six files in the commit, `types/index.ts` still modified in the working tree.

---

### Task 2: The pure selection model and catalog helpers (`lib/`)

**Files:**
- Create: `src/features/meeting-flow/lib/trade-selection.ts`
- Create: `src/features/meeting-flow/lib/format-count.ts`
- Create: `src/features/meeting-flow/lib/format-selection-summary.ts`
- Create: `src/features/meeting-flow/lib/format-trade-meta.ts`
- Create: `src/features/meeting-flow/lib/group-scopes-by-trade.ts`
- Create: `src/features/meeting-flow/lib/group-trades-by-category.ts`
- Create: `src/features/meeting-flow/lib/filter-trades-by-query.ts`
- Create: `src/features/meeting-flow/lib/derive-lead-trades.ts`
- Test (throwaway, outside the repo): `$SCRATCH/checks/trade-selection.check.ts`

**Interfaces:**
- Consumes: Task 1 types and `SPECIALTIES_COPY`; `TradeSelection` from `@/shared/entities/meetings/schemas`; `TRADE_CATEGORY_ORDER` from `constants/trade-categories.ts`.
- Produces (exact signatures, used by every later task):
  - `findTradeSelection(selections: TradeSelection[], tradeId: string): TradeSelection | undefined`
  - `itemCount(selection: TradeSelection | undefined): number`
  - `isTradeSelected(selections: TradeSelection[], tradeId: string): boolean`
  - `selectedItemIds(selection: TradeSelection | undefined): string[]`
  - `selectedTradeSelections(selections: TradeSelection[]): TradeSelection[]` (entries with one or more items, in stored order)
  - `normalizeForWrite(selections: TradeSelection[]): TradeSelection[]`
  - `canonicalSelectionsJson(selections: TradeSelection[]): string`
  - `withItemToggled(selections, trade: { id: string, name: string }, item: SelectionItem): TradeSelection[]`
  - `withReasonToggled(selections, trade, reason: string): TradeSelection[]`
  - `withNote(selections, trade, note: string): TradeSelection[]`
  - `withoutTrade(selections, tradeId): TradeSelection[]`
  - `diffIds(previous: readonly string[], next: readonly string[]): { added: string[], removed: string[] }`
  - `countSelection(selection, group: TradeScopeGroup | undefined): SelectionCounts` where `SelectionCounts = { scopes: number, addons: number, reasons: number }`
  - `orphanItems(selection, group): SelectionItem[]`
  - `formatCount(n: number, unit: readonly [string, string]): string`
  - `formatSelectionSummary(counts: SelectionCounts): string`
  - `formatTradeMeta(group: TradeScopeGroup | undefined): string`
  - `groupScopesByTrade(items: ScopeOrAddon[]): Map<string, TradeScopeGroup>`
  - `groupTradesByCategory(trades: Trade[]): [string, Trade[]][]`
  - `filterTradesByQuery(trades: Trade[], query: string): Trade[]`
  - `deriveLeadTrades(requested: ReadonlyArray<{ tradeId: string }> | null | undefined, tradesById: ReadonlyMap<string, Trade>): Trade[]`

- [ ] **Step 1: Write the failing assertion script**

Create `$SCRATCH/checks/trade-selection.check.ts` (adjust the absolute repo path if the checkout lives elsewhere):

```ts
import assert from 'node:assert/strict'
import type { TradeSelection } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/shared/entities/meetings/schemas'
import { deriveLeadTrades } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/features/meeting-flow/lib/derive-lead-trades'
import { filterTradesByQuery } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/features/meeting-flow/lib/filter-trades-by-query'
import { formatSelectionSummary } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/features/meeting-flow/lib/format-selection-summary'
import { formatTradeMeta } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/features/meeting-flow/lib/format-trade-meta'
import { groupScopesByTrade } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/features/meeting-flow/lib/group-scopes-by-trade'
import { groupTradesByCategory } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/features/meeting-flow/lib/group-trades-by-category'
import {
  canonicalSelectionsJson,
  countSelection,
  diffIds,
  isTradeSelected,
  itemCount,
  normalizeForWrite,
  orphanItems,
  selectedItemIds,
  selectedTradeSelections,
  withItemToggled,
  withNote,
  withoutTrade,
  withReasonToggled,
} from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/features/meeting-flow/lib/trade-selection'

const roof = { id: 't-roof', name: 'Roof & Gutters' }
const tearOff = { id: 's-tear', label: 'Roof tear-off' }
const redeck = { id: 's-redeck', label: 'Roof redeck' }
const gutters = { id: 'a-gutters', label: 'Gutters installation' }

// toggling creates, adds, removes; never deletes the entry
let s: TradeSelection[] = []
s = withItemToggled(s, roof, tearOff)
assert.deepEqual(s, [{ tradeId: 't-roof', tradeName: 'Roof & Gutters', selectedScopes: [tearOff], painPoints: [] }])
assert.equal(isTradeSelected(s, 't-roof'), true)
s = withItemToggled(s, roof, redeck)
assert.deepEqual(selectedItemIds(s[0]), ['s-tear', 's-redeck'])
s = withItemToggled(s, roof, tearOff)
assert.deepEqual(selectedItemIds(s[0]), ['s-redeck'])
s = withItemToggled(s, roof, redeck)
assert.equal(itemCount(s[0]), 0)
assert.equal(isTradeSelected(s, 't-roof'), false, 'zero items is not selected')
assert.equal(s.length, 1, 'the entry survives until normalization')

// reasons and notes upsert the entry too
s = withReasonToggled([], roof, 'Very old home')
assert.deepEqual(s[0]!.painPoints, ['Very old home'])
s = withReasonToggled(s, roof, 'Very old home')
assert.deepEqual(s[0]!.painPoints, [])
s = withNote(s, roof, 'north slope leaks')
assert.equal(s[0]!.notes, 'north slope leaks')

// normalization drops zero-item trades and nothing else
const mixed: TradeSelection[] = [
  { tradeId: 't-roof', tradeName: 'Roof & Gutters', selectedScopes: [tearOff], painPoints: ['Very old home'], notes: 'x' },
  { tradeId: 't-hvac', tradeName: 'HVAC', selectedScopes: [], painPoints: ['Has urgent fixes'] },
]
assert.deepEqual(normalizeForWrite(mixed).map(t => t.tradeId), ['t-roof'])
assert.deepEqual(selectedTradeSelections(mixed).map(t => t.tradeId), ['t-roof'])
assert.deepEqual(withoutTrade(mixed, 't-roof').map(t => t.tradeId), ['t-hvac'])

// canonical JSON ignores key order and treats a missing note as empty
const a: TradeSelection = { tradeId: 't', tradeName: 'T', selectedScopes: [{ id: '1', label: 'L' }], painPoints: [] }
const b = JSON.parse('{"painPoints":[],"selectedScopes":[{"label":"L","id":"1"}],"tradeName":"T","tradeId":"t","notes":""}') as TradeSelection
assert.equal(canonicalSelectionsJson([a]), canonicalSelectionsJson([b]))

// diff of ToggleGroup values
assert.deepEqual(diffIds(['1', '2'], ['2', '3']), { added: ['3'], removed: ['1'] })

// counts split add-ons from scopes using the catalog group
const group = {
  scopes: [{ id: 's-tear', name: 'Roof tear-off', entryType: 'Scope', unitOfPricing: 'bsq', coverImageUrl: null, relatedTrade: 't-roof' }],
  addons: [{ id: 'a-gutters', name: 'Gutters installation', entryType: 'Addon', unitOfPricing: 'unit', coverImageUrl: null, relatedTrade: 't-roof' }],
}
const sel: TradeSelection = { tradeId: 't-roof', tradeName: 'Roof & Gutters', selectedScopes: [tearOff, gutters, { id: 'gone', label: 'Old scope' }], painPoints: ['Very old home'] }
assert.deepEqual(countSelection(sel, group), { scopes: 2, addons: 1, reasons: 1 })
assert.deepEqual(orphanItems(sel, group).map(i => i.id), ['gone'])
assert.equal(formatSelectionSummary({ scopes: 2, addons: 1, reasons: 1 }), '2 scopes · 1 add-on · 1 reason')
assert.equal(formatSelectionSummary({ scopes: 0, addons: 0, reasons: 0 }), 'Not on the project yet')
assert.equal(formatTradeMeta(group), '1 scope · 1 add-on')
assert.equal(formatTradeMeta({ scopes: [], addons: [] }), 'Scopes to define')
assert.equal(formatTradeMeta(undefined), 'Scopes to define')

// catalog grouping
const grouped = groupScopesByTrade([...group.scopes, ...group.addons])
assert.deepEqual(grouped.get('t-roof')?.scopes.map(x => x.id), ['s-tear'])
assert.deepEqual(grouped.get('t-roof')?.addons.map(x => x.id), ['a-gutters'])

const trades = [
  { id: '1', name: 'Windows & doors', slug: 'windows-and-doors', coverImageUrl: null, type: 'Energy Efficiency' as const, relatedScopes: [], disabled: false },
  { id: '2', name: 'Attic & Basement', slug: 'attic-and-basement', coverImageUrl: null, type: 'Energy Efficiency' as const, relatedScopes: [], disabled: false },
  { id: '3', name: 'Framing', slug: 'framing', coverImageUrl: null, type: 'Structural / Rough' as const, relatedScopes: [], disabled: false },
  { id: '4', name: 'Mystery', slug: 'mystery', coverImageUrl: null, relatedScopes: [], disabled: false },
  { id: '5', name: 'Retired', slug: 'retired', coverImageUrl: null, type: 'General Construction' as const, relatedScopes: [], disabled: true },
]
const byCategory = groupTradesByCategory(trades)
assert.deepEqual(byCategory.map(([c]) => c), ['Energy Efficiency', 'Structural / Rough', 'Other'])
assert.deepEqual(byCategory[0]![1].map(t => t.name), ['Attic & Basement', 'Windows & doors'], 'alphabetical within a category')
assert.equal(byCategory.flatMap(([, ts]) => ts).some(t => t.disabled), false, 'disabled trades are dropped')

assert.deepEqual(filterTradesByQuery(trades, '  wind ').map(t => t.id), ['1'])
assert.equal(filterTradesByQuery(trades, '').length, trades.length)

const byId = new Map(trades.map(t => [t.id, t]))
assert.deepEqual(deriveLeadTrades([{ tradeId: '2' }, { tradeId: 'nope' }, { tradeId: '2' }, { tradeId: '1' }], byId).map(t => t.id), ['2', '1'])
assert.deepEqual(deriveLeadTrades(null, byId), [])

console.log('trade-selection checks passed')
```

- [ ] **Step 2: Run it and watch it fail**

Run from the repo root: `mkdir -p $SCRATCH/checks && pnpm exec tsx $SCRATCH/checks/trade-selection.check.ts`
Expected: FAIL with "Cannot find module … /lib/trade-selection".

- [ ] **Step 3: Implement the model**

Create `src/features/meeting-flow/lib/trade-selection.ts`:

```ts
import type { SelectionItem, TradeScopeGroup } from '@/features/meeting-flow/types'
import type { TradeSelection } from '@/shared/entities/meetings/schemas'

interface TradeRef {
  id: string
  name: string
}

export interface SelectionCounts {
  scopes: number
  addons: number
  reasons: number
}

export function findTradeSelection(selections: TradeSelection[], tradeId: string): TradeSelection | undefined {
  return selections.find(s => s.tradeId === tradeId)
}

export function itemCount(selection: TradeSelection | undefined): number {
  return selection?.selectedScopes.length ?? 0
}

/** Selected means one or more scopes or add-ons chosen. Reasons and notes alone do not count. */
export function isTradeSelected(selections: TradeSelection[], tradeId: string): boolean {
  return itemCount(findTradeSelection(selections, tradeId)) > 0
}

export function selectedItemIds(selection: TradeSelection | undefined): string[] {
  return selection?.selectedScopes.map(item => item.id) ?? []
}

export function selectedTradeSelections(selections: TradeSelection[]): TradeSelection[] {
  return selections.filter(s => itemCount(s) > 0)
}

/** The only shape ever persisted: zero-item trades are dropped. */
export function normalizeForWrite(selections: TradeSelection[]): TradeSelection[] {
  return selectedTradeSelections(selections)
}

/**
 * Fixed key order and a normalized `notes`, so two equal models serialize the same.
 * Postgres jsonb reorders object keys, so raw `JSON.stringify` cannot compare a write with its echo.
 */
export function canonicalSelectionsJson(selections: TradeSelection[]): string {
  return JSON.stringify(selections.map(s => ({
    tradeId: s.tradeId,
    tradeName: s.tradeName,
    selectedScopes: s.selectedScopes.map(item => ({ id: item.id, label: item.label })),
    painPoints: [...s.painPoints],
    notes: s.notes ?? '',
  })))
}

function upsert(
  selections: TradeSelection[],
  trade: TradeRef,
  update: (current: TradeSelection) => TradeSelection,
): TradeSelection[] {
  const existing = findTradeSelection(selections, trade.id)
  if (!existing) {
    const created: TradeSelection = { tradeId: trade.id, tradeName: trade.name, selectedScopes: [], painPoints: [] }
    return [...selections, update(created)]
  }
  return selections.map(s => (s.tradeId === trade.id ? update(s) : s))
}

export function withItemToggled(selections: TradeSelection[], trade: TradeRef, item: SelectionItem): TradeSelection[] {
  return upsert(selections, trade, current => ({
    ...current,
    selectedScopes: current.selectedScopes.some(i => i.id === item.id)
      ? current.selectedScopes.filter(i => i.id !== item.id)
      : [...current.selectedScopes, { id: item.id, label: item.label }],
  }))
}

export function withReasonToggled(selections: TradeSelection[], trade: TradeRef, reason: string): TradeSelection[] {
  return upsert(selections, trade, current => ({
    ...current,
    painPoints: current.painPoints.includes(reason)
      ? current.painPoints.filter(r => r !== reason)
      : [...current.painPoints, reason],
  }))
}

export function withNote(selections: TradeSelection[], trade: TradeRef, note: string): TradeSelection[] {
  return upsert(selections, trade, current => ({ ...current, notes: note }))
}

export function withoutTrade(selections: TradeSelection[], tradeId: string): TradeSelection[] {
  return selections.filter(s => s.tradeId !== tradeId)
}

/** What changed between two ToggleGroup value arrays. */
export function diffIds(previous: readonly string[], next: readonly string[]): { added: string[], removed: string[] } {
  const before = new Set(previous)
  const after = new Set(next)
  return {
    added: next.filter(id => !before.has(id)),
    removed: previous.filter(id => !after.has(id)),
  }
}

/** Scopes versus add-ons are told apart by the catalog group; items the catalog no longer has count as scopes. */
export function countSelection(selection: TradeSelection | undefined, group: TradeScopeGroup | undefined): SelectionCounts {
  if (!selection) {
    return { scopes: 0, addons: 0, reasons: 0 }
  }
  const addonIds = new Set(group?.addons.map(a => a.id) ?? [])
  const addons = selection.selectedScopes.filter(i => addonIds.has(i.id)).length
  return { scopes: selection.selectedScopes.length - addons, addons, reasons: selection.painPoints.length }
}

/** Stored items that the current catalog does not list for this trade. Shown, never dropped silently. */
export function orphanItems(selection: TradeSelection | undefined, group: TradeScopeGroup | undefined): SelectionItem[] {
  if (!selection) {
    return []
  }
  const known = new Set([...(group?.scopes ?? []), ...(group?.addons ?? [])].map(entry => entry.id))
  return selection.selectedScopes.filter(item => !known.has(item.id))
}
```

Create `src/features/meeting-flow/lib/format-count.ts`:

```ts
export function formatCount(n: number, unit: readonly [string, string]): string {
  return `${n} ${n === 1 ? unit[0] : unit[1]}`
}
```

Create `src/features/meeting-flow/lib/format-selection-summary.ts`:

```ts
import type { SelectionCounts } from '@/features/meeting-flow/lib/trade-selection'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { formatCount } from '@/features/meeting-flow/lib/format-count'

export function formatSelectionSummary(counts: SelectionCounts): string {
  const parts: string[] = []
  if (counts.scopes > 0) {
    parts.push(formatCount(counts.scopes, SPECIALTIES_COPY.units.scope))
  }
  if (counts.addons > 0) {
    parts.push(formatCount(counts.addons, SPECIALTIES_COPY.units.addon))
  }
  if (counts.reasons > 0) {
    parts.push(formatCount(counts.reasons, SPECIALTIES_COPY.units.reason))
  }
  return parts.length > 0 ? parts.join(' · ') : SPECIALTIES_COPY.sheet.notOnProject
}
```

Create `src/features/meeting-flow/lib/format-trade-meta.ts`:

```ts
import type { TradeScopeGroup } from '@/features/meeting-flow/types'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { formatCount } from '@/features/meeting-flow/lib/format-count'

export function formatTradeMeta(group: TradeScopeGroup | undefined): string {
  const parts: string[] = []
  if (group && group.scopes.length > 0) {
    parts.push(formatCount(group.scopes.length, SPECIALTIES_COPY.units.scope))
  }
  if (group && group.addons.length > 0) {
    parts.push(formatCount(group.addons.length, SPECIALTIES_COPY.units.addon))
  }
  return parts.length > 0 ? parts.join(' · ') : SPECIALTIES_COPY.catalog.scopesToDefine
}
```

Create `src/features/meeting-flow/lib/group-scopes-by-trade.ts`:

```ts
import type { TradeScopeGroup } from '@/features/meeting-flow/types'
import type { ScopeOrAddon } from '@/shared/services/providers/notion/lib/scopes/schema'

export function groupScopesByTrade(items: ScopeOrAddon[]): Map<string, TradeScopeGroup> {
  const groups = new Map<string, TradeScopeGroup>()
  for (const item of items) {
    const group = groups.get(item.relatedTrade) ?? { scopes: [], addons: [] }
    if (item.entryType === 'Addon') {
      group.addons.push(item)
    }
    else {
      group.scopes.push(item)
    }
    groups.set(item.relatedTrade, group)
  }
  return groups
}
```

Create `src/features/meeting-flow/lib/group-trades-by-category.ts` (the grouping the old step did inline, plus the disabled filter):

```ts
import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'
import { TRADE_CATEGORY_ORDER } from '@/features/meeting-flow/constants/trade-categories'

const OTHER = 'Other'

/** Categories in `TRADE_CATEGORY_ORDER`, then `Other`; alphabetical inside each; empty categories and disabled trades dropped. */
export function groupTradesByCategory(trades: Trade[]): [string, Trade[]][] {
  const groups = new Map<string, Trade[]>()
  for (const category of TRADE_CATEGORY_ORDER) {
    groups.set(category, [])
  }
  groups.set(OTHER, [])
  for (const trade of trades) {
    if (trade.disabled) {
      continue
    }
    const bucket = groups.get(trade.type ?? OTHER) ?? groups.get(OTHER)!
    bucket.push(trade)
  }
  for (const bucket of groups.values()) {
    bucket.sort((a, b) => a.name.localeCompare(b.name))
  }
  return Array.from(groups.entries()).filter(([, bucket]) => bucket.length > 0)
}
```

Create `src/features/meeting-flow/lib/filter-trades-by-query.ts`:

```ts
import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'

export function filterTradesByQuery(trades: Trade[], query: string): Trade[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') {
    return trades
  }
  return trades.filter(trade => trade.name.toLowerCase().includes(needle))
}
```

Create `src/features/meeting-flow/lib/derive-lead-trades.ts`:

```ts
import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'

/** Requested trade ids from the lead, in order, deduplicated, limited to trades the catalog has. */
export function deriveLeadTrades(
  requested: ReadonlyArray<{ tradeId: string }> | null | undefined,
  tradesById: ReadonlyMap<string, Trade>,
): Trade[] {
  const seen = new Set<string>()
  const result: Trade[] = []
  for (const { tradeId } of requested ?? []) {
    const trade = tradesById.get(tradeId)
    if (trade && !seen.has(tradeId)) {
      seen.add(tradeId)
      result.push(trade)
    }
  }
  return result
}
```

- [ ] **Step 4: Run the checks, then type-check and lint**

```bash
pnpm exec tsx $SCRATCH/checks/trade-selection.check.ts
pnpm tsc
pnpm exec eslint --fix src/features/meeting-flow/lib/trade-selection.ts src/features/meeting-flow/lib/format-count.ts src/features/meeting-flow/lib/format-selection-summary.ts src/features/meeting-flow/lib/format-trade-meta.ts src/features/meeting-flow/lib/group-scopes-by-trade.ts src/features/meeting-flow/lib/group-trades-by-category.ts src/features/meeting-flow/lib/filter-trades-by-query.ts src/features/meeting-flow/lib/derive-lead-trades.ts
```

Expected: `trade-selection checks passed`, then no type errors, then eslint clean. The script imports only `import type` from `@/…` transitively, plus `TRADE_CATEGORY_ORDER` and `SPECIALTIES_COPY`, which tsx resolves through the repo `tsconfig.json` paths because the command runs from the repo root.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(meeting-flow): pure trade selection model and catalog helpers for the specialties step

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -- src/features/meeting-flow/lib/trade-selection.ts src/features/meeting-flow/lib/format-count.ts src/features/meeting-flow/lib/format-selection-summary.ts src/features/meeting-flow/lib/format-trade-meta.ts src/features/meeting-flow/lib/group-scopes-by-trade.ts src/features/meeting-flow/lib/group-trades-by-category.ts src/features/meeting-flow/lib/filter-trades-by-query.ts src/features/meeting-flow/lib/derive-lead-trades.ts
git show --stat HEAD
```

---

### Task 3: Catalog hook, contexts, and the selection provider

**Files:**
- Create: `src/features/meeting-flow/hooks/use-trade-catalog.ts`
- Create: `src/features/meeting-flow/contexts/trade-selection-context.tsx`
- Create: `src/features/meeting-flow/contexts/trade-selection-provider.tsx`

**Interfaces:**
- Consumes: Task 1 types, `tradeSheetParser`, `SELECTION_WRITE_DEBOUNCE_MS`; Task 2 `canonicalSelectionsJson`, `findTradeSelection`, `normalizeForWrite`, `withItemToggled`, `withReasonToggled`, `withNote`, `withoutTrade`, `groupScopesByTrade`; `useGetAllTrades` from `@/shared/services/providers/notion/dal/trades/hooks/queries/use-get-trades`; `useTRPC` from `@/trpc/helpers`; `useDebounce` from `@/shared/hooks/use-debounce`; `MeetingFlowContext` (existing).
- Produces: `useTradeCatalog(): TradeCatalog`; `TradeSelectionContext`, `TradeSheetContext`; `useTradeSelection(): TradeSelectionContextValue`; `useTradeSheet(): TradeSheetState`; `<TradeSelectionProvider flowContext={…}>`.

- [ ] **Step 1: The catalog hook**

Create `src/features/meeting-flow/hooks/use-trade-catalog.ts`:

```ts
'use client'

import type { TradeCatalog } from '@/features/meeting-flow/types'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { groupScopesByTrade } from '@/features/meeting-flow/lib/group-scopes-by-trade'
import { useGetAllTrades } from '@/shared/services/providers/notion/dal/trades/hooks/queries/use-get-trades'
import { useTRPC } from '@/trpc/helpers'

/** The whole trade and scope catalog, fetched once and grouped once. No per-trade or hover-time queries. */
export function useTradeCatalog(): TradeCatalog {
  const trpc = useTRPC()
  const tradesQuery = useGetAllTrades()
  const scopesQuery = useQuery(trpc.notionRouter.scopes.getAll.queryOptions())

  const trades = useMemo(() => (tradesQuery.data ?? []).filter(trade => !trade.disabled), [tradesQuery.data])
  const tradesById = useMemo(() => new Map(trades.map(trade => [trade.id, trade])), [trades])
  const tradesBySlug = useMemo(() => new Map(trades.map(trade => [trade.slug, trade])), [trades])
  const scopesByTrade = useMemo(() => groupScopesByTrade(scopesQuery.data ?? []), [scopesQuery.data])

  const refetchTrades = tradesQuery.refetch
  const refetchScopes = scopesQuery.refetch
  const refetch = useCallback(() => {
    void refetchTrades()
    void refetchScopes()
  }, [refetchTrades, refetchScopes])

  const isLoading = tradesQuery.isLoading || scopesQuery.isLoading
  const error = tradesQuery.error ?? scopesQuery.error ?? null

  return useMemo(
    () => ({ trades, tradesById, tradesBySlug, scopesByTrade, isLoading, error, refetch }),
    [trades, tradesById, tradesBySlug, scopesByTrade, isLoading, error, refetch],
  )
}
```

- [ ] **Step 2: The two contexts and their hooks**

Create `src/features/meeting-flow/contexts/trade-selection-context.tsx` (mirrors `presentation-context.tsx`):

```tsx
'use client'

import type { TradeSelectionContextValue, TradeSheetState } from '@/features/meeting-flow/types'
import { createContext, use } from 'react'

/** Selections, catalog, and the edit actions. Changes on every toggle. */
export const TradeSelectionContext = createContext<TradeSelectionContextValue | null>(null)

export function useTradeSelection(): TradeSelectionContextValue {
  const ctx = use(TradeSelectionContext)
  if (!ctx) {
    throw new Error('useTradeSelection must be used inside <TradeSelectionProvider>')
  }
  return ctx
}

/** Which trade sheet is open. Split from the selection context so openers do not re-render on toggles and tiles do not re-render on open. */
export const TradeSheetContext = createContext<TradeSheetState | null>(null)

export function useTradeSheet(): TradeSheetState {
  const ctx = use(TradeSheetContext)
  if (!ctx) {
    throw new Error('useTradeSheet must be used inside <TradeSelectionProvider>')
  }
  return ctx
}
```

- [ ] **Step 3: The provider**

Create `src/features/meeting-flow/contexts/trade-selection-provider.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'
import type { MeetingFlowContext, OpenTradeOptions, SelectionItem, TradeSelectionContextValue, TradeSheetState } from '@/features/meeting-flow/types'
import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import { useQueryState } from 'nuqs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { tradeSheetParser } from '@/features/meeting-flow/constants/query-parsers'
import { SELECTION_WRITE_DEBOUNCE_MS } from '@/features/meeting-flow/constants/trade-selection'
import { TradeSelectionContext, TradeSheetContext } from '@/features/meeting-flow/contexts/trade-selection-context'
import { useTradeCatalog } from '@/features/meeting-flow/hooks/use-trade-catalog'
import {
  canonicalSelectionsJson,
  findTradeSelection,
  normalizeForWrite,
  withItemToggled,
  withNote,
  withoutTrade,
  withReasonToggled,
} from '@/features/meeting-flow/lib/trade-selection'
import { useDebounce } from '@/shared/hooks/use-debounce'

interface TradeSelectionProviderProps {
  flowContext: MeetingFlowContext
  children: ReactNode
}

/**
 * One source of truth for step 2 and any later step that opens a trade.
 *
 * Shadow: local `selections` seeded from `flowState.tradeSelections`. Re-seeded
 * when the server value changes to anything this provider did not write itself
 * (compared through `canonicalSelectionsJson`, since jsonb reorders keys), so a
 * stale refetch that lands after a newer write cannot roll the shadow back.
 * Write path: the debounced shadow, normalized (zero-item trades dropped), is
 * written once per distinct value after the first user action. Opening or
 * closing the sheet never writes. A write still pending when the view unmounts
 * is lost, as it was in the old step.
 */
export function TradeSelectionProvider({ flowContext, children }: TradeSelectionProviderProps) {
  const { onFlowStateChange } = flowContext
  const catalog = useTradeCatalog()

  const serverSelections = useMemo(
    () => flowContext.flowState?.tradeSelections ?? [],
    [flowContext.flowState?.tradeSelections],
  )
  const serverJson = useMemo(() => canonicalSelectionsJson(serverSelections), [serverSelections])

  const [selections, setSelections] = useState<TradeSelection[]>(serverSelections)
  const [seededFrom, setSeededFrom] = useState(serverJson)
  const [dirty, setDirty] = useState(false)
  const lastWrittenRef = useRef<string | null>(null)
  /** Every value this provider has written. An echo of any of them, including a stale one that lands after a newer write, never re-seeds. */
  const writtenRef = useRef<Set<string>>(new Set())

  // Render-phase adjustment (React: "storing information from previous renders").
  if (seededFrom !== serverJson) {
    setSeededFrom(serverJson)
    if (!writtenRef.current.has(serverJson)) {
      setSelections(serverSelections)
    }
  }

  const debounced = useDebounce(selections, SELECTION_WRITE_DEBOUNCE_MS)
  useEffect(() => {
    if (!dirty) {
      return
    }
    const normalized = normalizeForWrite(debounced)
    const json = canonicalSelectionsJson(normalized)
    if (json === lastWrittenRef.current || json === serverJson) {
      return
    }
    lastWrittenRef.current = json
    writtenRef.current.add(json)
    onFlowStateChange({ tradeSelections: normalized })
  }, [debounced, dirty, onFlowStateChange, serverJson])

  const tradesById = catalog.tradesById
  const resolveTrade = useCallback((tradeId: string, current: TradeSelection[]) => ({
    id: tradeId,
    name: tradesById.get(tradeId)?.name ?? findTradeSelection(current, tradeId)?.tradeName ?? tradeId,
  }), [tradesById])

  const toggleItem = useCallback((tradeId: string, item: SelectionItem) => {
    setDirty(true)
    setSelections(current => withItemToggled(current, resolveTrade(tradeId, current), item))
  }, [resolveTrade])

  const toggleReason = useCallback((tradeId: string, reason: string) => {
    setDirty(true)
    setSelections(current => withReasonToggled(current, resolveTrade(tradeId, current), reason))
  }, [resolveTrade])

  const setNote = useCallback((tradeId: string, note: string) => {
    setDirty(true)
    setSelections(current => withNote(current, resolveTrade(tradeId, current), note))
  }, [resolveTrade])

  const clearTrade = useCallback((tradeId: string) => {
    setDirty(true)
    setSelections(current => withoutTrade(current, tradeId))
  }, [])

  const [openTradeId, setOpenTradeId] = useQueryState('trade', tradeSheetParser)
  const [focusScopeId, setFocusScopeId] = useState<string | null>(null)

  const openTrade = useCallback((tradeId: string, options?: OpenTradeOptions) => {
    setFocusScopeId(options?.focusScopeId ?? null)
    void setOpenTradeId(tradeId)
  }, [setOpenTradeId])

  const closeTrade = useCallback(() => {
    setFocusScopeId(null)
    void setOpenTradeId(null)
  }, [setOpenTradeId])

  const selectionValue = useMemo<TradeSelectionContextValue>(
    () => ({ selections, catalog, toggleItem, toggleReason, setNote, clearTrade }),
    [selections, catalog, toggleItem, toggleReason, setNote, clearTrade],
  )

  const sheetValue = useMemo<TradeSheetState>(
    () => ({ openTradeId, focusScopeId, openTrade, closeTrade }),
    [openTradeId, focusScopeId, openTrade, closeTrade],
  )

  return (
    <TradeSelectionContext value={selectionValue}>
      <TradeSheetContext value={sheetValue}>
        {children}
      </TradeSheetContext>
    </TradeSelectionContext>
  )
}
```

- [ ] **Step 4: Type-check and lint**

```bash
pnpm tsc
pnpm exec eslint --fix src/features/meeting-flow/hooks/use-trade-catalog.ts src/features/meeting-flow/contexts/trade-selection-context.tsx src/features/meeting-flow/contexts/trade-selection-provider.tsx
```

Expected: clean, with zero warnings on these three files (no `setState` inside `useEffect`; the ref carries the bookkeeping). If eslint reports `react-hooks/exhaustive-deps` on the write effect, the dependency list above is complete; report the message rather than adding a disable comment.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(meeting-flow): trade selection provider: catalog hook, selection and sheet contexts, debounced write path, open trade in the URL

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -- src/features/meeting-flow/hooks/use-trade-catalog.ts src/features/meeting-flow/contexts/trade-selection-context.tsx src/features/meeting-flow/contexts/trade-selection-provider.tsx
git show --stat HEAD
```

---

### Task 4: `ResponsiveSheet`, the shared host

**Files:**
- Create: `src/shared/components/dialogs/sheets/responsive-sheet.tsx`

**Interfaces:**
- Consumes: `Sheet*` from `@/shared/components/ui/sheet`, `Drawer*` from `@/shared/components/ui/drawer`, `useIsBelowLg` from `@/shared/hooks/use-is-below-lg`.
- Produces: `<ResponsiveSheet open onOpenChange title description? footer? contentClassName? onOpenAutoFocus?>{children}</ResponsiveSheet>`. `title` and `description` are strings because Radix renders them inside `<h2>` and `<p>`.

- [ ] **Step 1: Write the component**

```tsx
'use client'

import type { ReactNode } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/shared/components/ui/drawer'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet'
import { useIsBelowLg } from '@/shared/hooks/use-is-below-lg'
import { cn } from '@/shared/lib/utils'

interface ResponsiveSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  /** Pinned below the scrolling body. */
  footer?: ReactNode
  /** Width above `lg` (for example `sm:max-w-xl`), height below it. */
  contentClassName?: string
  /** Radix `onOpenAutoFocus`. Call `event.preventDefault()` to place focus yourself. */
  onOpenAutoFocus?: (event: Event) => void
  children: ReactNode
}

/**
 * One host for "work on one thing" panels: a right-side Sheet (Radix Dialog) at
 * `lg` and up, a bottom Drawer (vaul) below it. Overlay, focus trap, Escape,
 * scroll lock, drag-to-close, and return-focus come from the primitives.
 * Header and footer stay put; the body scrolls. The breakpoint hook reports
 * `false` on the first client render, so a sheet open on page load below `lg`
 * renders as a Sheet for one frame before becoming a Drawer.
 */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  footer,
  contentClassName,
  onOpenAutoFocus,
  children,
}: ResponsiveSheetProps) {
  const isBelowLg = useIsBelowLg()

  if (isBelowLg) {
    return (
      <Drawer direction="bottom" open={open} onOpenChange={onOpenChange}>
        <DrawerContent className={contentClassName} onOpenAutoFocus={onOpenAutoFocus}>
          <DrawerHeader className="text-left">
            <DrawerTitle>{title}</DrawerTitle>
            {description !== undefined && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
          {footer !== undefined && (
            <DrawerFooter className="border-t pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={cn('gap-0', contentClassName)} side="right" onOpenAutoFocus={onOpenAutoFocus}>
        <SheetHeader className="pr-12">
          <SheetTitle>{title}</SheetTitle>
          {description !== undefined && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
        {footer !== undefined && <SheetFooter className="border-t">{footer}</SheetFooter>}
      </SheetContent>
    </Sheet>
  )
}
```

Notes for the implementer: `DrawerContent` already caps height at `80vh` for `direction="bottom"` and draws the drag handle; do not add either. vaul's `Drawer.Content` extends Radix `Dialog.Content`, so `onOpenAutoFocus` passes through. `cn` merges `sm:max-w-xl` over the Sheet's default `sm:max-w-sm`.

- [ ] **Step 2: Type-check and lint**

```bash
pnpm tsc
pnpm exec eslint --fix src/shared/components/dialogs/sheets/responsive-sheet.tsx
```

Expected: clean. The rendered check for this primitive happens in Task 6, where the first consumer mounts it.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(ui): ResponsiveSheet: shadcn Sheet above lg, Drawer below, one API

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -- src/shared/components/dialogs/sheets/responsive-sheet.tsx
git show --stat HEAD
```

---

### Task 5: The step (intro, project strip, start hint, catalog, tile), wire the view, retire the old step

**Files:**
- Create: `src/features/meeting-flow/ui/components/steps/specialties/index.tsx`
- Create: `src/features/meeting-flow/ui/components/steps/specialties/step-intro.tsx`
- Create: `src/features/meeting-flow/ui/components/steps/specialties/project-strip.tsx`
- Create: `src/features/meeting-flow/ui/components/steps/specialties/start-hint.tsx`
- Create: `src/features/meeting-flow/ui/components/steps/specialties/trade-catalog.tsx`
- Create: `src/features/meeting-flow/ui/components/steps/specialties/trade-tile.tsx`
- Modify: `src/features/meeting-flow/ui/views/meeting-flow.tsx` (the step import, the specialties render line, and the final `return`; foreign hunks, so edit but do not commit)
- Delete: `src/features/meeting-flow/ui/components/steps/specialties-step.tsx`, `trade-card.tsx`, `trade-detail.tsx`, `scope-card.tsx`

**Interfaces:**
- Consumes: Task 3 `useTradeSelection`, `useTradeSheet`, `TradeSelectionProvider`; Task 2 helpers; Task 1 copy; `TRADE_CATEGORY_LABELS` and `TradeCategory` from `constants/trade-categories.ts`; shadcn `Button`, `Input`; `EmptyState`, `LoadingState`, `ErrorState`.
- Produces: `<SpecialtiesStep />` (no props); `<StepIntro hasLead />`, `<TradeCatalog hasLead />` (Task 9 passes `true` when lead trades exist); the provider mounted around the shell's `StageFrame`.

- [ ] **Step 1: The five components**

`step-intro.tsx`:

```tsx
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'

interface StepIntroProps {
  hasLead: boolean
}

export function StepIntro({ hasLead }: StepIntroProps) {
  return (
    <header className="flex flex-col gap-1">
      <h2 className="text-xl font-semibold tracking-tight text-balance">{SPECIALTIES_COPY.heading}</h2>
      <p className="text-base text-muted-foreground">
        {hasLead ? SPECIALTIES_COPY.introWithLead : SPECIALTIES_COPY.introNoLead}
      </p>
    </header>
  )
}
```

`project-strip.tsx`:

```tsx
'use client'

import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeSelection, useTradeSheet } from '@/features/meeting-flow/contexts/trade-selection-context'
import { itemCount, selectedTradeSelections } from '@/features/meeting-flow/lib/trade-selection'
import { Button } from '@/shared/components/ui/button'

/** Selected trades as pressed chips. A chip opens that trade's sheet. Reads the model; never edits it. */
export function ProjectStrip() {
  const { selections } = useTradeSelection()
  const { openTrade } = useTradeSheet()
  const selected = selectedTradeSelections(selections)

  return (
    <section aria-labelledby="project-strip-heading" className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2.5">
      <h3 id="project-strip-heading" className="mr-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {SPECIALTIES_COPY.project.eyebrow}
      </h3>
      {selected.length === 0
        ? <p className="text-base text-muted-foreground">{SPECIALTIES_COPY.project.empty}</p>
        : selected.map(selection => (
            <Button
              key={selection.tradeId}
              aria-pressed
              className="h-11 gap-2 aria-pressed:border-primary aria-pressed:bg-primary/5"
              size="sm"
              variant="outline"
              onClick={() => openTrade(selection.tradeId)}
            >
              {selection.tradeName}
              <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
                {itemCount(selection)}
              </span>
            </Button>
          ))}
    </section>
  )
}
```

`start-hint.tsx`:

```tsx
import { SparklesIcon } from 'lucide-react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { EmptyState } from '@/shared/components/states/empty-state'

/** Shown when the lead requested nothing. Replaced by lead panels when it did. */
export function StartHint() {
  return (
    <EmptyState className="h-auto" description={SPECIALTIES_COPY.start.body} title={SPECIALTIES_COPY.start.title}>
      <SparklesIcon aria-hidden className="mr-2 size-5 text-primary" />
    </EmptyState>
  )
}
```

`trade-tile.tsx`:

```tsx
'use client'

import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'
import { ChevronRightIcon } from 'lucide-react'
import { useTradeSelection, useTradeSheet } from '@/features/meeting-flow/contexts/trade-selection-context'
import { formatTradeMeta } from '@/features/meeting-flow/lib/format-trade-meta'
import { findTradeSelection, itemCount } from '@/features/meeting-flow/lib/trade-selection'
import { Button } from '@/shared/components/ui/button'

interface TradeTileProps {
  trade: Trade
}

/** Opens the trade's sheet. Pressed when the trade has one or more items. Never toggles selection itself. */
export function TradeTile({ trade }: TradeTileProps) {
  const { selections, catalog } = useTradeSelection()
  const { openTrade } = useTradeSheet()
  const count = itemCount(findTradeSelection(selections, trade.id))

  return (
    <Button
      aria-pressed={count > 0}
      className="h-auto min-h-14 w-full justify-between gap-3 px-3.5 py-3 text-left whitespace-normal aria-pressed:border-primary aria-pressed:bg-primary/5"
      variant="outline"
      onClick={() => openTrade(trade.id)}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-base leading-tight font-semibold">{trade.name}</span>
        <span className="text-sm text-muted-foreground">{formatTradeMeta(catalog.scopesByTrade.get(trade.id))}</span>
      </span>
      {count > 0
        ? (
            <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground tabular-nums">
              {count}
            </span>
          )
        : <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
    </Button>
  )
}
```

`trade-catalog.tsx`:

```tsx
'use client'

import type { TradeCategory } from '@/features/meeting-flow/constants/trade-categories'
import { SearchIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { TRADE_CATEGORY_LABELS } from '@/features/meeting-flow/constants/trade-categories'
import { useTradeSelection } from '@/features/meeting-flow/contexts/trade-selection-context'
import { filterTradesByQuery } from '@/features/meeting-flow/lib/filter-trades-by-query'
import { groupTradesByCategory } from '@/features/meeting-flow/lib/group-trades-by-category'
import { TradeTile } from '@/features/meeting-flow/ui/components/steps/specialties/trade-tile'
import { Input } from '@/shared/components/ui/input'

interface TradeCatalogProps {
  hasLead: boolean
}

/** Every trade, in three category grids that wrap. No horizontal scrolling. */
export function TradeCatalog({ hasLead }: TradeCatalogProps) {
  const { catalog } = useTradeSelection()
  const [query, setQuery] = useState('')
  const groups = useMemo(
    () => groupTradesByCategory(filterTradesByQuery(catalog.trades, query)),
    [catalog.trades, query],
  )

  return (
    <section aria-labelledby="trade-catalog-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 id="trade-catalog-heading" className="text-base font-semibold">
            {hasLead ? SPECIALTIES_COPY.catalog.headingWithLead : SPECIALTIES_COPY.catalog.headingNoLead}
          </h3>
          <p className="text-sm text-muted-foreground">{SPECIALTIES_COPY.catalog.hint}</p>
        </div>
        <div className="relative w-full sm:w-64">
          <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={SPECIALTIES_COPY.catalog.searchLabel}
            className="h-11 pl-8 text-base"
            placeholder={SPECIALTIES_COPY.catalog.searchPlaceholder}
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </div>
      </div>

      {groups.length === 0 && <p className="text-base text-muted-foreground">{SPECIALTIES_COPY.catalog.noMatches}</p>}

      {groups.map(([category, trades]) => (
        <div key={category} className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {TRADE_CATEGORY_LABELS[category as TradeCategory] ?? category}
          </h4>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {trades.map(trade => (
              <li key={trade.id}>
                <TradeTile trade={trade} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
```

`index.tsx`:

```tsx
'use client'

import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeSelection } from '@/features/meeting-flow/contexts/trade-selection-context'
import { ProjectStrip } from '@/features/meeting-flow/ui/components/steps/specialties/project-strip'
import { StartHint } from '@/features/meeting-flow/ui/components/steps/specialties/start-hint'
import { StepIntro } from '@/features/meeting-flow/ui/components/steps/specialties/step-intro'
import { TradeCatalog } from '@/features/meeting-flow/ui/components/steps/specialties/trade-catalog'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Button } from '@/shared/components/ui/button'

/**
 * Step 2 of the meeting flow. Composition only: the model and the open trade
 * live in `TradeSelectionProvider`; the sheet is mounted by the view.
 */
export function SpecialtiesStep() {
  const { catalog } = useTradeSelection()

  if (catalog.isLoading) {
    return <LoadingState description={SPECIALTIES_COPY.catalogLoading.description} title={SPECIALTIES_COPY.catalogLoading.title} />
  }

  if (catalog.error) {
    return (
      <div className="flex flex-col items-center gap-3">
        <ErrorState description={SPECIALTIES_COPY.catalogError.description} title={SPECIALTIES_COPY.catalogError.title} />
        <Button size="sm" variant="outline" onClick={catalog.refetch}>{SPECIALTIES_COPY.retry}</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <StepIntro hasLead={false} />
      <ProjectStrip />
      <StartHint />
      <TradeCatalog hasLead={false} />
    </div>
  )
}
```

- [ ] **Step 2: Wire the view**

`src/features/meeting-flow/ui/views/meeting-flow.tsx` is the shell view and holds another session's uncommitted hunks (a `toPresentationAgent` import and an `agent` prop on `WhoWeAreStep`). Make exactly these three edits and nothing else:

1. Replace the import `import { SpecialtiesStep } from '@/features/meeting-flow/ui/components/steps/specialties-step'` with `import { SpecialtiesStep } from '@/features/meeting-flow/ui/components/steps/specialties'`. Add `import { MotionConfig } from 'motion/react'` and `import { TradeSelectionProvider } from '@/features/meeting-flow/contexts/trade-selection-provider'`.
2. Replace `{stepConfig.id === 'specialties' && <SpecialtiesStep flowContext={flowContext} />}` with `{stepConfig.id === 'specialties' && <SpecialtiesStep />}`.
3. Wrap the final `return` (the one that renders `<StageFrame ref={rootRef}>` with `TopBar`, the stage, `MeetingPanel`, `InspectorRail`, and the two dialogs) so it reads:

```tsx
  return (
    <TradeSelectionProvider flowContext={flowContext}>
      <MotionConfig reducedMotion="user">
        <StageFrame ref={rootRef}>
          {/* … the existing children, unchanged … */}
        </StageFrame>
      </MotionConfig>
    </TradeSelectionProvider>
  )
```

`flowContext` is non-null there: the `!meeting || !flowContext` guard returned above. The loading, error, and invalid-step returns stay unwrapped. Re-indent the wrapped children by four spaces. The provider renders no DOM, so `rootRef` still points at the stage root and the key hook's `root.contains(target)` guard is unchanged. Do not add padding or variables for the capsule: `StepRegion` already pads by `--stage-inset-b`.

Then run `pnpm exec eslint --fix src/features/meeting-flow/ui/views/meeting-flow.tsx` and confirm with `git diff src/features/meeting-flow/ui/views/meeting-flow.tsx` that the foreign `toPresentationAgent` hunks are still present and untouched.

- [ ] **Step 3: Delete the old step**

```bash
rm src/features/meeting-flow/ui/components/steps/specialties-step.tsx src/features/meeting-flow/ui/components/steps/trade-card.tsx src/features/meeting-flow/ui/components/steps/trade-detail.tsx src/features/meeting-flow/ui/components/steps/scope-card.tsx
```

Plain `rm`, not `git rm`: the commit's pathspec records the deletions without touching the shared index. Verified 2026-09-14: the only importer outside these four files is the view. `trade-project-grid.tsx` stays; the portfolio step uses it. The landing page's `trade-card.tsx` is a different file and is untouched.

- [ ] **Step 4: Type-check and lint**

```bash
pnpm tsc
pnpm exec eslint --fix src/features/meeting-flow/ui/components/steps/specialties src/features/meeting-flow/ui/views/meeting-flow.tsx
```

Expected: eslint clean; `pnpm tsc` shows no errors in these files. `pnpm tsc` also proves nothing else imported the deleted files.

- [ ] **Step 5: Rendered check**

Never touch the dev server. Build fresh CSS with the tool named in Global Constraints and inject it after each load. Log in, open the dev meeting at `?step=2`, viewport 1440×900.

- The intro, the "Project" strip reading "Nothing picked yet. Open a trade to start.", the start hint, and three category headings with wrapping tile grids render inside the step region. Each tile has `offsetHeight >= 44`. No horizontal overflow: `document.documentElement.scrollWidth <= window.innerWidth` and the `[data-step-root]` element's `scrollWidth <= clientWidth`.
- Scroll the step region to the bottom: the last tile's bottom edge sits above the capsule's top edge (the capsule is the floating step control near the bottom of the stage).
- Type `wind` in the filter: only "Windows & doors" remains and the other categories disappear. While typing, the step does not change (typing `2` or `3` in the filter must not jump steps). Clear it and all return.
- Click the step region background, press → then ←: the step changes to 3 and back to 2 (the shell's key owner still works around the new provider).
- Click a tile: the URL gains `?trade=<notion id>` (nothing visible opens yet; the host lands in Task 6). Remove the param.
- Screenshot to `.playwright-mcp/spec-t5-step.png`.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(meeting-flow): specialties step on the selection model: intro, project strip, start hint, wrapping catalog with filter; old step retired

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -- src/features/meeting-flow/ui/components/steps/specialties src/features/meeting-flow/ui/components/steps/specialties-step.tsx src/features/meeting-flow/ui/components/steps/trade-card.tsx src/features/meeting-flow/ui/components/steps/trade-detail.tsx src/features/meeting-flow/ui/components/steps/scope-card.tsx
git show --stat HEAD
```

Expected: the six new files and four deletions in the commit; `meeting-flow.tsx` still modified in the working tree (the controller commits its hunks).

---

### Task 6: The trade sheet, mounted by the view

**Files:**
- Create, under `src/features/meeting-flow/ui/components/trade-sheet/`: `trade-sheet-host.tsx`, `trade-sheet-body.tsx`, `trade-sheet-header.tsx`, `trade-sheet-footer.tsx`, `trade-photo.tsx`, `outcome-line.tsx`, `scope-tile-group.tsx`, `scope-tile.tsx`, `orphan-item-chips.tsx`, `reason-chip-group.tsx`, `trade-note-field.tsx`, `pairing-card.tsx`
- Modify: `src/features/meeting-flow/ui/views/meeting-flow.tsx` (mount `<TradeSheetHost />` after `<RescheduleDialog />`; foreign hunks, so edit but do not commit)

**Interfaces:**
- Consumes: Task 4 `ResponsiveSheet`; Task 3 hooks; Task 2 `findTradeSelection`, `itemCount`, `isTradeSelected`, `selectedItemIds`, `countSelection`, `orphanItems`, `diffIds`, `formatSelectionSummary`; Task 1 `TRADE_PHOTOS`, `SCOPE_PHOTOS`, `TRADE_OUTCOMES`, `TRADE_PAIRINGS`, `SPECIALTIES_COPY`; `PlaceholderSlot` from `@/features/meeting-flow/ui/components/steps/who-we-are/placeholder-slot` (import only; never edit that file); `meetingPainTypes` from `@/shared/constants/enums`; `COLLAPSE_HEIGHT_VARIANTS`, `COLLAPSE_TRANSITION` from `@/shared/constants/motion`; `TRADE_CATEGORY_LABELS`; shadcn `ToggleGroup`, `ToggleGroupItem`, `Button`, `Badge`, `Label`, `Textarea`.
- Produces: `<TradeSheetHost />`; `<ScopeTile mode="toggle" id name unit photo? focused? />` and `<ScopeTile mode="open" pressed onOpen id name unit photo? />` (Task 9 uses the open mode); every `ToggleGroupItem` for a scope carries `data-scope-id`.

- [ ] **Step 1: Host, body, header, footer, photo, outcome line**

`trade-sheet-host.tsx`:

```tsx
'use client'

import type { TradeCategory } from '@/features/meeting-flow/constants/trade-categories'
import { useCallback, useState } from 'react'
import { TRADE_CATEGORY_LABELS } from '@/features/meeting-flow/constants/trade-categories'
import { useTradeSelection, useTradeSheet } from '@/features/meeting-flow/contexts/trade-selection-context'
import { findTradeSelection } from '@/features/meeting-flow/lib/trade-selection'
import { TradeSheetBody } from '@/features/meeting-flow/ui/components/trade-sheet/trade-sheet-body'
import { TradeSheetFooter } from '@/features/meeting-flow/ui/components/trade-sheet/trade-sheet-footer'
import { ResponsiveSheet } from '@/shared/components/dialogs/sheets/responsive-sheet'

/**
 * Mounted once by the meeting-flow view. Every opener on every step goes
 * through `useTradeSheet().openTrade`, so this is the only place a trade sheet
 * exists. The body is keyed on the trade id and nothing else: a toggle inside
 * never remounts it. The last trade stays rendered while the primitive
 * animates closed, so the panel does not blank mid-exit.
 */
export function TradeSheetHost() {
  const { openTradeId, focusScopeId, closeTrade } = useTradeSheet()
  const { selections, catalog } = useTradeSelection()

  const [shownTradeId, setShownTradeId] = useState<string | null>(openTradeId)
  if (openTradeId !== null && openTradeId !== shownTradeId) {
    setShownTradeId(openTradeId)
  }

  const trade = shownTradeId ? catalog.tradesById.get(shownTradeId) : undefined
  const stored = shownTradeId ? findTradeSelection(selections, shownTradeId) : undefined
  const title = trade?.name ?? stored?.tradeName ?? ''
  const description = trade?.type ? TRADE_CATEGORY_LABELS[trade.type as TradeCategory] : undefined

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      closeTrade()
    }
  }, [closeTrade])

  const handleOpenAutoFocus = useCallback((event: Event) => {
    if (focusScopeId) {
      event.preventDefault()
    }
  }, [focusScopeId])

  return (
    <ResponsiveSheet
      contentClassName="sm:max-w-xl"
      description={description}
      footer={shownTradeId ? <TradeSheetFooter tradeId={shownTradeId} /> : undefined}
      open={openTradeId !== null}
      title={title}
      onOpenAutoFocus={handleOpenAutoFocus}
      onOpenChange={handleOpenChange}
    >
      {shownTradeId && <TradeSheetBody key={shownTradeId} focusScopeId={focusScopeId} tradeId={shownTradeId} />}
    </ResponsiveSheet>
  )
}
```

`trade-sheet-body.tsx`:

```tsx
'use client'

import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { TRADE_OUTCOMES } from '@/features/meeting-flow/constants/trade-outcomes'
import { TRADE_PHOTOS } from '@/features/meeting-flow/constants/trade-photos'
import { useTradeSelection } from '@/features/meeting-flow/contexts/trade-selection-context'
import { formatSelectionSummary } from '@/features/meeting-flow/lib/format-selection-summary'
import { countSelection, findTradeSelection, itemCount, orphanItems, selectedItemIds } from '@/features/meeting-flow/lib/trade-selection'
import { OrphanItemChips } from '@/features/meeting-flow/ui/components/trade-sheet/orphan-item-chips'
import { OutcomeLine } from '@/features/meeting-flow/ui/components/trade-sheet/outcome-line'
import { PairingCard } from '@/features/meeting-flow/ui/components/trade-sheet/pairing-card'
import { ReasonChipGroup } from '@/features/meeting-flow/ui/components/trade-sheet/reason-chip-group'
import { ScopeTileGroup } from '@/features/meeting-flow/ui/components/trade-sheet/scope-tile-group'
import { TradeNoteField } from '@/features/meeting-flow/ui/components/trade-sheet/trade-note-field'
import { TradePhoto } from '@/features/meeting-flow/ui/components/trade-sheet/trade-photo'
import { TradeSheetHeader } from '@/features/meeting-flow/ui/components/trade-sheet/trade-sheet-header'

interface TradeSheetBodyProps {
  tradeId: string
  focusScopeId: string | null
}

/** Everything the agent edits for one trade. Re-renders on toggles; children take primitive props and reconcile in place. */
export function TradeSheetBody({ tradeId, focusScopeId }: TradeSheetBodyProps) {
  const { selections, catalog } = useTradeSelection()
  const trade = catalog.tradesById.get(tradeId)
  const group = catalog.scopesByTrade.get(tradeId)
  const selection = findTradeSelection(selections, tradeId)
  const tradeName = trade?.name ?? selection?.tradeName ?? ''
  const slug = trade?.slug

  return (
    <div className="flex flex-col gap-5">
      <TradeSheetHeader inCatalog={trade !== undefined} summary={formatSelectionSummary(countSelection(selection, group))} />
      <TradePhoto label={tradeName} photo={slug ? TRADE_PHOTOS[slug] : undefined} />
      <OutcomeLine text={slug ? TRADE_OUTCOMES[slug] : undefined} />
      <ScopeTileGroup
        emptyText={group && group.addons.length > 0 ? SPECIALTIES_COPY.sheet.noScopesAddonsOnly : SPECIALTIES_COPY.sheet.noScopes}
        focusScopeId={focusScopeId}
        scopes={group?.scopes ?? []}
        selectedIds={selectedItemIds(selection)}
        tradeId={tradeId}
      />
      <OrphanItemChips items={orphanItems(selection, group)} tradeId={tradeId} />
      <ReasonChipGroup selectedReasons={selection?.painPoints ?? []} tradeId={tradeId} />
      <TradeNoteField note={selection?.notes ?? ''} tradeId={tradeId} tradeName={tradeName} />
      {slug && <PairingCard selected={itemCount(selection) > 0} slug={slug} />}
    </div>
  )
}
```

`trade-sheet-header.tsx`:

```tsx
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { Badge } from '@/shared/components/ui/badge'

interface TradeSheetHeaderProps {
  inCatalog: boolean
  summary: string
}

/** The live count line under the primitive's title. Updates in place on every toggle. */
export function TradeSheetHeader({ inCatalog, summary }: TradeSheetHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p aria-live="polite" className="text-base font-medium">{summary}</p>
      {!inCatalog && <Badge variant="outline">{SPECIALTIES_COPY.sheet.notInCatalog}</Badge>}
    </div>
  )
}
```

`trade-sheet-footer.tsx`:

```tsx
'use client'

import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeSelection, useTradeSheet } from '@/features/meeting-flow/contexts/trade-selection-context'
import { isTradeSelected } from '@/features/meeting-flow/lib/trade-selection'
import { Button } from '@/shared/components/ui/button'

interface TradeSheetFooterProps {
  tradeId: string
}

/** Remove is reversible (open the trade and pick again), so it needs no confirm dialog. */
export function TradeSheetFooter({ tradeId }: TradeSheetFooterProps) {
  const { selections, clearTrade } = useTradeSelection()
  const { closeTrade } = useTradeSheet()
  const selected = isTradeSelected(selections, tradeId)

  return (
    <div className="flex items-center justify-between gap-3">
      {selected
        ? <Button variant="ghost" onClick={() => clearTrade(tradeId)}>{SPECIALTIES_COPY.sheet.remove}</Button>
        : <span aria-hidden />}
      <Button onClick={closeTrade}>{SPECIALTIES_COPY.sheet.done}</Button>
    </div>
  )
}
```

`trade-photo.tsx`:

```tsx
import type { TradePhoto as TradePhotoData } from '@/features/meeting-flow/types'
import Image from 'next/image'
import { PlaceholderSlot } from '@/features/meeting-flow/ui/components/steps/who-we-are/placeholder-slot'

interface TradePhotoProps {
  /** Trade name, shown inside the placeholder when there is no photo. */
  label: string
  photo?: TradePhotoData
}

/**
 * 16:10 frame. A size container so the placeholder's `cq*` units resolve against it. No shadow here, so the clip is allowed.
 * `PlaceholderSlot` is drawn for the dark presentation ground; the class override recolors it for the app surface.
 */
export function TradePhoto({ label, photo }: TradePhotoProps) {
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-muted [container-type:size]">
      {photo
        ? <Image alt={photo.alt} className="object-cover" fill sizes="(min-width: 1024px) 36rem, 100vw" src={photo.src} />
        : <PlaceholderSlot className="absolute inset-0 rounded-lg border-muted-foreground/30 text-muted-foreground" label={label} />}
    </div>
  )
}
```

`outcome-line.tsx`:

```tsx
interface OutcomeLineProps {
  text?: string
}

/** The playbook's outcome line. Trades without one render nothing; no line is invented. */
export function OutcomeLine({ text }: OutcomeLineProps) {
  if (!text) {
    return null
  }
  return <p className="border-l-2 border-primary pl-3 text-base leading-relaxed text-balance">{text}</p>
}
```

- [ ] **Step 2: Scope tiles, orphan chips, reasons, note, pairing**

`scope-tile.tsx`. One card, two modes, same markup. In `toggle` mode the pressed state comes from Radix (`data-state="on"`); in `open` mode it is mirrored through `aria-pressed` and a click opens the sheet.

```tsx
'use client'

import type { TradePhoto } from '@/features/meeting-flow/types'
import { CheckIcon } from 'lucide-react'
import Image from 'next/image'
import { memo } from 'react'
import { Button } from '@/shared/components/ui/button'
import { ToggleGroupItem } from '@/shared/components/ui/toggle-group'
import { cn } from '@/shared/lib/utils'

interface ScopeTileBaseProps {
  id: string
  name: string
  unit: string
  photo?: TradePhoto
  /** Highlight for the scope the sheet was opened on. Outline, never ring, inside the scroller. */
  focused?: boolean
}

interface ScopeTileToggleProps extends ScopeTileBaseProps {
  mode: 'toggle'
}

interface ScopeTileOpenProps extends ScopeTileBaseProps {
  mode: 'open'
  pressed: boolean
  onOpen: (scopeId: string) => void
}

type ScopeTileProps = ScopeTileToggleProps | ScopeTileOpenProps

function ScopeTileImpl(props: ScopeTileProps) {
  const { id, name, unit, photo, focused = false } = props
  const className = cn(
    'group h-auto min-h-11 w-full flex-col items-stretch justify-start gap-2 rounded-lg border border-input bg-card p-2 text-left whitespace-normal',
    'first:rounded-lg last:rounded-lg',
    'data-[state=on]:border-primary data-[state=on]:bg-primary/5 data-[state=on]:text-foreground',
    'aria-pressed:border-primary aria-pressed:bg-primary/5',
    focused && 'outline-2 outline-primary -outline-offset-2',
  )

  const content = (
    <>
      <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-md bg-muted">
        {photo
          ? <Image alt={photo.alt} className="object-cover" fill sizes="(min-width: 640px) 12rem, 45vw" src={photo.src} />
          : (
              <span className="absolute inset-0 grid place-items-center text-sm font-medium tracking-wide text-muted-foreground uppercase">
                {unit}
              </span>
            )}
        <span
          aria-hidden
          className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full border bg-background/90 text-primary opacity-0 transition-opacity group-aria-pressed:opacity-100 group-data-[state=on]:opacity-100"
        >
          <CheckIcon className="size-3" strokeWidth={3} />
        </span>
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-base leading-tight font-medium">{name}</span>
        {photo && <span className="text-sm text-muted-foreground">{unit}</span>}
      </span>
    </>
  )

  if (props.mode === 'toggle') {
    return (
      <ToggleGroupItem className={className} data-scope-id={id} value={id}>
        {content}
      </ToggleGroupItem>
    )
  }

  return (
    <Button aria-pressed={props.pressed} className={className} data-scope-id={id} variant="outline" onClick={() => props.onOpen(id)}>
      {content}
    </Button>
  )
}

export const ScopeTile = memo(ScopeTileImpl)
```

`scope-tile-group.tsx`:

```tsx
'use client'

import type { ScopeOrAddon } from '@/shared/services/providers/notion/lib/scopes/schema'
import { useEffect, useRef } from 'react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { SCOPE_PHOTOS } from '@/features/meeting-flow/constants/trade-photos'
import { useTradeSelection } from '@/features/meeting-flow/contexts/trade-selection-context'
import { diffIds } from '@/features/meeting-flow/lib/trade-selection'
import { ScopeTile } from '@/features/meeting-flow/ui/components/trade-sheet/scope-tile'
import { ToggleGroup } from '@/shared/components/ui/toggle-group'

interface ScopeTileGroupProps {
  tradeId: string
  scopes: ScopeOrAddon[]
  selectedIds: string[]
  focusScopeId: string | null
  emptyText: string
}

/**
 * `ToggleGroup type="multiple"`: Radix owns pressed state, roving focus, and
 * `aria-pressed`. `onValueChange` hands back the whole array; the diff is the
 * one id the user touched, and only that item's pressed state changes.
 */
export function ScopeTileGroup({ tradeId, scopes, selectedIds, focusScopeId, emptyText }: ScopeTileGroupProps) {
  const { toggleItem } = useTradeSelection()
  const groupRef = useRef<HTMLDivElement>(null)

  // The body is keyed on the trade id, so this runs once per open. The host
  // cancelled Radix's own autofocus when a focus scope was requested.
  useEffect(() => {
    if (!focusScopeId) {
      return
    }
    const tile = groupRef.current?.querySelector<HTMLElement>(`[data-scope-id="${CSS.escape(focusScopeId)}"]`)
    tile?.scrollIntoView({ block: 'center' })
    tile?.focus()
  }, [focusScopeId])

  function handleValueChange(next: string[]) {
    const { added, removed } = diffIds(selectedIds, next)
    for (const id of [...added, ...removed]) {
      const scope = scopes.find(entry => entry.id === id)
      if (scope) {
        toggleItem(tradeId, { id: scope.id, label: scope.name })
      }
    }
  }

  return (
    <section aria-labelledby={`scopes-${tradeId}`} className="flex flex-col gap-2">
      <h3 id={`scopes-${tradeId}`} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {SPECIALTIES_COPY.sheet.work}
      </h3>
      {scopes.length === 0
        ? <p className="text-base text-muted-foreground">{emptyText}</p>
        : (
            <ToggleGroup
              ref={groupRef}
              className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3"
              type="multiple"
              value={selectedIds}
              onValueChange={handleValueChange}
            >
              {scopes.map(scope => (
                <ScopeTile
                  key={scope.id}
                  focused={scope.id === focusScopeId}
                  id={scope.id}
                  mode="toggle"
                  name={scope.name}
                  photo={SCOPE_PHOTOS[scope.name]}
                  unit={scope.unitOfPricing}
                />
              ))}
            </ToggleGroup>
          )}
    </section>
  )
}
```

`orphan-item-chips.tsx`:

```tsx
'use client'

import type { SelectionItem } from '@/features/meeting-flow/types'
import { XIcon } from 'lucide-react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeSelection } from '@/features/meeting-flow/contexts/trade-selection-context'
import { Button } from '@/shared/components/ui/button'

interface OrphanItemChipsProps {
  tradeId: string
  items: SelectionItem[]
}

/** Stored items the current catalog no longer lists for this trade. Shown by stored label, removable, never dropped silently. */
export function OrphanItemChips({ tradeId, items }: OrphanItemChipsProps) {
  const { toggleItem } = useTradeSelection()

  if (items.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{SPECIALTIES_COPY.sheet.orphanHint}</p>
      <ul className="flex flex-wrap gap-2">
        {items.map(item => (
          <li key={item.id}>
            <Button className="h-11" size="sm" variant="outline" onClick={() => toggleItem(tradeId, item)}>
              {item.label}
              <XIcon aria-hidden className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

`reason-chip-group.tsx`:

```tsx
'use client'

import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeSelection } from '@/features/meeting-flow/contexts/trade-selection-context'
import { diffIds } from '@/features/meeting-flow/lib/trade-selection'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'
import { meetingPainTypes } from '@/shared/constants/enums'

interface ReasonChipGroupProps {
  tradeId: string
  selectedReasons: string[]
}

/** The eleven `meetingPainTypes`, per trade, written to that trade's `painPoints`. */
export function ReasonChipGroup({ tradeId, selectedReasons }: ReasonChipGroupProps) {
  const { toggleReason } = useTradeSelection()

  function handleValueChange(next: string[]) {
    const { added, removed } = diffIds(selectedReasons, next)
    for (const reason of [...added, ...removed]) {
      toggleReason(tradeId, reason)
    }
  }

  return (
    <section aria-labelledby={`reasons-${tradeId}`} className="flex flex-col gap-2">
      <h3 id={`reasons-${tradeId}`} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {SPECIALTIES_COPY.sheet.reasons}
      </h3>
      <ToggleGroup className="flex w-full flex-wrap gap-2" type="multiple" value={selectedReasons} onValueChange={handleValueChange}>
        {meetingPainTypes.map(reason => (
          <ToggleGroupItem
            key={reason}
            className="h-auto min-h-11 flex-none rounded-full border border-input px-3.5 py-2 text-base whitespace-normal first:rounded-full last:rounded-full data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-foreground"
            value={reason}
          >
            {reason}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </section>
  )
}
```

`trade-note-field.tsx`. Writes to the model on every change: the model is local state and its server write is already debounced, and a blur-only write loses the note when Escape or an overlay click unmounts the textarea before `blur` fires.

```tsx
'use client'

import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeSelection } from '@/features/meeting-flow/contexts/trade-selection-context'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'

interface TradeNoteFieldProps {
  tradeId: string
  tradeName: string
  note: string
}

export function TradeNoteField({ tradeId, tradeName, note }: TradeNoteFieldProps) {
  const { setNote } = useTradeSelection()
  const id = `trade-note-${tradeId}`

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase" htmlFor={id}>
        {SPECIALTIES_COPY.sheet.note}
      </Label>
      <Textarea
        id={id}
        className="min-h-20 resize-none text-base"
        placeholder={SPECIALTIES_COPY.sheet.notePlaceholder(tradeName)}
        rows={2}
        value={note}
        onChange={event => setNote(tradeId, event.target.value)}
      />
    </div>
  )
}
```

`pairing-card.tsx`. Not `AnimatedCollapsibleContent`: that primitive needs a Radix `Collapsible` with a trigger, and this card has none; the shared motion tokens keep the feel identical.

```tsx
'use client'

import { AnimatePresence, motion } from 'motion/react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { TRADE_PAIRINGS } from '@/features/meeting-flow/constants/trade-pairings'
import { useTradeSelection, useTradeSheet } from '@/features/meeting-flow/contexts/trade-selection-context'
import { isTradeSelected } from '@/features/meeting-flow/lib/trade-selection'
import { Button } from '@/shared/components/ui/button'
import { COLLAPSE_HEIGHT_VARIANTS, COLLAPSE_TRANSITION } from '@/shared/constants/motion'

interface PairingCardProps {
  slug: string
  selected: boolean
}

/** The playbook pairing for this trade. Appears once the trade is selected; `initial={false}` so it never replays on unrelated updates. */
export function PairingCard({ slug, selected }: PairingCardProps) {
  const { selections, catalog } = useTradeSelection()
  const { openTrade } = useTradeSheet()
  const pairing = TRADE_PAIRINGS[slug]
  const paired = pairing ? catalog.tradesBySlug.get(pairing.pairedSlug) : undefined
  const visible = selected && pairing && paired ? { pairing, paired } : null
  const pairedSelected = paired ? isTradeSelected(selections, paired.id) : false

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          key="pairing"
          animate={COLLAPSE_HEIGHT_VARIANTS.animate}
          className="overflow-hidden"
          exit={COLLAPSE_HEIGHT_VARIANTS.exit}
          initial={COLLAPSE_HEIGHT_VARIANTS.initial}
          transition={COLLAPSE_TRANSITION}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed bg-muted/40 px-3 py-2.5 text-base">
            <p>
              {pairedSelected
                ? <><strong>{visible.paired.name}</strong> {SPECIALTIES_COPY.sheet.pairedOnProject}</>
                : <>{SPECIALTIES_COPY.sheet.pairsWith} <strong>{visible.paired.name}</strong>: {visible.pairing.reason}.</>}
            </p>
            <Button size="sm" variant={pairedSelected ? 'ghost' : 'default'} onClick={() => openTrade(visible.paired.id)}>
              {pairedSelected ? SPECIALTIES_COPY.sheet.open : `${SPECIALTIES_COPY.sheet.open} ${visible.paired.name}`}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 3: Mount the host in the view**

In `src/features/meeting-flow/ui/views/meeting-flow.tsx`, add `import { TradeSheetHost } from '@/features/meeting-flow/ui/components/trade-sheet/trade-sheet-host'` and render `<TradeSheetHost />` on the line after `<RescheduleDialog />`, inside `StageFrame`. It has no props and portals its content, so its position only needs to be inside `TradeSelectionProvider`. Touch nothing else in the file; confirm with `git diff` that the foreign `toPresentationAgent` hunks are still present.

- [ ] **Step 4: Type-check and lint**

```bash
pnpm tsc
pnpm exec eslint --fix src/features/meeting-flow/ui/components/trade-sheet src/features/meeting-flow/ui/views/meeting-flow.tsx
```

Expected: clean. If `ToggleGroup` rejects `ref`, the shadcn wrapper spreads props onto the Radix root and React 19 forwards `ref` as a prop, so check the wrapper was not edited; do not change `src/shared/components/ui/toggle-group.tsx`.

- [ ] **Step 5: Rendered check (the spec's §6 items 1 to 5 at laptop width)**

Never touch the dev server. Build and inject fresh CSS after each load (Global Constraints). Log in, open the dev meeting `?step=2` at 1440×900.

0. The placeholder slot's label is visible on the muted frame (`offsetWidth > 0`, computed `color` is not white); report its computed border color.
1. Click the "Roof & Gutters" tile. A right-side sheet opens titled "Roof & Gutters", description "Energy Efficiency", summary "Not on the project yet", the placeholder slot (no photo for this slug), the roofing outcome line, four scope tiles showing their unit ("bsq"), the eleven reason chips, the note, and a footer with only "Done". URL has `?trade=<id>`.
2. Record identity, then toggle: in `browser_evaluate`, run `window.__probe = document.querySelectorAll('[data-scope-id]')[0]`. Click the second scope tile. Then evaluate `document.querySelectorAll('[data-scope-id]')[0] === window.__probe` → `true`, and the second tile has `data-state="on"` and `aria-pressed="true"`. The summary reads "1 scope". The page behind did not scroll: compare the page scroller's `scrollTop` before and after. The pairing card appeared below the note ("Pairs well with Attic & Basement: attic is already accessible."); "Remove from project" appeared in the footer.
3. Toggle a reason chip: only its `data-state` changes; the probe identity still holds; the pairing card did not re-animate (its computed `height` is stable across the toggle).
4. Type a note, then press Escape (not Done), and reopen the trade: the note is still there. Close with "Done": the sheet closes, the "Roof & Gutters" tile is pressed with badge "1", the project strip shows the chip. After 1 second, the meeting query refetches; reload the page: the tile is still pressed (persisted) and `flowStateJSON.tradeSelections` on the server has one entry with one scope `{ id, label }`, one reason, and the note (check with `browser_network_requests` on the `getByIdWithJoins` response, or by reopening the sheet and reading the state).
5. Open "Framing": the sheet shows "No scopes in the catalog yet." and no pairing card. Close with Escape: focus returns to the Framing tile (`document.activeElement.textContent` includes "Framing"). The tile is not pressed; nothing was written (no `crud.update` request in the network log).
6. Click "Open Attic & Basement" inside the Roof sheet: the sheet stays open and now shows Attic & Basement; URL updated.
6b. Keyboard coexistence with the shell's key owner: with the sheet open, type `3` in the note field, and press ←/→ while focus is on a reason chip: the step stays on 2 and the arrows move focus between chips (Radix roving focus). Press Escape: only the sheet closes; the step, present mode, and the meeting panel are unchanged. Open the meeting panel from the inspector rail, then open a trade: both can be open, and Escape closes the sheet first.
7. Both color schemes: `emulateMedia({ colorScheme: 'dark' })`, repeat item 1 visually. Screenshots to `.playwright-mcp/spec-t6-sheet-{light,dark}.png`.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(meeting-flow): the trade sheet: ResponsiveSheet host keyed on the trade, ToggleGroup scopes and reasons, photo or placeholder, playbook outcome and pairing, note, footer

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -- src/features/meeting-flow/ui/components/trade-sheet
git show --stat HEAD
```

Expected: the twelve trade-sheet files in the commit; `meeting-flow.tsx` still modified in the working tree (the controller commits its hunk).

---

### Task 7: Responsive pass, the spec's verification list, and design audits

**Files:**
- Modify (fixes only, no new components): any file created in Tasks 1 to 6. `types/index.ts` and `meeting-flow.tsx` stay uncommitted by you, as everywhere in this plan.

**Interfaces:**
- Consumes: everything above.
- Produces: the eight checks of spec §6 passing at 1440×900, 1024×768, 820×1180, and 390×844 in both color schemes; audit findings fixed at the narrowest correct level; screenshots under `.playwright-mcp/`.

- [ ] **Step 1: Fresh CSS, not a fresh server**

Never touch the dev server. Build the CSS with the Global Constraints tool, log in, open the dev meeting `?step=2`, and inject the CSS after every load.

- [ ] **Step 2: The capture and measure loop**

For each viewport (`browser_resize`) and each scheme (`emulateMedia`), run one `browser_run_code_unsafe` that: loads the step, waits for the catalog heading, measures and returns JSON, then screenshots to `.playwright-mcp/spec-t7-<w>x<h>-<scheme>.png`. Measurements to return, read before looking at pictures:

```js
// inside page.evaluate
(() => {
  const scroller = document.querySelector('h1.sr-only')?.parentElement
  const tiles = [...document.querySelectorAll('button[aria-pressed]')]
  const rects = tiles.map(t => t.getBoundingClientRect())
  return {
    bodyScrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    scrollerOverflowX: scroller ? scroller.scrollWidth - scroller.clientWidth : null,
    minTileHeight: Math.min(...rects.map(r => r.height)),
    tilesUnder44: rects.filter(r => r.height < 44).length,
    lastTileBottom: Math.max(...rects.map(r => r.bottom)),
    capsuleTop: [...document.querySelectorAll('button')].find(b => /next/i.test(b.getAttribute('aria-label') ?? b.textContent ?? ''))?.getBoundingClientRect().top ?? null,
    bg: getComputedStyle(document.body).backgroundColor,
  }
})()
```

Pass conditions: `bodyScrollWidth <= innerWidth`, `scrollerOverflowX === 0`, `tilesUnder44 === 0`. Scroll the page scroller to its bottom and confirm the last tile's bottom sits above `capsuleTop` (the shell's `--stage-inset-b` clearance). If the selector does not find the capsule's Next button, locate the capsule another way and report the selector you used.

- [ ] **Step 3: Sheet and drawer at every width (spec §6 items 1, 4, 6, 7, 8)**

At each viewport:

- Open "Roof & Gutters". At 1440 and 1024 it is a right-side Sheet whose content box is at most `36rem` wide with three scope tiles per row. At 820 and 390 it is a bottom Drawer with the drag handle, no taller than 80% of the viewport, two tiles per row (one at 390 if the tiles overflow; then change `grid-cols-2` to `grid-cols-1 min-[420px]:grid-cols-2` in `scope-tile-group.tsx`).
- Page height and scroll position are unchanged across open and close: read `scroller.scrollHeight` and `scroller.scrollTop` before opening, after opening, after closing; all three equal.
- Escape closes and focus returns to the opener at every width; in the Drawer, drag the handle down (`browser_drag` from the handle to 300px lower) and the drawer closes.
- Reload with `?trade=<id>` in the URL: the sheet is open on load (a one-frame Sheet-then-Drawer flip below `lg` is expected and acceptable).
- Filter text still narrows tiles and categories at every width.

- [ ] **Step 4: Persisted shape (spec §6 item 5)**

Open Roof & Gutters, pick two scopes and one reason, type a note, pick one scope and then unpick it on "Framing" (zero items), close. Wait 1.5 seconds. Read the `meetingsRouter.reads.getByIdWithJoins` response in `browser_network_requests`: `flowStateJSON.tradeSelections` has exactly one entry (Roof), `selectedScopes` are two `{ id, label }` objects, `painPoints` has one string, `notes` is the typed text. No Framing entry.

- [ ] **Step 5: No remount, no animation replay (spec §6 item 2), tablet and laptop**

Repeat Task 6 Step 5 item 2 at 820×1180: DOM identity of an untouched sibling holds across toggles of a scope and a reason; the pairing card's height is stable across the reason toggle.

- [ ] **Step 6: Audits**

1. `/impeccable polish src/features/meeting-flow/ui/components/trade-sheet src/features/meeting-flow/ui/components/steps/specialties`: one batched inspection round (desktop and mobile together), fix everything it shows in one batch, at most one confirmation round. Classify each drift (missing token, one-off, conceptual mismatch, local defect) and fix at the narrowest correct level.
2. `web-design-guidelines` review of the same two directories plus `responsive-sheet.tsx`; fix real findings, skip ones the plan already decided (for example `aria-pressed` buttons that open rather than toggle are intentional and labeled by their text).
3. Re-run `pnpm tsc` and `pnpm lint` (whole repo) after fixes.

- [ ] **Step 7: Commit**

```bash
git commit -m "fix(meeting-flow): specialties responsive and audit fixes

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -- <the exact files changed in this task>
git show --stat HEAD
```

Then the user verifies by hand on the laptop and the tablet (the how-to's Hands-on gate). That check, not this task, closes the build.

---

## USER GATE

The two tasks below depend on rulings from the spec's §9 table. They do not start until the user has run the corresponding item and said so. Everything above ships without them: the page shows the start hint instead of lead panels, and the sheet offers scopes but not add-ons.

**Before Task 8 the user runs §9 item 3:** decide whether add-ons chosen here should flow into SOW sections through `build-proposal-defaults.ts` unchanged (they will, because add-ons are stored in `selectedScopes`), or whether that mapper should split them. The UI build does not touch that file either way.

**Before Task 9 the user runs §9 item 2:** get the lead's requested trades onto the meeting flow's customer. Resolved in the repo on 2026-09-13: `leadMetaSchema.requestedTrades` (`{ tradeId, scopeIds[] }[]`, Notion ids) is stored in `customer_lead_attribution.captureJSON`, and `getByIdWithJoins` returns `CustomerWithProfile`, which does not join attribution. The user decides where the field lands (for example extending the meeting join with `attribution` so the customer is a `CustomerFullView`). Task 9 reads it through one edge mapper and nothing else.

---

### Task 8 (USER GATE, §9 item 3): Add-on chips in the sheet

**Files:**
- Create: `src/features/meeting-flow/ui/components/trade-sheet/addon-chip-group.tsx`
- Modify: `src/features/meeting-flow/ui/components/trade-sheet/trade-sheet-body.tsx` (render the group between `OrphanItemChips` and `ReasonChipGroup`)

**Interfaces:**
- Consumes: Task 3 `useTradeSelection().toggleItem`; Task 2 `diffIds`; `TradeScopeGroup.addons`.
- Produces: `<AddonChipGroup tradeId addons selectedIds />`.

- [ ] **Step 1: The component**

```tsx
'use client'

import type { ScopeOrAddon } from '@/shared/services/providers/notion/lib/scopes/schema'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeSelection } from '@/features/meeting-flow/contexts/trade-selection-context'
import { diffIds } from '@/features/meeting-flow/lib/trade-selection'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'

interface AddonChipGroupProps {
  tradeId: string
  addons: ScopeOrAddon[]
  /** Every selected item id for the trade; the group keeps only the add-on ids as its value. */
  selectedIds: string[]
}

/** Add-ons are stored beside scopes in `selectedScopes`, so an add-on alone selects the trade. */
export function AddonChipGroup({ tradeId, addons, selectedIds }: AddonChipGroupProps) {
  const { toggleItem } = useTradeSelection()
  const addonIds = new Set(addons.map(addon => addon.id))
  const value = selectedIds.filter(id => addonIds.has(id))

  if (addons.length === 0) {
    return null
  }

  function handleValueChange(next: string[]) {
    const { added, removed } = diffIds(value, next)
    for (const id of [...added, ...removed]) {
      const addon = addons.find(entry => entry.id === id)
      if (addon) {
        toggleItem(tradeId, { id: addon.id, label: addon.name })
      }
    }
  }

  return (
    <section aria-labelledby={`addons-${tradeId}`} className="flex flex-col gap-2">
      <h3 id={`addons-${tradeId}`} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {SPECIALTIES_COPY.sheet.addons}
      </h3>
      <ToggleGroup className="flex w-full flex-wrap gap-2" type="multiple" value={value} onValueChange={handleValueChange}>
        {addons.map(addon => (
          <ToggleGroupItem
            key={addon.id}
            className="h-auto min-h-11 flex-none rounded-full border border-dashed border-input px-3.5 py-2 text-base whitespace-normal first:rounded-full last:rounded-full data-[state=on]:border-solid data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-foreground"
            data-scope-id={addon.id}
            value={addon.id}
          >
            {addon.name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </section>
  )
}
```

- [ ] **Step 2: Wire it into the body**

In `trade-sheet-body.tsx`, import `AddonChipGroup` and render `<AddonChipGroup addons={group?.addons ?? []} selectedIds={selectedItemIds(selection)} tradeId={tradeId} />` between `OrphanItemChips` and `ReasonChipGroup`.

- [ ] **Step 3: Verify**

`pnpm tsc`, `pnpm exec eslint --fix` on both files. Rendered: open "Tile" (no scopes, one add-on): the body reads "No scopes in the catalog yet. Add-ons only." and the add-on chip; pressing it selects the trade (tile pressed with badge "1", "Remove from project" appears). Open "Roof & Gutters", pick one scope and one add-on: summary reads "1 scope · 1 add-on"; after the debounce the persisted `selectedScopes` has both ids with labels. DOM identity check across an add-on toggle holds.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(meeting-flow): add-on chips in the trade sheet, stored beside scopes

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -- src/features/meeting-flow/ui/components/trade-sheet/addon-chip-group.tsx src/features/meeting-flow/ui/components/trade-sheet/trade-sheet-body.tsx
git show --stat HEAD
```

---

### Task 9 (USER GATE, §9 item 2): Lead panels

**Files:**
- Create: `src/features/meeting-flow/lib/get-requested-trades.ts`
- Create: `src/features/meeting-flow/ui/components/steps/specialties/lead-panel.tsx`
- Create: `src/features/meeting-flow/ui/components/steps/specialties/lead-panels.tsx`
- Modify: `src/features/meeting-flow/ui/components/steps/specialties/index.tsx` (derive lead trades; pass `hasLead`; render panels or the hint)
- Modify: `src/features/meeting-flow/ui/views/meeting-flow.tsx` (pass `flowContext` to `SpecialtiesStep`; if the file still holds foreign hunks, edit but do not commit)

**Interfaces:**
- Consumes: Task 2 `deriveLeadTrades`; Task 6 `ScopeTile mode="open"`, `TradePhoto`, `OutcomeLine`, `PairingCard`; Task 3 hooks; `MeetingFlowContext`.
- Produces: `getRequestedTrades(customer): { tradeId: string }[]`; `<LeadPanels trades />`; `<SpecialtiesStep flowContext />`.

- [ ] **Step 1: The one edge mapper**

Written against the shape the ruling is expected to produce: the meeting join extended so the customer carries `attribution` (`CustomerFullView`). If the user lands the field elsewhere, this file is the only one that changes.

```ts
import type { CustomerFullView, CustomerWithProfile } from '@/shared/entities/customers/dal/server/queries'

/** The lead's human-confirmed requested trades (Notion ids), or none. The only place the UI knows where that field lives. */
export function getRequestedTrades(customer: CustomerWithProfile | null): { tradeId: string }[] {
  const attribution = (customer as Partial<CustomerFullView> | null)?.attribution
  return attribution?.captureJSON?.requestedTrades ?? []
}
```

If `pnpm tsc` rejects `captureJSON` or `requestedTrades` on that path, stop and report BLOCKED with the type error; the ruling has not landed the field where this mapper reads it.

- [ ] **Step 2: The panels**

`lead-panel.tsx`:

```tsx
'use client'

import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'
import { useCallback } from 'react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { TRADE_OUTCOMES } from '@/features/meeting-flow/constants/trade-outcomes'
import { SCOPE_PHOTOS, TRADE_PHOTOS } from '@/features/meeting-flow/constants/trade-photos'
import { useTradeSelection, useTradeSheet } from '@/features/meeting-flow/contexts/trade-selection-context'
import { findTradeSelection, itemCount, selectedItemIds } from '@/features/meeting-flow/lib/trade-selection'
import { OutcomeLine } from '@/features/meeting-flow/ui/components/trade-sheet/outcome-line'
import { PairingCard } from '@/features/meeting-flow/ui/components/trade-sheet/pairing-card'
import { ScopeTile } from '@/features/meeting-flow/ui/components/trade-sheet/scope-tile'
import { TradePhoto } from '@/features/meeting-flow/ui/components/trade-sheet/trade-photo'
import { Button } from '@/shared/components/ui/button'

interface LeadPanelProps {
  trade: Trade
}

/** One requested trade, led by the reason. Every scope is shown; tapping one opens the sheet on it. Nothing here toggles. */
export function LeadPanel({ trade }: LeadPanelProps) {
  const { selections, catalog } = useTradeSelection()
  const { openTrade } = useTradeSheet()
  const selection = findTradeSelection(selections, trade.id)
  const selected = new Set(selectedItemIds(selection))
  const count = itemCount(selection)
  const scopes = catalog.scopesByTrade.get(trade.id)?.scopes ?? []

  const handleOpen = useCallback((scopeId: string) => {
    openTrade(trade.id, { focusScopeId: scopeId })
  }, [openTrade, trade.id])

  return (
    <section aria-labelledby={`lead-${trade.id}`} className="grid gap-4 rounded-xl border bg-card p-4 lg:grid-cols-[minmax(14rem,2fr)_3fr]">
      <TradePhoto label={trade.name} photo={TRADE_PHOTOS[trade.slug]} />
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{SPECIALTIES_COPY.lead.eyebrow}</p>
            <h3 id={`lead-${trade.id}`} className="text-lg font-semibold tracking-tight">{trade.name}</h3>
          </div>
          <Button aria-pressed={count > 0} className="h-11 aria-pressed:border-primary aria-pressed:bg-primary/5" size="sm" variant="outline" onClick={() => openTrade(trade.id)}>
            {count > 0 ? `${count} picked` : SPECIALTIES_COPY.lead.customize}
          </Button>
        </div>
        <OutcomeLine text={TRADE_OUTCOMES[trade.slug]} />
        {scopes.length > 0 && (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {scopes.map(scope => (
              <li key={scope.id}>
                <ScopeTile
                  id={scope.id}
                  mode="open"
                  name={scope.name}
                  photo={SCOPE_PHOTOS[scope.name]}
                  pressed={selected.has(scope.id)}
                  unit={scope.unitOfPricing}
                  onOpen={handleOpen}
                />
              </li>
            ))}
          </ul>
        )}
        <PairingCard selected={count > 0} slug={trade.slug} />
      </div>
    </section>
  )
}
```

`lead-panels.tsx`:

```tsx
import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'
import { LeadPanel } from '@/features/meeting-flow/ui/components/steps/specialties/lead-panel'

interface LeadPanelsProps {
  trades: Trade[]
}

export function LeadPanels({ trades }: LeadPanelsProps) {
  return (
    <div className="flex flex-col gap-4">
      {trades.map(trade => <LeadPanel key={trade.id} trade={trade} />)}
    </div>
  )
}
```

- [ ] **Step 3: Compose**

In `steps/specialties/index.tsx`: accept `flowContext: MeetingFlowContext` as a prop; compute `const leadTrades = useMemo(() => deriveLeadTrades(getRequestedTrades(flowContext.customer), catalog.tradesById), [flowContext.customer, catalog.tradesById])` (place the hook above the early returns); `const hasLead = leadTrades.length > 0`; pass `hasLead` to `StepIntro` and `TradeCatalog`; render `{hasLead ? <LeadPanels trades={leadTrades} /> : <StartHint />}` where `StartHint` was. In the view, render `<SpecialtiesStep flowContext={flowContext} />`.

- [ ] **Step 4: Verify**

`pnpm tsc`, `pnpm exec eslint --fix` on the changed files. Rendered, on a meeting whose customer has requested trades (the user names one when lifting the gate): the panel shows "You called about", the trade name, the outcome line when the playbook has one, every scope as an open-mode tile; tapping a scope opens the sheet with that scope outlined and focused (`document.activeElement.dataset.scopeId` equals the tapped id); picking it in the sheet and closing shows the panel tile pressed with the check mark; the header button reads "1 picked". On a meeting without requested trades the start hint shows as before. Repeat the width sweep from Task 7 Step 2 for the panel (photo above content below `lg`).

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(meeting-flow): lead panels for the trades the customer called about

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>" -- src/features/meeting-flow/lib/get-requested-trades.ts src/features/meeting-flow/ui/components/steps/specialties/lead-panel.tsx src/features/meeting-flow/ui/components/steps/specialties/lead-panels.tsx src/features/meeting-flow/ui/components/steps/specialties/index.tsx
git show --stat HEAD
```

---

## Close-out (Phase 8 of the how-to, after the user's hands-on check)

- `docs/plans/2026-09-13-specialties-follow-ups.md`: an introduction per follow-up, no code. Seed list: move `PlaceholderSlot` to `ui/components/presentation/` with a surface-neutral color API once the Who We Are corrections are committed; replace `TRADE_PHOTOS`/`SCOPE_PHOTOS` with `mediaFiles` (#243, #244); the source photos under `Monique/`, `Olympia/`, and `Altura/` are 2 to 8 MB and cost a slow first optimization in dev; per-scope sell-side text from Notion SOW pages loaded lazily in the sheet; open the trade sheet from the portfolio and closing steps; a pending write lost on view unmount (unchanged from the old step); the Energy Saver slug bug (§9 item 1); the bathroom and flooring pairing the playbook lists but the spec left out; whether `ResponsiveSheet` stays in `shared/` with one consumer (the shell panel will not adopt it).
- Memory: `project-specialties-trade-sheet` with the shipped range, the gate state, and the follow-ups, plus one line in `MEMORY.md`.
- Spec, plan, and follow-ups stay uncommitted until the user says otherwise.

## Self-review against the spec

**Spec coverage.** §1 goal and §2 decisions: direction B and architecture 1 (Tasks 3, 5, 6); selected means one or more items (Task 2 `isTradeSelected`, `normalizeForWrite`); add-ons stored beside scopes (Task 8); reasons per trade in the sheet (Task 6 `ReasonChipGroup`); curated local photos and labeled placeholders (Tasks 1, 6); shadcn only (Tasks 4, 6: Sheet, Drawer, ToggleGroup, Button, Badge, Label, Textarea, Input); toggle updates one item, body keyed on the trade id (Task 6 host and group; verified in Task 6 Step 5 and Task 7 Step 5); UI only (Global Constraints, off-limits list). §3 content: trades and scopes from the two `getAll` procedures grouped once (Task 3); eleven reasons verbatim (Task 6); five outcome lines and three pairings verbatim (Task 1); seven trade photos and seven scope photos (Task 1); lead trades from the customer's requested trades (Task 9, gated). §4.1 to §4.5: covered by Tasks 1 to 6 with the named deviations listed under File Structure. §4.6 responsive: `sm:max-w-xl` and three tiles per row above `lg`, drawer at 80vh with handle below, catalog grid at one, two, three columns, capsule clearance from the shell's `StepRegion` (`--stage-inset-b`, superseding the spec's variable), lead panel photo left above `lg` (Task 9). §4.7 motion: pairing card with `AnimatePresence initial={false}` and the shared tokens, `MotionConfig` at the view, no animation on toggle (Tasks 5, 6). §4.8 accessibility: dialogs from the primitives, `aria-pressed` on every toggle and opener, 44px targets (`min-h-11`, `min-h-14`), border plus fill plus check, focus scope scrolled and focused once, outline highlight (Task 6). §5 edge cases: catalog error with retry (Task 5), orphan items and "not in the catalog" badge (Task 6), zero-scope trades with the add-ons-only line (Tasks 6, 8), server refetch re-seeds without closing the sheet (Task 3), last write wins (unchanged). §6 verification: items 1 to 5 in Task 6 Step 5, items 1 to 8 across widths and schemes in Task 7. §7 files: every file accounted for, deviations named. §8 out of scope: untouched. §9: the gate section names what the user runs and which task waits.

**Placeholder scan.** No TBD or "similar to Task N". Every component has its code. The one open assumption is the shape `get-requested-trades.ts` reads, and Task 9 says what to do if the type does not match.

**Type consistency.** `toggleItem(tradeId, item: SelectionItem)` is the name used in Tasks 1, 3, 6, 8, 9. `TradeCatalog.tradesBySlug` is declared in Task 1, built in Task 3, read in Task 6 (`PairingCard`). `ScopeTileGroup` takes `emptyText` (Task 6 body passes it). `ScopeTile` open mode takes `pressed` and `onOpen` (Task 9). `formatSelectionSummary(counts)` takes the `SelectionCounts` from `countSelection` (Tasks 2, 6). `StepIntro` and `TradeCatalog` take `hasLead` (Tasks 5, 9). `ResponsiveSheet` `title` and `description` are strings; the host passes strings (Tasks 4, 6).
