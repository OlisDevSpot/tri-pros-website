# Specialties Stage and Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild meeting-flow step 2 as a full-width, two-column stage (a pinned photo showcase for the homeowner, a work column for the rep), move per-trade capture into a new Project section of the meeting panel, retire the trade sheet, and cut render work to a measured budget.

**Architecture:** The view-scoped `TradeSelectionProvider` keeps its write path and splits into four contexts (catalog + portfolio projects, stable actions, selections, stage). The step becomes a `split` layout whose root is a container query: two columns at a stage width of 896px or more, a pinned photo band below. The showcase reads an edge-mapped index of Tri Pros portfolio projects; the work column picks trades through a shadcn `Popover` + `Command` and work through a `ToggleGroup` of memoized cards. The meeting panel gains a `project` section of collapsible summary rows whose work picker is a vertical `ToggleGroup` of checkbox option rows; below `lg` the whole panel renders inside `ResponsiveSheet`.

**Tech Stack:** Next.js 15, React 19 (`createContext` + `use`, `memo`, render-phase state adjustment), nuqs 2 (`parseAsString`), TanStack Query v5 (`MutationObserver`), tRPC, shadcn/ui (`ToggleGroup`, `Toggle`, `Popover`, `Command` (cmdk), `Collapsible` + `AnimatedCollapsibleContent`, `Button`, `Badge`, `Textarea`, Drawer/Sheet via `ResponsiveSheet`), `sonner` toasts, `motion/react` v12 (`AnimatePresence`, `MotionConfig`), `OptimizedImage`, `next/image`, Tailwind v4 (named container queries `@container/name`, `@4xl/name:`).

**Spec:** `docs/superpowers/specs/2026-09-14-specialties-stage-and-rail-design.md`
**Process:** `docs/how-to/ui-exploration.md` (Phases 5 to 8)
**Studies page (what was approved):** https://claude.ai/artifact/XAkzajHMWv3APK6piustET (Study B, version 3)
**Supersedes for step 2:** `docs/superpowers/plans/2026-09-13-specialties-trade-sheet.md` Tasks 5 and 6 (shipped `528f77cf..5f19509f`); its Tasks 8 and 9 (user-gated) are replaced by Tasks 9 to 11 here.

## Global Constraints

- Package manager is **pnpm**. Path alias `@/` maps to `src/`. Never run `pnpm build`; verification is `pnpm tsc` and `pnpm exec eslint <files>` (repo memory `feedback-verification-workflow`).
- The working tree is **shared with the user's live editor**. `git stash`, `git checkout <ref> -- .`, `git restore` beyond your own task's files, `git reset`, `git add -A`, `git add .`, and `git add -u` are forbidden (repo memory `feedback-subagent-shared-tree-safety`).
- Work happens **on `main`**. Commit steps run only if the user confirmed per-task commits at execution start; otherwise stop before the commit step and report the paths.
- **Commit recipe (exact).** (1) `git diff --cached --name-status | wc -l`, note N; (2) `git add -- <only the NEW files you created>`; (3) `git commit -m "…" -- <every path of your task: new, modified, deleted, and both sides of a move>`; (4) `git show --stat HEAD` lists only your paths and `git diff --cached --name-status | wc -l` prints N again. If either check fails, stop and report BLOCKED; do not repair git state. Messages end with the trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Foreign uncommitted work (state 2026-09-14 evening).** Another session has uncommitted edits in `src/features/meeting-flow/ui/components/presentation/scrim.tsx`, `docs/design-system/DESIGN.md` and `docs/design-system/anti-slop-checklist.md`. Never edit them. Before editing any file, run `git diff --stat -- <file>`; if it shows changes you did not make, stop and report BLOCKED with the file name.
- **UI only. Files off limits:** `src/trpc/**`, `src/shared/entities/**`, `src/shared/modules/**`, `src/shared/db/**`, `src/shared/services/**`, `src/shared/dal/**`, seeds, `scripts/**`, `docs/design-system/**`. If a task seems to need one, stop and report BLOCKED; the spec's §5 table is the user's list.
- Coding conventions (repo memory `coding-conventions`): one React component per file; no file-level constants or helpers in component, view, hook, or context files (constants go to `constants/`, pure functions to `lib/`); named exports only; prop interfaces stay in the component file; contexts in `contexts/`, hooks in `hooks/`; shadcn components over native elements; `import type` for type-only imports; explicit `{ }` on every `if`; memoize every context value.
- Lint: `perfectionist/sort-imports`, `antfu/if-newline`, `react/no-unstable-context-value`, `react-hooks-extra/no-direct-set-state-in-use-effect`. Run `pnpm exec eslint --fix <files>` after writing a file.
- **Type (spec D6):** no `font-bold`, `font-extrabold`, `font-black` or `font-medium` in files this plan creates. Syne (`font-sans`) at `font-semibold` only for the showcase title, the step question and section headings; everything else is the body font (Nunito, inherited) at `font-normal` or `font-semibold`.
- **Company facts and sales copy** come only from `src/shared/constants/company/`, existing typed constants (`TRADE_OUTCOMES`, `TRADE_PAIRINGS`, `BENEFIT_TEMPLATES`, `meetingPainTypes`, `TRADE_PHOTOS`, `SCOPE_PHOTOS`) and the new copy keys this plan adds. No invented outcome, benefit or claim.
- **Privacy (spec D9):** reason labels (`meetingPainTypes`), notes and the pairing `reason` string never render in `ui/components/steps/specialties/**`. They render only under `ui/components/project-section/**`.
- Design tokens: app theme; `primary` is the only accent; selected state = border or outline + fill + check mark, never color alone; highlights inside scrolling containers use `outline-2 outline-primary -outline-offset-2`, never `ring`; `box-shadow` and `overflow-hidden` never on the same element; touch targets at least 44px (`min-h-11`); small text in `primary` is not allowed (fails 4.5:1): use `text-foreground` beside a `text-primary` icon. The showcase ground is `bg-(--presentation-ground) text-white` (defined on `[data-stage]`), secondary text `text-white/75` or `/80`, accent `text-(--presentation-accent)`.
- Tailwind v4 content scanning does not reliably pick up classes that appear only in `.ts` files (repo memory `reference-tailwind-ts-classmap-scan-gap`): keep every utility class literal inside `.tsx` files.
- **The meeting-flow shell.** `StageFrame` is the root (`data-stage`, `--stage-inset-b:5rem`); page steps render in `StepRegion`; `MeetingPanel` (lg+ overlay, non-modal) and `InspectorRail` host panel sections; `useMeetingFlowKeys` owns keys (ignores `defaultPrevented` events, portaled targets and typing targets). Add no key handlers of your own.
- Motion: `motion/react` only; `MotionConfig reducedMotion="user"` already wraps the stage. No animation replays on data changes.
- **Render rule (spec D12, §4.4):** a toggle changes one item's pressed state; no ancestor is keyed on selection; memoized components take primitives or identity-stable entries.
- No unit test runner exists. Pure functions in `lib/` get a throwaway assertion script in `$SCRATCH/checks/`, run with `pnpm exec tsx <script>` from the repo root; write it first, watch it fail, then implement. Components verify with `pnpm tsc`, `pnpm exec eslint`, and a standalone Playwright script.
- **Dev server on port 3000 is the user's.** Never start, stop or restart it; never touch `.next`. It compiled its CSS at boot, so new Tailwind classes render as nothing: build current CSS with `node .superpowers/sdd/2026-09-13-specialties-trade-sheet/tools/build-css.mjs <out.css>` and inject with `page.addStyleTag({ path })` after load, before judging any style.
- **Browser.** Standalone Node script: `import { chromium } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/node_modules/playwright/index.mjs'`, headless. Log in with `http://localhost:3000/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET>&redirect=/dashboard/meetings`, reading `DEV_LOGIN_SECRET` from `.env.local` at runtime; never print it or write it into a file. Dev meeting: `http://localhost:3000/dashboard/meetings/2069fa85-0357-4550-8eb5-6ae40eacf5a9?step=2`. A helper already does this: `$SCRATCH/t7-common.mjs` exports `setup({ scheme, width, height })` → `{ browser, context, page }`. Every script that toggles selections restores the meeting's `flowStateJSON.tradeSelections` through the UI before exiting and confirms it by reload.
- `$SCRATCH` = `/tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/653d8fe9-43af-47b1-9087-a9bf54a9f03e/scratchpad`. `$WS` = `.superpowers/sdd/2026-09-14-specialties-stage-and-rail` (git-ignored; create `$WS/tools/` on first use).

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/features/meeting-flow/ui/views/meeting-flow.tsx` (modify) | writes through unsubscribed `MutationObserver`s; `split` layout; Project section; echo-aware invalidation | 1, 4, 5, 7 |
| `src/shared/components/ui/toggle-group.tsx` (modify) | memoized `ToggleGroupContext` value | 1 |
| `src/features/meeting-flow/types/index.ts` (modify) | showcase, stage, actions and context types; `MeetingStepLayout` `'split'`; `PanelSection` `'project'`; retire sheet types | 2, 3, 4, 5 |
| `src/features/meeting-flow/constants/specialties-copy.ts` (modify) | `showcase`, `work`, `panel`, `undo` keys and new units; retire `project`, `catalog`, `sheet`, `introWithLead`, `introNoLead` | 2, 4, 5 |
| `src/features/meeting-flow/constants/showcase.ts` (create) | crossfade transition, proof and benefit limits, projects stale time | 2 |
| `src/features/meeting-flow/constants/trade-benefit-exclusions.ts` (create, LAZY) | seven benefit lines with numeric claims | 2 |
| `src/features/meeting-flow/constants/trade-selection.ts` (modify) | `UNDO_TOAST_MS` | 2 |
| `src/features/meeting-flow/lib/index-showcase-projects.ts` (create) | portfolio rows → `ShowcaseProjectIndex` | 2 |
| `src/features/meeting-flow/lib/to-showcase-media.ts` (create) | `curatedMedia`, `projectMedia` | 2 |
| `src/features/meeting-flow/lib/format-project-caption.ts` (create) | "Tri Pros project · City, ST · 3 weeks" | 2 |
| `src/features/meeting-flow/lib/select-stage-media.ts` (create) | `selectStageMedia`, `findStageMedia` | 2 |
| `src/features/meeting-flow/lib/select-scope-media.ts` (create) | a scope's photo | 2 |
| `src/features/meeting-flow/lib/select-trade-benefits.ts` (create) | benefit lines for a trade name | 2 |
| `src/features/meeting-flow/lib/resolve-stage-trade.ts` (create) | URL trade → first on-project → first catalog trade | 2 |
| `src/features/meeting-flow/lib/format-work-summary.ts` (create) | "Window replacement +1" | 2 |
| `src/features/meeting-flow/lib/group-trades-for-switcher.ts` (create) | switcher groups | 2 |
| `src/features/meeting-flow/lib/trade-selection.ts` (modify) | `withTradeRestored`, `isOnlyItem`; drop helpers left unused by Task 4 | 2, 4 |
| `src/features/meeting-flow/hooks/use-showcase-projects.ts` (create, LAZY) | the portfolio read, indexed | 2 |
| `src/features/meeting-flow/contexts/trade-catalog-context.tsx` (create) | `TradeCatalogContext`, `useTradeCatalogContext` | 3 |
| `src/features/meeting-flow/contexts/trade-actions-context.tsx` (create) | `TradeActionsContext`, `useTradeActions` | 3 |
| `src/features/meeting-flow/contexts/trade-selections-context.tsx` (create) | `TradeSelectionsContext`, `useTradeSelections` | 3 |
| `src/features/meeting-flow/contexts/trade-stage-context.tsx` (create) | `TradeStageContext`, `useTradeStage` | 3 |
| `src/features/meeting-flow/contexts/trade-selection-context.tsx` (delete) | replaced by the four above | 3 |
| `src/features/meeting-flow/contexts/trade-selection-provider.tsx` (modify) | four context values, remove/restore, stage state | 3 |
| `src/features/meeting-flow/constants/query-parsers.ts` (modify) | `tradeSheetParser` → `tradeStageParser` | 3 |
| `src/features/meeting-flow/hooks/use-stage-trade.ts` (create) | the resolved stage `Trade` | 4 |
| `src/features/meeting-flow/hooks/use-trade-edits.ts` (create) | `toggleWork`, `removeWithUndo` | 4 |
| `src/features/meeting-flow/ui/components/trade-thumb.tsx` (create) | 40–48px trade thumbnail | 4 |
| `src/features/meeting-flow/ui/components/steps/specialties/index.tsx` (rewrite) | `SpecialtiesStep` (memo): gate + container + two regions | 1, 4 |
| `.../steps/specialties/showcase.tsx` (create) | left region | 4 |
| `.../steps/specialties/showcase-media.tsx` (create) | keyed crossfade photo + scrim + caption | 4 |
| `.../steps/specialties/showcase-fallback.tsx` (create) | decor + "What's included" | 4 |
| `.../steps/specialties/showcase-text.tsx` (create) | eyebrow, title, outcome, status, benefits | 4 |
| `.../steps/specialties/project-proof-strip.tsx` (create) | "Our projects · N" thumbnails | 4 |
| `.../steps/specialties/work-column.tsx` (create) | right region | 4 |
| `.../steps/specialties/on-project-trades.tsx` (create) | on-project chip row | 4 |
| `.../steps/specialties/trade-switcher.tsx` (create) | `Popover` + `Command` trade picker | 4 |
| `.../steps/specialties/work-card-group.tsx` (create) | `ToggleGroup` of work cards | 4 |
| `.../steps/specialties/work-card.tsx` (create) | memoized card | 4 |
| `.../steps/specialties/often-together.tsx` (create) | homeowner-safe pairing prompt | 4 |
| `.../steps/specialties/{project-strip,step-intro,trade-catalog,trade-tile}.tsx` (delete) | old step | 4 |
| `.../trade-sheet/{trade-sheet-host,trade-sheet-body,trade-sheet-header,trade-sheet-footer,trade-photo,outcome-line,pairing-card,scope-tile-group,scope-tile}.tsx` (delete) | the sheet | 4 |
| `src/features/meeting-flow/constants/step-config.ts` (modify) | step 2 `layout: 'split'` | 4 |
| `src/features/meeting-flow/ui/components/project-section/project-section.tsx` (create) | summary + rows | 5 |
| `.../project-section/project-row.tsx` (create) | one collapsible row | 5 |
| `.../project-section/project-count-badge.tsx` (create) | rail badge | 5 |
| `.../project-section/work-option-list.tsx` (create) | Mirror option rows | 5 |
| `.../project-section/reason-picker.tsx` (create) | selected-first reasons + edit | 5 |
| `.../project-section/trade-note-field.tsx`, `orphan-item-chips.tsx` (move from `trade-sheet/`) | note, orphans | 5 |
| `.../trade-sheet/reason-chip-group.tsx` (delete) | replaced by `reason-picker.tsx` | 5 |
| `src/features/meeting-flow/constants/{shell,shell-copy}.ts` (modify) | `project` section | 5 |
| `src/features/meeting-flow/ui/components/shell/inspector-rail.tsx` (modify) | Project rail item | 5 |
| `src/shared/components/dialogs/sheets/responsive-sheet.tsx` (modify) | `sheetClassName` / `drawerClassName`, `hideTitle` | 6 |
| `src/features/meeting-flow/ui/components/shell/meeting-panel.tsx` (modify) | below `lg` → `ResponsiveSheet` | 6 |
| `$WS/tools/{instrument.js,measure-stage.mjs}` (create, git-ignored) | commit-hook render measurement | 1, 7 |

Deviations from the spec's file list, each for a repo rule or a measured need: `showcase-text.tsx`, `trade-thumb.tsx`, `project-count-badge.tsx`, `use-stage-trade.ts`, `use-trade-edits.ts`, `group-trades-for-switcher.ts`, `to-showcase-media.ts`, `format-project-caption.ts`, `format-work-summary.ts` and `constants/showcase.ts` exist because helpers and constants may not live in component files; the spec's `showcase-benefits.tsx` is folded into `showcase-text.tsx` (one list, no own state). `select-trade-showcase.ts` from the spec is split into `select-stage-media.ts` and `select-trade-benefits.ts`. The spec's "Removed {scope}" toast was dropped (spec §3 amended): an unticked non-last item stays visible and re-tickable.

**Between Task 4 and Task 5** the rep cannot edit reasons or notes (the sheet is gone, the Project section is not built). Run them back to back and do not push in between.

---

### Task 1: Save path and toggle-group render fixes

Measured today (`$SCRATCH/r3/rerender/tables.md`): a save re-renders the whole view three times (~1,480 renders) because the view subscribes to `useMutation` status and rebuilds `flowContext`; every shadcn `ToggleGroupItem` re-renders because the context value is a new object. This task removes both without changing behavior.

**Files:**
- Modify: `src/features/meeting-flow/ui/views/meeting-flow.tsx` (imports; lines 76–140: queries, mutations, handlers)
- Modify: `src/shared/components/ui/toggle-group.tsx:17-43`
- Modify: `src/features/meeting-flow/ui/components/steps/specialties/index.tsx` (wrap in `memo`)
- Modify: `src/features/meeting-flow/ui/components/trade-sheet/trade-sheet-host.tsx` (wrap in `memo`)
- Create (git-ignored): `$WS/tools/instrument.js`, `$WS/tools/measure-sheet.mjs`, `$WS/tools/summarize.cjs`

**Interfaces:**
- Consumes: nothing new.
- Produces: `flowContext.onFlowStateChange` keeps its identity across a save's pending and success states; `SpecialtiesStep` and `TradeSheetHost` are `memo` components with no props; `$WS/tools/instrument.js` (the commit hook: `window.__rr`, `window.__rrReset()`), used again in Task 7.

- [ ] **Step 1: Copy the measurement tools and record the baseline**

```bash
mkdir -p .superpowers/sdd/2026-09-14-specialties-stage-and-rail/tools
S=/tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/653d8fe9-43af-47b1-9087-a9bf54a9f03e/scratchpad
cp $S/r3/rerender/instrument.js .superpowers/sdd/2026-09-14-specialties-stage-and-rail/tools/instrument.js
cp $S/r3/rerender/summarize.cjs .superpowers/sdd/2026-09-14-specialties-stage-and-rail/tools/summarize.cjs
sed "s#'../../t7-common.mjs'#'$S/t7-common.mjs'#" $S/r3/rerender/measure.mjs > .superpowers/sdd/2026-09-14-specialties-stage-and-rail/tools/measure-sheet.mjs
cd .superpowers/sdd/2026-09-14-specialties-stage-and-rail/tools && node measure-sheet.mjs 1440 900 && node summarize.cjs measure-1440.json > baseline-1440.txt && grep -A1 "=========== a1-scope-on" -m1 baseline-1440.txt; grep "later:" -A0 baseline-1440.txt | head -3
```

Expected: the script restores the meeting and writes `measure-1440.json`; the `a1-scope-on` later phase reports `componentRenders=1480` (±5%) and the fetch list shows 1 `crud.update` and 2 `getByIdWithJoins`. Keep `baseline-1440.txt`.

- [ ] **Step 2: Memoize the toggle-group context value**

In `src/shared/components/ui/toggle-group.tsx`, inside `ToggleGroup`, before `return`, add the memo and pass it:

```tsx
  const contextValue = React.useMemo(() => ({ variant, size }), [variant, size])

  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      className={cn(
        'group/toggle-group flex w-fit items-center rounded-md data-[variant=outline]:shadow-xs',
        className,
      )}
      {...props}
    >
      <ToggleGroupContext value={contextValue}>
        {children}
      </ToggleGroupContext>
    </ToggleGroupPrimitive.Root>
  )
```

- [ ] **Step 3: Write through unsubscribed mutation observers in the view**

In `src/features/meeting-flow/ui/views/meeting-flow.tsx`:

Replace the import `import { useMutation, useQuery } from '@tanstack/react-query'` with:

```tsx
import { MutationObserver as QueryMutationObserver, useQuery, useQueryClient } from '@tanstack/react-query'
```

and add `useLayoutEffect` to the `react` import.

Replace everything from `const invalidateMeetingQueries = useCallback(` through the end of `handleAgentNotesChange` (the two `useMutation` calls and the four handlers) with:

```tsx
  const queryClient = useQueryClient()

  // Writes go through observers the view never subscribes to, so a save's pending and success
  // states do not re-render the view or change `flowContext` (spec §4.4 step 2). The latest
  // invalidation function is read through a ref so the observers are created once.
  const invalidateRef = useRef(invalidateMeeting)
  useLayoutEffect(() => {
    invalidateRef.current = invalidateMeeting
  })

  const [meetingWriter] = useState(() => new QueryMutationObserver(queryClient, trpc.meetingsRouter.crud.update.mutationOptions({
    onSuccess: () => invalidateRef.current(),
    onError: () => toast.error('Failed to save'),
  })))

  const [customerProfileWriter] = useState(() => new QueryMutationObserver(queryClient, trpc.meetingFlowRouter.updateCustomerProfile.mutationOptions({
    onSuccess: () => invalidateRef.current(),
    onError: () => toast.error('Failed to save customer data'),
  })))

  const meeting = meetingQuery.data
  const customer = meeting?.customer?.id ? meeting.customer : null
  const isReady = Boolean(meeting)

  // The cached meeting at call time, not the value from the last render: two writes close together
  // merge onto the newest cached blob instead of a stale closure (follow-up 9, partly).
  const readCachedMeeting = useCallback(
    () => queryClient.getQueryData(trpc.meetingsRouter.reads.getByIdWithJoins.queryKey({ id: meetingId })),
    [queryClient, trpc, meetingId],
  )

  const handleFlowStateChange = useCallback((patch: Partial<MeetingFlowState>) => {
    const current = readCachedMeeting()?.flowStateJSON ?? {}
    meetingWriter.mutate({ id: meetingId, data: { flowStateJSON: { ...current, ...patch } } }).catch(() => undefined)
  }, [readCachedMeeting, meetingId, meetingWriter])

  const customerId = customer?.id
  const handleCustomerProfileChange = useCallback((patch: Record<string, unknown>) => {
    if (!customerId) {
      return
    }
    // Flat column patch (epic #256/#259) — send only the changed field(s),
    // no read-modify-merge needed since each column IS the field.
    customerProfileWriter.mutate({ meetingId, customerId, patch }).catch(() => undefined)
  }, [customerId, meetingId, customerProfileWriter])

  const handleContextChange = useCallback((patch: Record<string, unknown>) => {
    const current = (readCachedMeeting()?.contextJSON ?? {}) as MeetingContext
    meetingWriter.mutate({ id: meetingId, data: { contextJSON: { ...current, ...patch } as MeetingContext } }).catch(() => undefined)
  }, [readCachedMeeting, meetingId, meetingWriter])

  const handleOutcomeChange = useCallback((outcome: string) => {
    void changeOutcome(meetingId, outcome as MeetingOutcome)
  }, [changeOutcome, meetingId])

  const handleAgentNotesChange = useCallback((notes: string) => {
    meetingWriter.mutate({ id: meetingId, data: { agentNotes: notes } }).catch(() => undefined)
  }, [meetingId, meetingWriter])
```

Delete the now-duplicate `const meeting = …`, `const customer = …` and `const isReady = …` lines that followed the old mutations. The `useMemo` that builds `flowContext` stays as is.

- [ ] **Step 4: Memoize the two prop-less children of the view**

In `src/features/meeting-flow/ui/components/steps/specialties/index.tsx`: rename `export function SpecialtiesStep()` to `function SpecialtiesStepImpl()`, add `import { memo } from 'react'`, and append:

```tsx
/** No props: view re-renders (a save, the realtime echo) never reach the step; only its contexts do. */
export const SpecialtiesStep = memo(SpecialtiesStepImpl)
```

In `src/features/meeting-flow/ui/components/trade-sheet/trade-sheet-host.tsx`: rename `export function TradeSheetHost()` to `function TradeSheetHostImpl()`, add `memo` to the `react` import, and append:

```tsx
export const TradeSheetHost = memo(TradeSheetHostImpl)
```

- [ ] **Step 5: Type-check and lint**

Run: `pnpm tsc && pnpm exec eslint --fix src/features/meeting-flow/ui/views/meeting-flow.tsx src/shared/components/ui/toggle-group.tsx src/features/meeting-flow/ui/components/steps/specialties/index.tsx src/features/meeting-flow/ui/components/trade-sheet/trade-sheet-host.tsx`
Expected: exit 0, no remaining errors.

- [ ] **Step 6: Re-measure**

```bash
cd .superpowers/sdd/2026-09-14-specialties-stage-and-rail/tools && node measure-sheet.mjs 1440 900 && node summarize.cjs measure-1440.json > after-task1-1440.txt && grep -A2 "=========== a1-scope-on" after-task1-1440.txt | head -3; grep -c "componentRenders" after-task1-1440.txt
```

Expected, `a1-scope-on` later phase: `componentRenders` ≤ 320 (from ~1,480); `mounts=0`; the identity block shows `sameAsLive: true` for every node; the restore line prints `canonicalEqualToInitialThisRun: true`. The immediate phase is not worse than baseline. A context-panel field edit and a customer profile edit still save (open the panel's Context section in the dev meeting, change "Decision Makers Present", reload, value persists; revert it).

- [ ] **Step 7: Commit**

```bash
git diff --cached --name-status | wc -l
git commit -m "perf(meeting-flow): writes through unsubscribed mutation observers, memoized toggle-group context and prop-less step and sheet host" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- src/features/meeting-flow/ui/views/meeting-flow.tsx src/shared/components/ui/toggle-group.tsx src/features/meeting-flow/ui/components/steps/specialties/index.tsx src/features/meeting-flow/ui/components/trade-sheet/trade-sheet-host.tsx
git show --stat HEAD && git diff --cached --name-status | wc -l
```

---

### Task 2: Foundation: types, copy, constants, selectors, the portfolio index

**Files:**
- Modify: `src/features/meeting-flow/types/index.ts` (imports; append to the Specialties block)
- Modify: `src/features/meeting-flow/constants/specialties-copy.ts` (add keys; nothing removed yet)
- Modify: `src/features/meeting-flow/constants/trade-selection.ts`
- Create: `src/features/meeting-flow/constants/showcase.ts`, `src/features/meeting-flow/constants/trade-benefit-exclusions.ts`
- Create: `src/features/meeting-flow/lib/{index-showcase-projects,to-showcase-media,format-project-caption,select-stage-media,select-scope-media,select-trade-benefits,resolve-stage-trade,format-work-summary,group-trades-for-switcher}.ts`
- Modify: `src/features/meeting-flow/lib/trade-selection.ts` (append two functions)
- Create: `src/features/meeting-flow/hooks/use-showcase-projects.ts`
- Test: `$SCRATCH/checks/stage-lib.ts`

**Interfaces:**
- Consumes: `TradeCatalog`, `TradeScopeGroup`, `TradePhoto`, `SelectionItem` (types); `TRADE_PHOTOS`, `SCOPE_PHOTOS`, `TRADE_CATEGORY_ORDER`, `TRADE_CATEGORY_LABELS`, `BENEFIT_TEMPLATES`, `formatCount`, `findTradeSelection`, `selectedTradeSelections`, `withoutTrade`; `PortfolioProject` from `@/shared/entities/projects/types`; `MediaFile` from `@/shared/db/schema`.
- Produces:
  - Types `ShowcaseProject`, `ShowcaseProjectIndex`, `ShowcaseMedia`, `TradeBenefit`, `TradeCatalogContextValue`, `TradeActions`, `TradeStageState`, `SwitcherGroup`.
  - `indexShowcaseProjects(projects: PortfolioProject[], scopesByTrade: ReadonlyMap<string, TradeScopeGroup>): ShowcaseProjectIndex`
  - `curatedMedia(photo: TradePhoto): ShowcaseMedia`, `projectMedia(project: ShowcaseProject): ShowcaseMedia`
  - `formatProjectCaption(project: Pick<ShowcaseProject, 'city' | 'state' | 'duration'>): string`
  - `selectStageMedia(trade: Trade, scopes: ScopeOrAddon[], index: ShowcaseProjectIndex): ShowcaseMedia[]`, `findStageMedia(list: ShowcaseMedia[], key: string | null): ShowcaseMedia | undefined`
  - `selectScopeMedia(scope: ScopeOrAddon, index: ShowcaseProjectIndex): ShowcaseMedia | null`
  - `selectTradeBenefits(tradeName: string, limit: number): TradeBenefit[]`
  - `resolveStageTradeId(urlTradeId: string | null, selections: TradeSelection[], catalog: Pick<TradeCatalog, 'trades' | 'tradesById'>): string | null`
  - `formatWorkSummary(entry: TradeSelection): string`
  - `groupTradesForSwitcher(trades: Trade[], selections: TradeSelection[]): SwitcherGroup[]`
  - `withTradeRestored(selections: TradeSelection[], entry: TradeSelection): TradeSelection[]`, `isOnlyItem(entry: TradeSelection | undefined, itemId: string): boolean`
  - `useShowcaseProjects(scopesByTrade: ReadonlyMap<string, TradeScopeGroup>): ShowcaseProjectIndex`
  - Constants `SHOWCASE_CROSSFADE`, `SHOWCASE_PROOF_LIMIT` (4), `SHOWCASE_BENEFIT_LIMIT` (2), `SHOWCASE_PROJECTS_STALE_MS` (300000), `TRADE_BENEFIT_EXCLUSIONS`, `UNDO_TOAST_MS` (7000).
  - Copy keys `SPECIALTIES_COPY.showcase.*`, `.work.*`, `.panel.*`, `.undo.*`, `.units.{work,kind,trade}` exactly as in Step 4.

- [ ] **Step 1: Write the failing assertion script**

Create `$SCRATCH/checks/stage-lib.ts`:

```ts
import assert from 'node:assert/strict'
import type { PortfolioProject } from '@/shared/entities/projects/types'
import { formatProjectCaption } from '@/features/meeting-flow/lib/format-project-caption'
import { formatWorkSummary } from '@/features/meeting-flow/lib/format-work-summary'
import { groupTradesForSwitcher } from '@/features/meeting-flow/lib/group-trades-for-switcher'
import { indexShowcaseProjects } from '@/features/meeting-flow/lib/index-showcase-projects'
import { resolveStageTradeId } from '@/features/meeting-flow/lib/resolve-stage-trade'
import { selectScopeMedia } from '@/features/meeting-flow/lib/select-scope-media'
import { findStageMedia, selectStageMedia } from '@/features/meeting-flow/lib/select-stage-media'
import { selectTradeBenefits } from '@/features/meeting-flow/lib/select-trade-benefits'
import { isOnlyItem, withTradeRestored } from '@/features/meeting-flow/lib/trade-selection'

const scope = (id: string, name: string, tradeId: string) => ({ id, name, entryType: 'Scope', unitOfPricing: 'unit', coverImageUrl: null, relatedTrade: tradeId })
const trade = (id: string, name: string, slug: string, type: 'Energy Efficiency' | 'General Construction' | 'Structural / Rough') => ({ id, name, slug, type, coverImageUrl: null, relatedScopes: [], disabled: false })
const hero = (id: number) => ({ id, url: `https://x/${id}.jpg`, pathKey: `p/${id}`, bucket: 'tpr-media', optimizationStatus: 'optimized', blurDataUrl: null })
const project = (id: string, city: string | null, duration: string | null, scopeIds: string[], heroImage: unknown = hero(1)) =>
  ({ project: { id, city, state: 'CA', projectDuration: duration }, heroImage, scopeIds }) as unknown as PortfolioProject

const win = trade('t-win', 'Windows & doors', 'windows-and-doors', 'Energy Efficiency')
const roof = trade('t-roof', 'Roof & Gutters', 'roof-and-gutters', 'Energy Efficiency')
const elec = trade('t-elec', 'Electricals (rough)', 'electricals-rough', 'Structural / Rough')
const winScopes = [scope('s-rep', 'Window replacement', 't-win'), scope('s-slide', 'Sliding door replacement', 't-win')]
const scopesByTrade = new Map([
  ['t-win', { scopes: winScopes, addons: [] }],
  ['t-roof', { scopes: [scope('s-torch', 'Roof torch down', 't-roof')], addons: [] }],
])

// index: projects without a hero are skipped; trade ranking = most matching scopes first
const index = indexShowcaseProjects([
  project('p1', 'Burbank', null, ['s-rep']),
  project('p2', 'Glendale', '2 weeks', ['s-rep', 's-slide']),
  project('p3', 'Arleta', null, ['s-torch'], null),
], scopesByTrade)
assert.deepEqual(index.byTrade.get('t-win')?.map(p => p.id), ['p2', 'p1'])
assert.equal(index.byTrade.get('t-roof'), undefined)
assert.deepEqual(index.byScope.get('s-rep')?.map(p => p.id), ['p1', 'p2'])

assert.equal(formatProjectCaption({ city: 'Glendale', state: 'CA', duration: '2 weeks' }), 'Tri Pros project · Glendale, CA · 2 weeks')
assert.equal(formatProjectCaption({ city: null, state: 'CA', duration: null }), 'Tri Pros project · CA')

// stage media: project media keyed `project:<id>`, deduped, first is the default
const media = selectStageMedia(win, winScopes, index)
assert.deepEqual(media.map(m => m.key), ['project:p2', 'project:p1'])
assert.equal(findStageMedia(media, 'project:p1')?.key, 'project:p1')
assert.equal(findStageMedia(media, 'missing')?.key, 'project:p2')
assert.equal(findStageMedia([], null), undefined)
assert.equal(selectScopeMedia(winScopes[1]!, index)?.key, 'project:p2')
assert.equal(selectScopeMedia(scope('s-none', 'Nothing', 't-win'), index), null)
// curated photos come first (Kitchen Remodel has a committed photo)
const kitchen = trade('t-kit', 'Kitchen Remodel', 'kitchen-remodel', 'General Construction')
assert.equal(selectStageMedia(kitchen, [], index)[0]?.kind, 'curated')

// benefits: numeric lines excluded, limit honored
assert.deepEqual(selectTradeBenefits('Windows & doors', 5).map(b => b.headline), ['Year-round comfort in every room', 'Protect your biggest investment', 'A healthier home for your family'])
assert.equal(selectTradeBenefits('Windows & doors', 2).length, 2)
assert.equal(selectTradeBenefits('HVAC', 5).some(b => /\d/.test(b.body)), false)
assert.deepEqual(selectTradeBenefits('Framing', 5), [])

// stage resolution
const catalog = { trades: [roof, win, elec], tradesById: new Map([[roof.id, roof], [win.id, win], [elec.id, elec]]) }
const sel = (tradeId: string, n: number) => ({ tradeId, tradeName: tradeId, selectedScopes: Array.from({ length: n }, (_, i) => ({ id: `${tradeId}-${i}`, label: `L${i}` })), painPoints: [] })
assert.equal(resolveStageTradeId('t-win', [], catalog), 't-win')
assert.equal(resolveStageTradeId('unknown', [sel('t-elec', 1)], catalog), 't-elec')
assert.equal(resolveStageTradeId(null, [sel('t-win', 0), sel('t-elec', 2)], catalog), 't-elec')
assert.equal(resolveStageTradeId(null, [sel('gone', 1)], catalog), 't-roof')
assert.equal(resolveStageTradeId(null, [], { trades: [], tradesById: new Map() }), null)

// summaries and switcher groups
assert.equal(formatWorkSummary(sel('t-win', 0)), 'No work yet')
assert.equal(formatWorkSummary(sel('t-win', 1)), 'L0')
assert.equal(formatWorkSummary(sel('t-win', 3)), 'L0 +2')
const groups = groupTradesForSwitcher([roof, win, elec], [sel('t-elec', 1), sel('t-roof', 0)])
assert.deepEqual(groups.map(g => [g.key, g.trades.map(t => t.id)]), [['on-project', ['t-elec']], ['Energy Efficiency', ['t-roof', 't-win']]])
assert.equal(groups[0]?.label, 'On your project')

// restore and only-item
const a = sel('t-win', 1)
assert.deepEqual(withTradeRestored([sel('t-elec', 1)], a).map(s => s.tradeId), ['t-elec', 't-win'])
assert.deepEqual(withTradeRestored([a, sel('t-elec', 1)], sel('t-win', 2)).map(s => [s.tradeId, s.selectedScopes.length]), [['t-elec', 1], ['t-win', 2]])
assert.equal(isOnlyItem(a, 't-win-0'), true)
assert.equal(isOnlyItem(sel('t-win', 2), 't-win-0'), false)
assert.equal(isOnlyItem(undefined, 'x'), false)

console.log('stage-lib: all assertions passed')
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec tsx /tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/653d8fe9-43af-47b1-9087-a9bf54a9f03e/scratchpad/checks/stage-lib.ts`
Expected: FAIL with `Cannot find module '@/features/meeting-flow/lib/format-project-caption'`.

- [ ] **Step 3: Add the types**

In `src/features/meeting-flow/types/index.ts`, add to the imports:

```ts
import type { MediaFile } from '@/shared/db/schema'
```

Append at the end of the `// ── Specialties (trade selection)` block (after `TradePairing`):

```ts
/** A portfolio project reduced to what the showcase shows. */
export interface ShowcaseProject {
  id: string
  city: string | null
  state: string | null
  duration: string | null
  heroImage: MediaFile
  scopeIds: string[]
}

export interface ShowcaseProjectIndex {
  /** Projects tagged with any of the trade's scopes, most matching scopes first. */
  byTrade: ReadonlyMap<string, ShowcaseProject[]>
  /** Projects tagged with the scope, in portfolio order. */
  byScope: ReadonlyMap<string, ShowcaseProject[]>
}

/** One photo the showcase can put on stage. `key` is stable: a curated photo's `src`, or `project:<id>`. */
export type ShowcaseMedia
  = | { key: string, kind: 'project', file: MediaFile, caption: string }
    | { key: string, kind: 'curated', photo: TradePhoto, caption: string }

export interface TradeBenefit {
  headline: string
  body: string
}

/** Stable once both reads have loaded. */
export interface TradeCatalogContextValue {
  catalog: TradeCatalog
  projects: ShowcaseProjectIndex
}

/** Stable callbacks; they never change on a toggle. */
export interface TradeActions {
  /** Adds the item when absent, removes it when present. Creates the trade entry on first add. */
  toggleItem: (tradeId: string, item: SelectionItem) => void
  toggleReason: (tradeId: string, reason: string) => void
  setNote: (tradeId: string, note: string) => void
  /** Drops the trade entry entirely: items, reasons, and note. */
  removeTrade: (tradeId: string) => void
  /** Puts a removed entry back (Undo), replacing any entry for the same trade. */
  restoreTrade: (entry: TradeSelection) => void
}

export interface TradeStageState {
  /** The trade on stage, resolved: `?trade=` when it names a catalog trade, else the first on-project trade, else the first catalog trade. */
  stageTradeId: string | null
  /** The photo on stage; null means the stage trade's first photo. Reset whenever the stage trade changes. */
  stageMediaKey: string | null
  /** `null` clears the explicit choice so the stage falls back to the default. */
  showTrade: (tradeId: string | null) => void
  showMedia: (key: string | null) => void
}

export interface SwitcherGroup {
  key: string
  label: string
  trades: Trade[]
}
```

- [ ] **Step 4: Add the copy keys and constants**

In `src/features/meeting-flow/constants/specialties-copy.ts`, add these keys inside `SPECIALTIES_COPY` (after `retry`), and add `work`, `kind` and `trade` to `units`:

```ts
  showcase: {
    status: 'On your project',
    projectCaptionLead: 'Tri Pros project',
    ourProjects: 'Our projects',
    included: 'What\'s included',
    scopesToDefine: 'Scopes to define',
  },
  work: {
    regionLabel: 'Choose the work',
    onProject: 'On your project',
    onProjectEmpty: 'Nothing yet. Choose a trade and add the work that fits.',
    tradeLabel: 'Trade',
    switchLabel: 'Choose a trade',
    filterPlaceholder: 'Filter trades…',
    noMatches: 'No trades match.',
    tapToAdd: 'tap to add',
    noWork: (tradeName: string) => `No work to choose yet for ${tradeName}.`,
    add: 'Add to project',
    onYourProject: 'On your project',
    together: 'Often done together',
    togetherPair: (tradeName: string, pairedName: string) => `${tradeName} and ${pairedName}`,
    show: (tradeName: string) => `Show ${tradeName}`,
    groupLabel: (tradeName: string) => `Work for ${tradeName}`,
  },
  panel: {
    heading: 'On the project',
    empty: 'Nothing on the project yet. Add work from the stage.',
    noReason: 'No reason yet',
    noWork: 'No work yet',
    workSummary: (first: string, more: number) => `${first} +${more}`,
    onStage: 'On stage',
    work: 'Work',
    reasons: 'Reasons',
    editReasons: 'Edit reasons',
    doneEditing: 'Done',
    note: 'Note',
    notePlaceholder: (tradeName: string) => `What they said about ${tradeName}…`,
    showOnStage: 'Show on stage',
    remove: 'Remove from project',
    pairsWith: (pairedName: string, reason: string) => `Pairs with ${pairedName}: ${reason}`,
    show: 'Show',
    notInCatalog: 'Not in the current catalog',
    orphanHint: 'Picked earlier, not in the current catalog. Tap one to remove it.',
    removeItem: (label: string) => `Remove ${label}`,
  },
  undo: {
    tradeRemoved: (tradeName: string) => `${tradeName} is off the project`,
    action: 'Undo',
  },
```

```ts
    work: ['piece of work', 'pieces of work'],
    kind: ['kind of work', 'kinds of work'],
    trade: ['trade', 'trades'],
```

Append to `src/features/meeting-flow/constants/trade-selection.ts`:

```ts
/** How long "Undo" stays offered after a trade leaves the project. */
export const UNDO_TOAST_MS = 7000
```

Create `src/features/meeting-flow/constants/showcase.ts`:

```ts
/** Showcase photo crossfade: opacity only, the brand easing (`--ease-brand`), 400ms (`--dur-base`). */
export const SHOWCASE_CROSSFADE = { duration: 0.4, ease: [0.32, 0.72, 0, 1] } as const

/** Thumbnails in the "Our projects" strip. */
export const SHOWCASE_PROOF_LIMIT = 4

/** Benefit lines under the outcome on the two-column layout. */
export const SHOWCASE_BENEFIT_LIMIT = 2

/** The portfolio list changes rarely; one fetch per meeting is enough. */
export const SHOWCASE_PROJECTS_STALE_MS = 300_000
```

Create `src/features/meeting-flow/constants/trade-benefit-exclusions.ts`:

```ts
// LAZY: stand-in for catalog-owned benefit copy (construction catalog design D4; stage-and-rail spec DA3).
// These `BENEFIT_TEMPLATES.byTrade` lines carry numeric claims that are not company constants, so they
// stay out of the homeowner's view until they are re-sourced or dropped. Delete this file when the copy moves.

/** Verbatim bodies from `constants/persona-profile-maps.ts`. */
export const TRADE_BENEFIT_EXCLUSIONS: ReadonlySet<string> = new Set([
  'Solar locks in your energy rate for 25+ years — no more rate hikes, and potential tax credits reduce the upfront cost',
  'ENERGY STAR windows can reduce heating/cooling costs by 12-33%, depending on your climate zone',
  'Insulation upgrades typically pay for themselves within 2-4 years through energy savings alone',
  'A high-efficiency system can cut your heating and cooling costs by 30-50% compared to an aging unit',
  'A modern bathroom remodel returns 60-70% at resale — and you get to enjoy it every single day until then',
  'Kitchen upgrades are the #1 ROI driver in real estate — buyers pay a premium for a move-in-ready kitchen',
  'Drought-resistant landscaping cuts water bills by 50-75% and eliminates maintenance headaches',
])
```

- [ ] **Step 5: Write the pure functions**

`src/features/meeting-flow/lib/index-showcase-projects.ts`:

```ts
import type { ShowcaseProject, ShowcaseProjectIndex, TradeScopeGroup } from '@/features/meeting-flow/types'
import type { PortfolioProject } from '@/shared/entities/projects/types'

/** Portfolio rows to lookups by trade and scope. Rows without a hero image are skipped: the showcase has nothing to show for them. */
export function indexShowcaseProjects(projects: PortfolioProject[], scopesByTrade: ReadonlyMap<string, TradeScopeGroup>): ShowcaseProjectIndex {
  const tradeOfScope = new Map<string, string>()
  for (const [tradeId, group] of scopesByTrade) {
    for (const entry of [...group.scopes, ...group.addons]) {
      tradeOfScope.set(entry.id, tradeId)
    }
  }

  const byScope = new Map<string, ShowcaseProject[]>()
  const tradeHits = new Map<string, { project: ShowcaseProject, hits: number }[]>()

  for (const row of projects) {
    if (!row.heroImage) {
      continue
    }
    const item: ShowcaseProject = {
      id: row.project.id,
      city: row.project.city,
      state: row.project.state,
      duration: row.project.projectDuration,
      heroImage: row.heroImage,
      scopeIds: row.scopeIds,
    }
    const hitsPerTrade = new Map<string, number>()
    for (const scopeId of row.scopeIds) {
      byScope.set(scopeId, [...(byScope.get(scopeId) ?? []), item])
      const tradeId = tradeOfScope.get(scopeId)
      if (tradeId) {
        hitsPerTrade.set(tradeId, (hitsPerTrade.get(tradeId) ?? 0) + 1)
      }
    }
    for (const [tradeId, hits] of hitsPerTrade) {
      tradeHits.set(tradeId, [...(tradeHits.get(tradeId) ?? []), { project: item, hits }])
    }
  }

  const byTrade = new Map<string, ShowcaseProject[]>()
  for (const [tradeId, list] of tradeHits) {
    byTrade.set(tradeId, [...list].sort((a, b) => b.hits - a.hits).map(entry => entry.project))
  }
  return { byTrade, byScope }
}
```

`src/features/meeting-flow/lib/format-project-caption.ts`:

```ts
import type { ShowcaseProject } from '@/features/meeting-flow/types'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'

export function formatProjectCaption(project: Pick<ShowcaseProject, 'city' | 'state' | 'duration'>): string {
  const place = [project.city, project.state].filter(Boolean).join(', ')
  return [SPECIALTIES_COPY.showcase.projectCaptionLead, place, project.duration].filter(Boolean).join(' · ')
}
```

`src/features/meeting-flow/lib/to-showcase-media.ts`:

```ts
import type { ShowcaseMedia, ShowcaseProject, TradePhoto } from '@/features/meeting-flow/types'
import { formatProjectCaption } from '@/features/meeting-flow/lib/format-project-caption'

export function curatedMedia(photo: TradePhoto): ShowcaseMedia {
  return { key: photo.src, kind: 'curated', photo, caption: photo.alt }
}

export function projectMedia(project: ShowcaseProject): ShowcaseMedia {
  return { key: `project:${project.id}`, kind: 'project', file: project.heroImage, caption: formatProjectCaption(project) }
}
```

`src/features/meeting-flow/lib/select-stage-media.ts`:

```ts
import type { ShowcaseMedia, ShowcaseProjectIndex } from '@/features/meeting-flow/types'
import type { ScopeOrAddon } from '@/shared/services/providers/notion/lib/scopes/schema'
import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'
import { SCOPE_PHOTOS, TRADE_PHOTOS } from '@/features/meeting-flow/constants/trade-photos'
import { curatedMedia, projectMedia } from '@/features/meeting-flow/lib/to-showcase-media'

/** Every photo the stage can show for a trade: the curated trade photo, curated scope photos, then portfolio projects. Deduped by key. */
export function selectStageMedia(trade: Trade, scopes: ScopeOrAddon[], index: ShowcaseProjectIndex): ShowcaseMedia[] {
  const list: ShowcaseMedia[] = []
  const seen = new Set<string>()
  const add = (media: ShowcaseMedia) => {
    if (!seen.has(media.key)) {
      seen.add(media.key)
      list.push(media)
    }
  }
  const tradePhoto = TRADE_PHOTOS[trade.slug]
  if (tradePhoto) {
    add(curatedMedia(tradePhoto))
  }
  for (const scope of scopes) {
    const scopePhoto = SCOPE_PHOTOS[scope.name]
    if (scopePhoto) {
      add(curatedMedia(scopePhoto))
    }
  }
  for (const project of index.byTrade.get(trade.id) ?? []) {
    add(projectMedia(project))
  }
  return list
}

/** The media with `key`, else the first; `undefined` when the trade has no photos (the fallback renders). */
export function findStageMedia(list: ShowcaseMedia[], key: string | null): ShowcaseMedia | undefined {
  return (key ? list.find(media => media.key === key) : undefined) ?? list[0]
}
```

`src/features/meeting-flow/lib/select-scope-media.ts`:

```ts
import type { ShowcaseMedia, ShowcaseProjectIndex } from '@/features/meeting-flow/types'
import type { ScopeOrAddon } from '@/shared/services/providers/notion/lib/scopes/schema'
import { SCOPE_PHOTOS } from '@/features/meeting-flow/constants/trade-photos'
import { curatedMedia, projectMedia } from '@/features/meeting-flow/lib/to-showcase-media'

/** A scope's curated photo, else its first tagged portfolio project; null when it has neither. */
export function selectScopeMedia(scope: ScopeOrAddon, index: ShowcaseProjectIndex): ShowcaseMedia | null {
  const photo = SCOPE_PHOTOS[scope.name]
  if (photo) {
    return curatedMedia(photo)
  }
  const project = index.byScope.get(scope.id)?.[0]
  return project ? projectMedia(project) : null
}
```

`src/features/meeting-flow/lib/select-trade-benefits.ts`:

```ts
import type { TradeBenefit } from '@/features/meeting-flow/types'
import { BENEFIT_TEMPLATES } from '@/features/meeting-flow/constants/persona-profile-maps'
import { TRADE_BENEFIT_EXCLUSIONS } from '@/features/meeting-flow/constants/trade-benefit-exclusions'

/** Homeowner-voiced benefit lines for a trade, in template order, without the excluded numeric claims. */
export function selectTradeBenefits(tradeName: string, limit: number): TradeBenefit[] {
  const benefits: TradeBenefit[] = []
  for (const template of Object.values(BENEFIT_TEMPLATES)) {
    const body = template.byTrade[tradeName]
    if (body && !TRADE_BENEFIT_EXCLUSIONS.has(body)) {
      benefits.push({ headline: template.headline, body })
    }
  }
  return benefits.slice(0, limit)
}
```

`src/features/meeting-flow/lib/resolve-stage-trade.ts`:

```ts
import type { TradeCatalog } from '@/features/meeting-flow/types'
import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import { selectedTradeSelections } from '@/features/meeting-flow/lib/trade-selection'

/** Only catalog trades can be on stage: the showcase needs the trade's slug, category and scopes. */
export function resolveStageTradeId(urlTradeId: string | null, selections: TradeSelection[], catalog: Pick<TradeCatalog, 'trades' | 'tradesById'>): string | null {
  if (urlTradeId && catalog.tradesById.has(urlTradeId)) {
    return urlTradeId
  }
  const firstOnProject = selectedTradeSelections(selections).find(entry => catalog.tradesById.has(entry.tradeId))
  return firstOnProject?.tradeId ?? catalog.trades[0]?.id ?? null
}
```

`src/features/meeting-flow/lib/format-work-summary.ts`:

```ts
import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'

export function formatWorkSummary(entry: TradeSelection): string {
  const [first, ...rest] = entry.selectedScopes
  if (!first) {
    return SPECIALTIES_COPY.panel.noWork
  }
  return rest.length > 0 ? SPECIALTIES_COPY.panel.workSummary(first.label, rest.length) : first.label
}
```

`src/features/meeting-flow/lib/group-trades-for-switcher.ts`:

```ts
import type { TradeCategory } from '@/features/meeting-flow/constants/trade-categories'
import type { SwitcherGroup } from '@/features/meeting-flow/types'
import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { TRADE_CATEGORY_LABELS, TRADE_CATEGORY_ORDER } from '@/features/meeting-flow/constants/trade-categories'
import { isTradeSelected } from '@/features/meeting-flow/lib/trade-selection'

/** "On your project" first (catalog order), then each category without the on-project trades. Empty groups are dropped. */
export function groupTradesForSwitcher(trades: Trade[], selections: TradeSelection[]): SwitcherGroup[] {
  const onProject = trades.filter(trade => isTradeSelected(selections, trade.id))
  const rest = trades.filter(trade => !isTradeSelected(selections, trade.id))
  const groups: SwitcherGroup[] = [
    { key: 'on-project', label: SPECIALTIES_COPY.work.onProject, trades: onProject },
    ...TRADE_CATEGORY_ORDER.map(category => ({
      key: category,
      label: TRADE_CATEGORY_LABELS[category as TradeCategory],
      trades: rest.filter(trade => trade.type === category),
    })),
  ]
  return groups.filter(group => group.trades.length > 0)
}
```

Append to `src/features/meeting-flow/lib/trade-selection.ts`:

```ts
/** Puts an entry back (Undo), replacing any entry for the same trade, at the end of the list. */
export function withTradeRestored(selections: TradeSelection[], entry: TradeSelection): TradeSelection[] {
  return [...withoutTrade(selections, entry.tradeId), entry]
}

/** True when `itemId` is the entry's only item, so removing it empties the trade (spec §4.2.3). */
export function isOnlyItem(entry: TradeSelection | undefined, itemId: string): boolean {
  return entry?.selectedScopes.length === 1 && entry.selectedScopes[0]?.id === itemId
}
```

- [ ] **Step 6: Run the assertion script to verify it passes**

Run: `pnpm exec tsx /tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/653d8fe9-43af-47b1-9087-a9bf54a9f03e/scratchpad/checks/stage-lib.ts`
Expected: `stage-lib: all assertions passed`.

- [ ] **Step 7: Write the portfolio hook**

`src/features/meeting-flow/hooks/use-showcase-projects.ts`:

```ts
'use client'

// LAZY: reads `projectsRouter.showroomDisplay.getAll` until the Who We Are round 2 projects read model lands
// (docs/plans/2026-09-14-upgrading-meeting-flow-epic.md R3 `scopeIds` filter, R10 public projection, S1).
// Swap the query in this file (Task 9); `ShowcaseProjectIndex` stays the contract for every consumer.

import type { ShowcaseProjectIndex, TradeScopeGroup } from '@/features/meeting-flow/types'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { SHOWCASE_PROJECTS_STALE_MS } from '@/features/meeting-flow/constants/showcase'
import { indexShowcaseProjects } from '@/features/meeting-flow/lib/index-showcase-projects'
import { useTRPC } from '@/trpc/helpers'

/** Portfolio projects with a hero image, indexed by trade and scope. Empty while loading or on error: the showcase falls back, silently. */
export function useShowcaseProjects(scopesByTrade: ReadonlyMap<string, TradeScopeGroup>): ShowcaseProjectIndex {
  const trpc = useTRPC()
  const query = useQuery({ ...trpc.projectsRouter.showroomDisplay.getAll.queryOptions(), staleTime: SHOWCASE_PROJECTS_STALE_MS })
  return useMemo(() => indexShowcaseProjects(query.data ?? [], scopesByTrade), [query.data, scopesByTrade])
}
```

- [ ] **Step 8: Type-check and lint**

Run: `pnpm tsc && pnpm exec eslint --fix src/features/meeting-flow/types/index.ts src/features/meeting-flow/constants/specialties-copy.ts src/features/meeting-flow/constants/trade-selection.ts src/features/meeting-flow/constants/showcase.ts src/features/meeting-flow/constants/trade-benefit-exclusions.ts src/features/meeting-flow/lib/index-showcase-projects.ts src/features/meeting-flow/lib/to-showcase-media.ts src/features/meeting-flow/lib/format-project-caption.ts src/features/meeting-flow/lib/select-stage-media.ts src/features/meeting-flow/lib/select-scope-media.ts src/features/meeting-flow/lib/select-trade-benefits.ts src/features/meeting-flow/lib/resolve-stage-trade.ts src/features/meeting-flow/lib/format-work-summary.ts src/features/meeting-flow/lib/group-trades-for-switcher.ts src/features/meeting-flow/lib/trade-selection.ts src/features/meeting-flow/hooks/use-showcase-projects.ts`
Expected: exit 0. If `query.data` is not assignable to `PortfolioProject[]`, the router's inferred output differs from the entity type: map it in the hook with an explicit `as PortfolioProject[]` only if every field `indexShowcaseProjects` reads is present in the inferred type (check with a hover or `tsc` error text); otherwise report NEEDS_CONTEXT with the error.

- [ ] **Step 9: Commit**

```bash
N=$(git diff --cached --name-status | wc -l)
git add -- src/features/meeting-flow/constants/showcase.ts src/features/meeting-flow/constants/trade-benefit-exclusions.ts src/features/meeting-flow/lib/index-showcase-projects.ts src/features/meeting-flow/lib/to-showcase-media.ts src/features/meeting-flow/lib/format-project-caption.ts src/features/meeting-flow/lib/select-stage-media.ts src/features/meeting-flow/lib/select-scope-media.ts src/features/meeting-flow/lib/select-trade-benefits.ts src/features/meeting-flow/lib/resolve-stage-trade.ts src/features/meeting-flow/lib/format-work-summary.ts src/features/meeting-flow/lib/group-trades-for-switcher.ts src/features/meeting-flow/hooks/use-showcase-projects.ts
git commit -m "feat(meeting-flow): stage foundation: showcase and stage types, copy, portfolio index, stage media, benefits and switcher selectors" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- src/features/meeting-flow/types/index.ts src/features/meeting-flow/constants/specialties-copy.ts src/features/meeting-flow/constants/trade-selection.ts src/features/meeting-flow/constants/showcase.ts src/features/meeting-flow/constants/trade-benefit-exclusions.ts src/features/meeting-flow/lib/index-showcase-projects.ts src/features/meeting-flow/lib/to-showcase-media.ts src/features/meeting-flow/lib/format-project-caption.ts src/features/meeting-flow/lib/select-stage-media.ts src/features/meeting-flow/lib/select-scope-media.ts src/features/meeting-flow/lib/select-trade-benefits.ts src/features/meeting-flow/lib/resolve-stage-trade.ts src/features/meeting-flow/lib/format-work-summary.ts src/features/meeting-flow/lib/group-trades-for-switcher.ts src/features/meeting-flow/lib/trade-selection.ts src/features/meeting-flow/hooks/use-showcase-projects.ts
git show --stat HEAD && echo "staged before $N, now $(git diff --cached --name-status | wc -l)"
```

---
### Task 3: Split the selection provider into four contexts

A pure refactor: behavior is identical (the old step and the trade sheet still work), but a toggle no longer re-renders components that read only the catalog, and the stage state replaces the sheet state. The URL param keeps its name (`?trade=`).

**Files:**
- Create: `src/features/meeting-flow/contexts/{trade-catalog-context,trade-actions-context,trade-selections-context,trade-stage-context}.tsx`
- Delete: `src/features/meeting-flow/contexts/trade-selection-context.tsx`
- Modify: `src/features/meeting-flow/contexts/trade-selection-provider.tsx` (whole file)
- Modify: `src/features/meeting-flow/constants/query-parsers.ts:6`
- Modify: `src/features/meeting-flow/types/index.ts` (remove `TradeSelectionActions`, `TradeSelectionContextValue`, `OpenTradeOptions`, `TradeSheetState`)
- Modify (consumer migration): `src/features/meeting-flow/ui/components/steps/specialties/{index,project-strip,trade-catalog,trade-tile}.tsx`, `src/features/meeting-flow/ui/components/trade-sheet/{trade-sheet-host,trade-sheet-body,trade-sheet-footer,pairing-card,orphan-item-chips,reason-chip-group,scope-tile-group,trade-note-field}.tsx`

**Interfaces:**
- Consumes (Task 2): `TradeCatalogContextValue`, `TradeActions`, `TradeStageState`, `useShowcaseProjects`, `withTradeRestored`.
- Produces:
  - `useTradeCatalogContext(): TradeCatalogContextValue`
  - `useTradeActions(): TradeActions`
  - `useTradeSelections(): TradeSelection[]`
  - `useTradeStage(): TradeStageState` — **until Task 4, `stageTradeId` is the raw `?trade=` value (null when absent)**; Task 4 makes it the resolved stage trade.
  - `tradeStageParser` (renamed from `tradeSheetParser`).

- [ ] **Step 1: Create the four contexts**

`src/features/meeting-flow/contexts/trade-catalog-context.tsx`:

```tsx
'use client'

import type { TradeCatalogContextValue } from '@/features/meeting-flow/types'
import { createContext, use } from 'react'

/** The Notion catalog and the portfolio project index. Changes only when either read settles. */
export const TradeCatalogContext = createContext<TradeCatalogContextValue | null>(null)

export function useTradeCatalogContext(): TradeCatalogContextValue {
  const ctx = use(TradeCatalogContext)
  if (!ctx) {
    throw new Error('useTradeCatalogContext must be used inside <TradeSelectionProvider>')
  }
  return ctx
}
```

`src/features/meeting-flow/contexts/trade-actions-context.tsx`:

```tsx
'use client'

import type { TradeActions } from '@/features/meeting-flow/types'
import { createContext, use } from 'react'

/** Edit actions. Stable: reading this context never re-renders on a toggle. */
export const TradeActionsContext = createContext<TradeActions | null>(null)

export function useTradeActions(): TradeActions {
  const ctx = use(TradeActionsContext)
  if (!ctx) {
    throw new Error('useTradeActions must be used inside <TradeSelectionProvider>')
  }
  return ctx
}
```

`src/features/meeting-flow/contexts/trade-selections-context.tsx`:

```tsx
'use client'

import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import { createContext, use } from 'react'

/** The selection shadow. A new array on every edit; untouched entries keep their identity. */
export const TradeSelectionsContext = createContext<TradeSelection[] | null>(null)

export function useTradeSelections(): TradeSelection[] {
  const ctx = use(TradeSelectionsContext)
  if (!ctx) {
    throw new Error('useTradeSelections must be used inside <TradeSelectionProvider>')
  }
  return ctx
}
```

`src/features/meeting-flow/contexts/trade-stage-context.tsx`:

```tsx
'use client'

import type { TradeStageState } from '@/features/meeting-flow/types'
import { createContext, use } from 'react'

/** Which trade and photo are on stage. Changes when the rep shows another trade or photo, not on toggles. */
export const TradeStageContext = createContext<TradeStageState | null>(null)

export function useTradeStage(): TradeStageState {
  const ctx = use(TradeStageContext)
  if (!ctx) {
    throw new Error('useTradeStage must be used inside <TradeSelectionProvider>')
  }
  return ctx
}
```

- [ ] **Step 2: Rename the URL parser and remove the sheet types**

`src/features/meeting-flow/constants/query-parsers.ts` line 6:

```ts
export const tradeStageParser = parseAsString
```

In `src/features/meeting-flow/types/index.ts` delete the declarations of `TradeSelectionActions`, `TradeSelectionContextValue`, `OpenTradeOptions` and `TradeSheetState` (their replacements `TradeActions`, `TradeCatalogContextValue`, `TradeStageState` exist since Task 2).

- [ ] **Step 3: Rewrite the provider**

Replace the whole of `src/features/meeting-flow/contexts/trade-selection-provider.tsx` with (the shadow, write path and flush are unchanged from the shipped file; the actions, stage and context values are new):

```tsx
'use client'

import type { ReactNode } from 'react'
import type { MeetingFlowContext, SelectionItem, TradeActions, TradeCatalogContextValue, TradeStageState } from '@/features/meeting-flow/types'
import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import { useQueryState } from 'nuqs'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { tradeStageParser } from '@/features/meeting-flow/constants/query-parsers'
import { SELECTION_WRITE_DEBOUNCE_MS } from '@/features/meeting-flow/constants/trade-selection'
import { TradeActionsContext } from '@/features/meeting-flow/contexts/trade-actions-context'
import { TradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { TradeSelectionsContext } from '@/features/meeting-flow/contexts/trade-selections-context'
import { TradeStageContext } from '@/features/meeting-flow/contexts/trade-stage-context'
import { useShowcaseProjects } from '@/features/meeting-flow/hooks/use-showcase-projects'
import { useTradeCatalog } from '@/features/meeting-flow/hooks/use-trade-catalog'
import {
  canonicalSelectionsJson,
  findTradeSelection,
  normalizeForWrite,
  withItemToggled,
  withNote,
  withoutTrade,
  withReasonToggled,
  withTradeRestored,
} from '@/features/meeting-flow/lib/trade-selection'
import { useDebounce } from '@/shared/hooks/use-debounce'

interface TradeSelectionProviderProps {
  flowContext: MeetingFlowContext
  children: ReactNode
}

/**
 * One source of truth for step 2 and the meeting panel's Project section.
 *
 * Shadow: local `selections` seeded from `flowState.tradeSelections`. Re-seeded
 * when the server value changes to anything this provider did not write itself
 * (compared through `canonicalSelectionsJson`, since jsonb reorders keys), so a
 * stale refetch that lands after a newer write cannot roll the shadow back.
 *
 * Write path: after the first user action, the debounced shadow is normalized
 * (`normalizeForWrite`: empty entries the server does not hold are dropped) and
 * written when it differs from the server. A write is in flight from the moment
 * it is sent until the server echoes it; while in flight the same value is never
 * sent again. Once the echo has been seen, a later server value that is one of
 * this provider's own older writes is a rollback: the shadow keeps the newer value
 * and it is written again. A foreign server value re-seeds the shadow instead. A
 * write still inside the debounce window when the provider unmounts is sent from
 * the unmount cleanup.
 *
 * Four contexts, so each consumer re-renders only for what it reads: catalog +
 * portfolio projects (settles once), actions (stable), selections (every edit),
 * stage (when the rep shows another trade or photo).
 */
export function TradeSelectionProvider({ flowContext, children }: TradeSelectionProviderProps) {
  const { onFlowStateChange } = flowContext
  const catalog = useTradeCatalog()
  const projects = useShowcaseProjects(catalog.scopesByTrade)

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

  /** False from sending a write until the server echoes it. */
  const confirmedRef = useRef(true)
  /** Latest render's values, for the unmount cleanup. */
  const latestRef = useRef({ selections, serverSelections, serverJson, dirty, onFlowStateChange })
  useLayoutEffect(() => {
    latestRef.current = { selections, serverSelections, serverJson, dirty, onFlowStateChange }
  })

  const debounced = useDebounce(selections, SELECTION_WRITE_DEBOUNCE_MS)
  useEffect(() => {
    if (serverJson === lastWrittenRef.current) {
      confirmedRef.current = true
    }
    if (!dirty) {
      return
    }
    const normalized = normalizeForWrite(debounced, serverSelections)
    const json = canonicalSelectionsJson(normalized)
    if (json === serverJson) {
      return
    }
    // Same value as the last write: re-send only for a confirmed write rolled back to
    // an own older value. A foreign server value re-seeded the shadow, and `debounced`
    // still holds the previous value for one debounce window; writing it would clobber.
    if (json === lastWrittenRef.current && (!confirmedRef.current || !writtenRef.current.has(serverJson))) {
      return
    }
    lastWrittenRef.current = json
    confirmedRef.current = false
    writtenRef.current.add(json)
    onFlowStateChange({ tradeSelections: normalized })
  }, [debounced, dirty, onFlowStateChange, serverJson, serverSelections])

  useEffect(() => {
    const latest = latestRef
    const lastWritten = lastWrittenRef
    return () => {
      const { selections: pending, serverSelections: server, serverJson: currentServerJson, dirty: isDirty, onFlowStateChange: write } = latest.current
      if (!isDirty) {
        return
      }
      const normalized = normalizeForWrite(pending, server)
      const json = canonicalSelectionsJson(normalized)
      if (json !== lastWritten.current && json !== currentServerJson) {
        write({ tradeSelections: normalized })
      }
    }
  }, [])

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

  const removeTrade = useCallback((tradeId: string) => {
    setDirty(true)
    setSelections(current => withoutTrade(current, tradeId))
  }, [])

  const restoreTrade = useCallback((entry: TradeSelection) => {
    setDirty(true)
    setSelections(current => withTradeRestored(current, entry))
  }, [])

  const [stageTradeId, setStageTradeId] = useQueryState('trade', tradeStageParser)
  const [stageMediaKey, setStageMediaKey] = useState<string | null>(null)

  const showTrade = useCallback((tradeId: string | null) => {
    setStageMediaKey(null)
    void setStageTradeId(tradeId)
  }, [setStageTradeId])

  const showMedia = useCallback((key: string | null) => {
    setStageMediaKey(key)
  }, [])

  const catalogValue = useMemo<TradeCatalogContextValue>(() => ({ catalog, projects }), [catalog, projects])

  const actionsValue = useMemo<TradeActions>(
    () => ({ toggleItem, toggleReason, setNote, removeTrade, restoreTrade }),
    [toggleItem, toggleReason, setNote, removeTrade, restoreTrade],
  )

  const stageValue = useMemo<TradeStageState>(
    () => ({ stageTradeId, stageMediaKey, showTrade, showMedia }),
    [stageTradeId, stageMediaKey, showTrade, showMedia],
  )

  return (
    <TradeCatalogContext value={catalogValue}>
      <TradeActionsContext value={actionsValue}>
        <TradeSelectionsContext value={selections}>
          <TradeStageContext value={stageValue}>
            {children}
          </TradeStageContext>
        </TradeSelectionsContext>
      </TradeActionsContext>
    </TradeCatalogContext>
  )
}
```

Delete `src/features/meeting-flow/contexts/trade-selection-context.tsx`.

- [ ] **Step 4: Migrate the consumers**

Apply exactly these replacements (imports come from `@/features/meeting-flow/contexts/trade-{catalog,actions,selections,stage}-context`; remove the old `trade-selection-context` import in each file):

| File | Before | After |
|---|---|---|
| `steps/specialties/index.tsx` | `const { catalog } = useTradeSelection()` | `const { catalog } = useTradeCatalogContext()` |
| `steps/specialties/trade-catalog.tsx` | `const { catalog } = useTradeSelection()` | `const { catalog } = useTradeCatalogContext()` |
| `steps/specialties/project-strip.tsx` | `const { selections, catalog } = useTradeSelection()` / `const { openTrade } = useTradeSheet()` / `openTrade(selection.tradeId)` | `const selections = useTradeSelections()` + `const { catalog } = useTradeCatalogContext()` / `const { showTrade } = useTradeStage()` / `showTrade(selection.tradeId)` |
| `steps/specialties/trade-tile.tsx` | `const { selections, catalog } = useTradeSelection()` / `const { openTrade } = useTradeSheet()` / `openTrade(trade.id)` | `const selections = useTradeSelections()` + `const { catalog } = useTradeCatalogContext()` / `const { showTrade } = useTradeStage()` / `showTrade(trade.id)` |
| `trade-sheet/trade-sheet-body.tsx` | `const { selections, catalog } = useTradeSelection()`; prop `focusScopeId: string \| null` and `focusScopeId={focusScopeId}` on `ScopeTileGroup` | `const selections = useTradeSelections()` + `const { catalog } = useTradeCatalogContext()`; delete the `focusScopeId` prop from `TradeSheetBodyProps`, the destructure and the JSX attribute |
| `trade-sheet/trade-sheet-footer.tsx` | `const { selections, clearTrade } = useTradeSelection()` / `const { closeTrade } = useTradeSheet()` / `clearTrade(tradeId)` / `onClick={closeTrade}` | `const selections = useTradeSelections()` + `const { removeTrade } = useTradeActions()` / `const { showTrade } = useTradeStage()` / `removeTrade(tradeId)` / `onClick={() => showTrade(null)}` |
| `trade-sheet/pairing-card.tsx` | `const { selections, catalog } = useTradeSelection()` / `const { openTrade } = useTradeSheet()` / `openTrade(visible.paired.id)` | `const selections = useTradeSelections()` + `const { catalog } = useTradeCatalogContext()` / `const { showTrade } = useTradeStage()` / `showTrade(visible.paired.id)` |
| `trade-sheet/orphan-item-chips.tsx` | `const { toggleItem } = useTradeSelection()` | `const { toggleItem } = useTradeActions()` |
| `trade-sheet/reason-chip-group.tsx` | `const { toggleReason } = useTradeSelection()` | `const { toggleReason } = useTradeActions()` |
| `trade-sheet/trade-note-field.tsx` | `const { setNote } = useTradeSelection()` | `const { setNote } = useTradeActions()` |
| `trade-sheet/scope-tile-group.tsx` | `const { toggleItem } = useTradeSelection()`; prop `focusScopeId`; `groupRef`; the `useEffect` that scrolls to the focus scope; `ref={groupRef}` and `focused={scope.id === focusScopeId}` | `const { toggleItem } = useTradeActions()`; delete the prop, the ref, the effect (and `useEffect`/`useRef` imports) and both JSX attributes |

In `trade-sheet/trade-sheet-host.tsx` replace the body of `TradeSheetHostImpl` from its first line through the closing `)` of the returned JSX with:

```tsx
  const { stageTradeId, showTrade } = useTradeStage()
  const selections = useTradeSelections()
  const { catalog } = useTradeCatalogContext()

  const [shownTradeId, setShownTradeId] = useState<string | null>(stageTradeId)
  if (stageTradeId !== null && stageTradeId !== shownTradeId) {
    setShownTradeId(stageTradeId)
  }

  const trade = shownTradeId ? catalog.tradesById.get(shownTradeId) : undefined
  const stored = shownTradeId ? findTradeSelection(selections, shownTradeId) : undefined
  const title = trade?.name ?? stored?.tradeName ?? ''
  const description = trade?.type ? TRADE_CATEGORY_LABELS[trade.type as TradeCategory] : undefined

  // An id in the URL that neither the loaded catalog nor the stored selections know
  // has nothing to show and no title; close it instead of opening an empty dialog.
  const isUnknownTrade = stageTradeId !== null
    && !catalog.isLoading
    && !catalog.error
    && !catalog.tradesById.has(stageTradeId)
    && findTradeSelection(selections, stageTradeId) === undefined

  useEffect(() => {
    if (isUnknownTrade) {
      showTrade(null)
    }
  }, [isUnknownTrade, showTrade])

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      showTrade(null)
    }
  }, [showTrade])

  return (
    <ResponsiveSheet
      contentClassName="lg:max-w-xl"
      description={description}
      footer={shownTradeId && !catalog.isLoading && !catalog.error ? <TradeSheetFooter tradeId={shownTradeId} /> : undefined}
      open={stageTradeId !== null && !isUnknownTrade}
      title={title}
      onOpenChange={handleOpenChange}
    >
      {shownTradeId && <TradeSheetBody key={shownTradeId} tradeId={shownTradeId} />}
    </ResponsiveSheet>
  )
```

Then confirm nothing else uses the old names:

```bash
grep -rn "useTradeSelection\b\|useTradeSheet\|tradeSheetParser\|TradeSheetState\|OpenTradeOptions\|TradeSelectionContextValue\|TradeSelectionActions\|clearTrade\|focusScopeId" src --include=*.ts --include=*.tsx
```

Expected: no output.

- [ ] **Step 5: Type-check and lint**

Run: `pnpm tsc && pnpm exec eslint --fix src/features/meeting-flow/contexts src/features/meeting-flow/constants/query-parsers.ts src/features/meeting-flow/types/index.ts src/features/meeting-flow/ui/components/steps/specialties src/features/meeting-flow/ui/components/trade-sheet`
Expected: exit 0.

- [ ] **Step 6: Rendered check (behavior unchanged)**

Write `$SCRATCH/checks/task3-sheet.mjs`:

```js
import { setup } from '/tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/653d8fe9-43af-47b1-9087-a9bf54a9f03e/scratchpad/t7-common.mjs'

const PAGE_URL = 'http://localhost:3000/dashboard/meetings/2069fa85-0357-4550-8eb5-6ae40eacf5a9?step=2'
const { browser, page } = await setup({ width: 1440, height: 900 })
const errors = []
page.on('pageerror', e => errors.push(String(e)))
await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#trade-catalog-heading', { timeout: 90000 })
const tile = page.getByRole('button', { name: /^Kitchen Remodel/ }).first()
await tile.click()
await page.waitForSelector('[role="dialog"]')
const urlHasTrade = new URL(page.url()).searchParams.has('trade')
await page.keyboard.press('Escape')
await page.waitForTimeout(600)
const closed = await page.locator('[role="dialog"]').count()
const urlCleared = !new URL(page.url()).searchParams.has('trade')
const focusBack = await page.evaluate(() => document.activeElement?.textContent?.includes('Kitchen Remodel') ?? false)
console.log(JSON.stringify({ urlHasTrade, closed, urlCleared, focusBack, errors }))
await browser.close()
```

Run: `node /tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/653d8fe9-43af-47b1-9087-a9bf54a9f03e/scratchpad/checks/task3-sheet.mjs`
Expected: `{"urlHasTrade":true,"closed":0,"urlCleared":true,"focusBack":true,"errors":[]}`. (The script opens and closes a sheet only; it writes nothing.)

- [ ] **Step 7: Commit**

```bash
N=$(git diff --cached --name-status | wc -l)
git add -- src/features/meeting-flow/contexts/trade-catalog-context.tsx src/features/meeting-flow/contexts/trade-actions-context.tsx src/features/meeting-flow/contexts/trade-selections-context.tsx src/features/meeting-flow/contexts/trade-stage-context.tsx
git commit -m "refactor(meeting-flow): split trade selection into catalog, actions, selections and stage contexts" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- src/features/meeting-flow/contexts src/features/meeting-flow/constants/query-parsers.ts src/features/meeting-flow/types/index.ts src/features/meeting-flow/ui/components/steps/specialties src/features/meeting-flow/ui/components/trade-sheet
git show --stat HEAD && echo "staged before $N, now $(git diff --cached --name-status | wc -l)"
```

---

### Task 4: The stage: showcase, work column, split layout; retire the old step and the sheet

**Files:**
- Create: `src/features/meeting-flow/hooks/{use-stage-trade,use-trade-edits}.ts`
- Create: `src/features/meeting-flow/ui/components/trade-thumb.tsx`
- Create: `src/features/meeting-flow/ui/components/steps/specialties/{showcase,showcase-media,showcase-fallback,showcase-text,project-proof-strip,work-column,on-project-trades,trade-switcher,work-card-group,work-card,often-together}.tsx`
- Rewrite: `src/features/meeting-flow/ui/components/steps/specialties/index.tsx`
- Modify: `src/features/meeting-flow/contexts/trade-selection-provider.tsx` (resolved stage trade)
- Modify: `src/features/meeting-flow/types/index.ts:81` (`MeetingStepLayout`)
- Modify: `src/features/meeting-flow/constants/step-config.ts` (step 2 layout)
- Modify: `src/features/meeting-flow/ui/views/meeting-flow.tsx` (`StepRegion` class for `split`; remove `TradeSheetHost`)
- Modify: `src/features/meeting-flow/constants/specialties-copy.ts` (remove `introWithLead`, `introNoLead`, `project`, `catalog`)
- Modify: `src/features/meeting-flow/lib/trade-selection.ts` (remove `hasStoredEntry`, `countSelection`, `SelectionCounts` if unused after deletion)
- Delete: `src/features/meeting-flow/ui/components/steps/specialties/{project-strip,step-intro,trade-catalog,trade-tile}.tsx`; `src/features/meeting-flow/ui/components/trade-sheet/{trade-sheet-host,trade-sheet-body,trade-sheet-header,trade-sheet-footer,trade-photo,outcome-line,pairing-card,scope-tile-group,scope-tile}.tsx`; `src/features/meeting-flow/lib/{format-trade-meta,group-trades-by-category,filter-trades-by-query,format-selection-summary}.ts` (only after Step 9's grep shows no importers)

**Interfaces:**
- Consumes (Tasks 2–3): all four context hooks; `selectStageMedia`, `findStageMedia`, `selectScopeMedia`, `projectMedia`, `selectTradeBenefits`, `resolveStageTradeId`, `groupTradesForSwitcher`, `isOnlyItem`, `diffIds`, `selectedItemIds`, `selectedTradeSelections`, `findTradeSelection`, `itemCount`, `formatCount`; `SPECIALTIES_COPY.showcase/work/undo/units`; `SHOWCASE_*`, `UNDO_TOAST_MS`; `TRADE_OUTCOMES`, `TRADE_PAIRINGS`, `TRADE_CATEGORY_LABELS`; `Decor` (`@/shared/components/decor/decor`), `OptimizedImage` (`@/shared/components/optimized-image`).
- Produces:
  - `useTradeStage().stageTradeId` is now the **resolved** stage trade.
  - `useStageTrade(): Trade | undefined`
  - `useTradeEdits(): { toggleWork: (tradeId: string, entry: TradeSelection | undefined, item: SelectionItem) => void, removeWithUndo: (entry: TradeSelection) => void }`
  - `TradeThumb` props `{ trade: Trade | undefined, className?: string }`
  - `MeetingStepLayout = 'page' | 'presentation' | 'split'`

- [ ] **Step 1: Resolve the stage trade in the provider**

In `trade-selection-provider.tsx`: add `import { resolveStageTradeId } from '@/features/meeting-flow/lib/resolve-stage-trade'`; rename the query-state variables and derive the resolved id:

```tsx
  const [urlTradeId, setUrlTradeId] = useQueryState('trade', tradeStageParser)
  const [stageMediaKey, setStageMediaKey] = useState<string | null>(null)
  // A string: the memoized stage value below keeps its identity across toggles unless the resolved trade changes.
  const stageTradeId = resolveStageTradeId(urlTradeId, selections, catalog)

  const showTrade = useCallback((tradeId: string | null) => {
    setStageMediaKey(null)
    void setUrlTradeId(tradeId)
  }, [setUrlTradeId])
```

(`showMedia`, `stageValue` and the JSX stay as in Task 3.)

- [ ] **Step 2: Add the `split` layout**

`src/features/meeting-flow/types/index.ts:81`:

```ts
export type MeetingStepLayout = 'page' | 'presentation' | 'split'
```

In `src/features/meeting-flow/constants/step-config.ts`, step `specialties`: `layout: 'split',`.

In `src/features/meeting-flow/ui/views/meeting-flow.tsx`: change the page branch's `<StepRegion labelledBy={stepTitleId}>` to

```tsx
                    <StepRegion className={stepConfig.layout === 'split' ? 'overflow-hidden p-0 md:p-0' : undefined} labelledBy={stepTitleId}>
```

and delete the `<TradeSheetHost />` element and its import.

- [ ] **Step 3: The two hooks**

`src/features/meeting-flow/hooks/use-stage-trade.ts`:

```ts
'use client'

import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { useTradeStage } from '@/features/meeting-flow/contexts/trade-stage-context'

/** The catalog trade on stage. Reads no selections, so it does not re-render callers on toggles. */
export function useStageTrade(): Trade | undefined {
  const { catalog } = useTradeCatalogContext()
  const { stageTradeId } = useTradeStage()
  return stageTradeId ? catalog.tradesById.get(stageTradeId) : undefined
}
```

`src/features/meeting-flow/hooks/use-trade-edits.ts`:

```ts
'use client'

import type { SelectionItem } from '@/features/meeting-flow/types'
import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { UNDO_TOAST_MS } from '@/features/meeting-flow/constants/trade-selection'
import { useTradeActions } from '@/features/meeting-flow/contexts/trade-actions-context'
import { isOnlyItem } from '@/features/meeting-flow/lib/trade-selection'

/**
 * Edits with the step's removal rules (spec §4.2.3): unticking a trade's only item removes the
 * trade (items, reasons and note) and offers Undo, which restores the whole entry. Callers pass the
 * current entry, so the callbacks stay stable and read no selections.
 */
export function useTradeEdits() {
  const { toggleItem, removeTrade, restoreTrade } = useTradeActions()

  const removeWithUndo = useCallback((entry: TradeSelection) => {
    removeTrade(entry.tradeId)
    toast(SPECIALTIES_COPY.undo.tradeRemoved(entry.tradeName), {
      duration: UNDO_TOAST_MS,
      action: { label: SPECIALTIES_COPY.undo.action, onClick: () => restoreTrade(entry) },
    })
  }, [removeTrade, restoreTrade])

  const toggleWork = useCallback((tradeId: string, entry: TradeSelection | undefined, item: SelectionItem) => {
    if (entry && isOnlyItem(entry, item.id)) {
      removeWithUndo(entry)
      return
    }
    toggleItem(tradeId, item)
  }, [toggleItem, removeWithUndo])

  return useMemo(() => ({ toggleWork, removeWithUndo }), [toggleWork, removeWithUndo])
}
```

- [ ] **Step 4: The thumbnail and the showcase**

`src/features/meeting-flow/ui/components/trade-thumb.tsx`:

```tsx
'use client'

import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'
import Image from 'next/image'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { selectStageMedia } from '@/features/meeting-flow/lib/select-stage-media'
import { OptimizedImage } from '@/shared/components/optimized-image'
import { cn } from '@/shared/lib/utils'

interface TradeThumbProps {
  trade: Trade | undefined
  className?: string
}

/** The trade's first photo as a small square; a quiet muted tile when it has none. Decorative: the label beside it names the trade. */
export function TradeThumb({ trade, className }: TradeThumbProps) {
  const { projects } = useTradeCatalogContext()
  const media = trade ? selectStageMedia(trade, [], projects)[0] : undefined

  return (
    <span aria-hidden className={cn('relative block size-10 shrink-0 overflow-hidden rounded-[3px] bg-muted', className)}>
      {media?.kind === 'project' && <OptimizedImage alt="" fill file={media.file} sizes="48px" />}
      {media?.kind === 'curated' && <Image alt="" className="object-cover" fill sizes="48px" src={media.photo.src} />}
    </span>
  )
}
```

`src/features/meeting-flow/ui/components/steps/specialties/showcase-media.tsx`:

```tsx
'use client'

import type { ShowcaseMedia as ShowcaseMediaData } from '@/features/meeting-flow/types'
import { AnimatePresence, motion } from 'motion/react'
import Image from 'next/image'
import { SHOWCASE_CROSSFADE } from '@/features/meeting-flow/constants/showcase'
import { OptimizedImage } from '@/shared/components/optimized-image'

interface ShowcaseMediaProps {
  media: ShowcaseMediaData
}

/**
 * The stage photo. Keyed on the media key: a new photo fades in over the old one; the same key
 * never remounts (spec §4.4 budget: the image node changes only when the key changes). The scrim is
 * tall and dense in the band layout (text sits on it) and short at two columns (only the caption).
 */
export function ShowcaseMedia({ media }: ShowcaseMediaProps) {
  return (
    <div className="absolute inset-0">
      <AnimatePresence initial={false}>
        <motion.div
          key={media.key}
          animate={{ opacity: 1 }}
          className="absolute inset-0"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          transition={SHOWCASE_CROSSFADE}
        >
          {media.kind === 'project'
            ? <OptimizedImage alt={media.caption} className="object-cover" fill file={media.file} priority sizes="(min-width: 1024px) 60vw, 100vw" />
            : <Image alt={media.caption} className="object-cover" fill priority sizes="(min-width: 1024px) 60vw, 100vw" src={media.photo.src} />}
        </motion.div>
      </AnimatePresence>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-t from-(--presentation-ground) via-(--presentation-ground)/60 to-transparent @4xl/specialties:h-2/5 @4xl/specialties:from-black/55 @4xl/specialties:via-transparent" />
      <p className="absolute bottom-4 left-5 z-10 hidden text-[13px] text-white [text-shadow:0_1px_8px_rgb(0_0_0/0.6)] @4xl/specialties:block">
        {media.caption}
      </p>
    </div>
  )
}
```

`src/features/meeting-flow/ui/components/steps/specialties/showcase-fallback.tsx`:

```tsx
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { Decor } from '@/shared/components/decor/decor'

interface ShowcaseFallbackProps {
  scopeNames: string[]
}

/**
 * A trade with no owned photo: the blueprint decor (anchored top-right, DESIGN.md Atmosphere) and what the
 * trade includes. Never an empty frame. The decor tokens are defined for the marketing theme only, so they
 * are set here for the app theme.
 */
export function ShowcaseFallback({ scopeNames }: ShowcaseFallbackProps) {
  return (
    <div className="absolute inset-0 isolate flex flex-col justify-start overflow-hidden bg-white/[0.04] p-6 [--decor-gradient-alpha:0.34] [--decor-stroke:#03afed] @4xl/specialties:justify-end @4xl/specialties:px-10 @4xl/specialties:pb-8">
      <Decor className="z-0" rings={9} shape="arc" />
      <div className="relative z-10 hidden max-w-[56ch] flex-col gap-2 @4xl/specialties:flex">
        <p className="font-sans text-xs font-semibold tracking-[0.06em] text-(--presentation-accent) uppercase">{SPECIALTIES_COPY.showcase.included}</p>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-base font-semibold text-white">
          {scopeNames.length > 0
            ? scopeNames.map(name => <li key={name}>{name}</li>)
            : <li>{SPECIALTIES_COPY.showcase.scopesToDefine}</li>}
        </ul>
      </div>
    </div>
  )
}
```

`src/features/meeting-flow/ui/components/steps/specialties/project-proof-strip.tsx`:

```tsx
'use client'

import type { ShowcaseProject } from '@/features/meeting-flow/types'
import { SHOWCASE_PROOF_LIMIT } from '@/features/meeting-flow/constants/showcase'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeStage } from '@/features/meeting-flow/contexts/trade-stage-context'
import { projectMedia } from '@/features/meeting-flow/lib/to-showcase-media'
import { OptimizedImage } from '@/shared/components/optimized-image'
import { Toggle } from '@/shared/components/ui/toggle'

interface ProjectProofStripProps {
  projects: ShowcaseProject[]
  currentKey: string | null
}

/** "Our projects · N" and up to four thumbnails that put that project on stage. Hidden below two projects. */
export function ProjectProofStrip({ projects, currentKey }: ProjectProofStripProps) {
  const { showMedia } = useTradeStage()

  if (projects.length < 2) {
    return null
  }

  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-1.5 @4xl/specialties:top-auto @4xl/specialties:right-5 @4xl/specialties:bottom-4">
      <p className="text-xs font-semibold text-white [text-shadow:0_1px_6px_rgb(0_0_0/0.7)]">
        {`${SPECIALTIES_COPY.showcase.ourProjects} · ${projects.length}`}
      </p>
      <div className="flex gap-2">
        {projects.slice(0, SHOWCASE_PROOF_LIMIT).map((project) => {
          const media = projectMedia(project)
          return (
            <Toggle
              key={project.id}
              aria-label={media.caption}
              className="relative h-13 w-18 overflow-hidden rounded-[3px] border-2 border-white/50 p-0 hover:bg-transparent data-[state=on]:border-white data-[state=on]:bg-transparent"
              pressed={currentKey === media.key}
              onPressedChange={() => showMedia(media.key)}
            >
              <OptimizedImage alt="" fill file={project.heroImage} sizes="72px" />
            </Toggle>
          )
        })}
      </div>
    </div>
  )
}
```

`src/features/meeting-flow/ui/components/steps/specialties/showcase-text.tsx`:

```tsx
'use client'

import type { TradeCategory } from '@/features/meeting-flow/constants/trade-categories'
import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'
import { CheckIcon } from 'lucide-react'
import { SHOWCASE_BENEFIT_LIMIT } from '@/features/meeting-flow/constants/showcase'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { TRADE_CATEGORY_LABELS } from '@/features/meeting-flow/constants/trade-categories'
import { TRADE_OUTCOMES } from '@/features/meeting-flow/constants/trade-outcomes'
import { useTradeSelections } from '@/features/meeting-flow/contexts/trade-selections-context'
import { formatCount } from '@/features/meeting-flow/lib/format-count'
import { selectTradeBenefits } from '@/features/meeting-flow/lib/select-trade-benefits'
import { findTradeSelection, itemCount } from '@/features/meeting-flow/lib/trade-selection'

interface ShowcaseTextProps {
  trade: Trade
  titleId: string
}

/**
 * Eyebrow, title, outcome (the lead), status, benefits. In the band layout it overlays the photo's scrim;
 * at two columns it sits under the photo and clears the floating capsule. Title 30/36px Syne 600, outcome 17/20px.
 */
export function ShowcaseText({ trade, titleId }: ShowcaseTextProps) {
  const selections = useTradeSelections()
  const count = itemCount(findTradeSelection(selections, trade.id))
  const outcome = TRADE_OUTCOMES[trade.slug]
  const benefits = selectTradeBenefits(trade.name, SHOWCASE_BENEFIT_LIMIT)
  const category = trade.type ? TRADE_CATEGORY_LABELS[trade.type as TradeCategory] : undefined

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 p-6 @4xl/specialties:static @4xl/specialties:px-10 @4xl/specialties:pt-6 @4xl/specialties:pb-(--stage-inset-b)">
      {category && <p className="font-sans text-xs font-semibold tracking-[0.06em] text-white/80 uppercase">{category}</p>}
      <h2 className="font-sans text-3xl leading-[1.1] font-semibold tracking-[-0.01em] text-balance @4xl/specialties:text-4xl" id={titleId}>
        {trade.name}
      </h2>
      {outcome && (
        <p className="line-clamp-3 max-w-[48ch] text-[17px] leading-normal text-pretty text-white @4xl/specialties:line-clamp-none @4xl/specialties:max-w-[44ch] @4xl/specialties:text-xl">
          {outcome}
        </p>
      )}
      {count > 0 && (
        <p className="flex items-center gap-2 text-sm font-semibold text-(--presentation-accent)">
          <CheckIcon aria-hidden className="size-4" />
          {`${SPECIALTIES_COPY.showcase.status} · ${formatCount(count, SPECIALTIES_COPY.units.work)}`}
        </p>
      )}
      {benefits.length > 0 && (
        <ul className="mt-2 hidden grid-cols-2 gap-x-8 gap-y-4 @4xl/specialties:grid">
          {benefits.map(benefit => (
            <li key={benefit.headline} className="flex flex-col gap-0.5 border-t border-white/15 pt-3">
              <span className="text-base font-semibold text-white">{benefit.headline}</span>
              <span className="text-[15px] leading-normal text-white/75">{benefit.body}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

`src/features/meeting-flow/ui/components/steps/specialties/showcase.tsx`:

```tsx
'use client'

import { useId } from 'react'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { useTradeStage } from '@/features/meeting-flow/contexts/trade-stage-context'
import { useStageTrade } from '@/features/meeting-flow/hooks/use-stage-trade'
import { findStageMedia, selectStageMedia } from '@/features/meeting-flow/lib/select-stage-media'
import { ProjectProofStrip } from '@/features/meeting-flow/ui/components/steps/specialties/project-proof-strip'
import { ShowcaseFallback } from '@/features/meeting-flow/ui/components/steps/specialties/showcase-fallback'
import { ShowcaseMedia } from '@/features/meeting-flow/ui/components/steps/specialties/showcase-media'
import { ShowcaseText } from '@/features/meeting-flow/ui/components/steps/specialties/showcase-text'

/**
 * The homeowner's column: pinned, never scrolls. Re-renders when the stage trade, the stage photo or the
 * catalog changes; a toggle re-renders only `ShowcaseText`.
 */
export function Showcase() {
  const trade = useStageTrade()
  const { catalog, projects } = useTradeCatalogContext()
  const { stageMediaKey } = useTradeStage()
  const titleId = useId()

  if (!trade) {
    return <section aria-hidden className="bg-(--presentation-ground)" />
  }

  const scopes = catalog.scopesByTrade.get(trade.id)?.scopes ?? []
  const current = findStageMedia(selectStageMedia(trade, scopes, projects), stageMediaKey)

  return (
    <section
      aria-labelledby={titleId}
      className="relative isolate min-h-0 overflow-hidden bg-(--presentation-ground) text-white @4xl/specialties:grid @4xl/specialties:grid-rows-[minmax(0,1fr)_auto]"
    >
      <div className="absolute inset-0 @4xl/specialties:relative @4xl/specialties:inset-auto @4xl/specialties:min-h-0">
        {current
          ? <ShowcaseMedia media={current} />
          : <ShowcaseFallback scopeNames={scopes.map(scope => scope.name)} />}
        <ProjectProofStrip currentKey={current?.key ?? null} projects={projects.byTrade.get(trade.id) ?? []} />
      </div>
      <ShowcaseText titleId={titleId} trade={trade} />
    </section>
  )
}
```

- [ ] **Step 5: The work column**

`src/features/meeting-flow/ui/components/steps/specialties/on-project-trades.tsx`:

```tsx
'use client'

import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { useTradeSelections } from '@/features/meeting-flow/contexts/trade-selections-context'
import { useTradeStage } from '@/features/meeting-flow/contexts/trade-stage-context'
import { itemCount, selectedTradeSelections } from '@/features/meeting-flow/lib/trade-selection'
import { TradeThumb } from '@/features/meeting-flow/ui/components/trade-thumb'
import { Button } from '@/shared/components/ui/button'

/** Trades already on the project, above the switcher (spec D7). Keeps its height when empty so nothing below jumps. */
export function OnProjectTrades() {
  const selections = useTradeSelections()
  const { catalog } = useTradeCatalogContext()
  const { stageTradeId, showTrade } = useTradeStage()
  const onProject = selectedTradeSelections(selections)

  return (
    <div className="flex min-h-19 flex-col gap-2">
      <h3 className="font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{SPECIALTIES_COPY.work.onProject}</h3>
      {onProject.length === 0
        ? <p className="text-sm text-muted-foreground">{SPECIALTIES_COPY.work.onProjectEmpty}</p>
        : (
            <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]">
              {onProject.map(entry => (
                <li key={entry.tradeId} className="shrink-0">
                  <Button
                    aria-current={entry.tradeId === stageTradeId ? 'true' : undefined}
                    className="h-12 gap-2 pr-3 pl-1 aria-[current=true]:border-primary aria-[current=true]:outline-2 aria-[current=true]:-outline-offset-2 aria-[current=true]:outline-primary"
                    variant="outline"
                    onClick={() => showTrade(entry.tradeId)}
                  >
                    <TradeThumb trade={catalog.tradesById.get(entry.tradeId)} />
                    <span className="text-sm font-semibold">{entry.tradeName}</span>
                    <span className="text-sm font-normal text-muted-foreground tabular-nums">{itemCount(entry)}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
    </div>
  )
}
```

`src/features/meeting-flow/ui/components/steps/specialties/trade-switcher.tsx`:

```tsx
'use client'

import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { useTradeSelections } from '@/features/meeting-flow/contexts/trade-selections-context'
import { useTradeStage } from '@/features/meeting-flow/contexts/trade-stage-context'
import { formatCount } from '@/features/meeting-flow/lib/format-count'
import { groupTradesForSwitcher } from '@/features/meeting-flow/lib/group-trades-for-switcher'
import { isTradeSelected } from '@/features/meeting-flow/lib/trade-selection'
import { TradeThumb } from '@/features/meeting-flow/ui/components/trade-thumb'
import { Button } from '@/shared/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/shared/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'

interface TradeSwitcherProps {
  trade: Trade
}

/**
 * The trade on stage as a combobox (cmdk): type to filter, arrows and Enter, Escape closes the popover
 * before anything else (Radix marks the event, `useMeetingFlowKeys` skips it). Heads the work group.
 */
export function TradeSwitcher({ trade }: TradeSwitcherProps) {
  const [open, setOpen] = useState(false)
  const { catalog } = useTradeCatalogContext()
  const selections = useTradeSelections()
  const { showTrade } = useTradeStage()
  const groups = groupTradesForSwitcher(catalog.trades, selections)

  function handleSelect(tradeId: string) {
    setOpen(false)
    showTrade(tradeId)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button aria-label={`${SPECIALTIES_COPY.work.switchLabel}: ${trade.name}`} className="h-auto min-h-15 w-full justify-between gap-3 py-1.5 pr-3.5 pl-1.5 text-left" variant="outline">
          <span className="flex min-w-0 items-center gap-3">
            <TradeThumb className="size-11" trade={trade} />
            <span className="flex min-w-0 flex-col">
              <span className="text-[13px] font-normal text-muted-foreground">{SPECIALTIES_COPY.work.tradeLabel}</span>
              <span className="truncate font-sans text-lg font-semibold">{trade.name}</span>
            </span>
          </span>
          <ChevronDownIcon aria-hidden className="size-5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        <Command>
          <CommandInput className="h-11 text-base" placeholder={SPECIALTIES_COPY.work.filterPlaceholder} />
          <CommandList className="max-h-[min(540px,60vh)]">
            <CommandEmpty>{SPECIALTIES_COPY.work.noMatches}</CommandEmpty>
            {groups.map(group => (
              <CommandGroup key={group.key} heading={group.label}>
                {group.trades.map((option) => {
                  const kinds = catalog.scopesByTrade.get(option.id)?.scopes.length ?? 0
                  const meta = isTradeSelected(selections, option.id)
                    ? SPECIALTIES_COPY.work.onYourProject
                    : kinds > 0 ? formatCount(kinds, SPECIALTIES_COPY.units.kind) : SPECIALTIES_COPY.showcase.scopesToDefine
                  return (
                    <CommandItem key={option.id} className="min-h-13 gap-3" value={`${option.name} ${option.id}`} onSelect={() => handleSelect(option.id)}>
                      <TradeThumb trade={option} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-semibold">{option.name}</span>
                        <span className="text-[13px] text-muted-foreground">{meta}</span>
                      </span>
                      {option.id === trade.id && <CheckIcon aria-hidden className="size-4" />}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

`src/features/meeting-flow/ui/components/steps/specialties/work-card.tsx`:

```tsx
'use client'

import type { ShowcaseMedia } from '@/features/meeting-flow/types'
import { CheckIcon, PlusIcon } from 'lucide-react'
import Image from 'next/image'
import { memo } from 'react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { Decor } from '@/shared/components/decor/decor'
import { OptimizedImage } from '@/shared/components/optimized-image'
import { ToggleGroupItem } from '@/shared/components/ui/toggle-group'

interface WorkCardProps {
  scopeId: string
  name: string
  media: ShowcaseMedia | null
}

/**
 * One kind of work. Pressed state is Radix `data-state` and pure CSS, so this component never re-renders
 * on a toggle. Selected = primary outline + check badge + "On your project"; never color alone, no shadow on
 * the clipping element. No pricing unit, no caption.
 */
function WorkCardImpl({ scopeId, name, media }: WorkCardProps) {
  return (
    <ToggleGroupItem
      className="group relative h-auto w-full flex-none flex-col items-stretch justify-start gap-0 overflow-hidden rounded-md border border-border bg-card p-0 text-left whitespace-normal transition-[border-color,outline-color] duration-200 first:rounded-md last:rounded-md hover:bg-card hover:text-foreground data-[state=on]:border-primary data-[state=on]:bg-card data-[state=on]:outline-2 data-[state=on]:-outline-offset-2 data-[state=on]:outline-primary"
      data-scope-id={scopeId}
      value={scopeId}
    >
      <span className="relative isolate block aspect-[4/3] w-full overflow-hidden bg-muted">
        {media?.kind === 'project' && <OptimizedImage alt="" fill file={media.file} sizes="(min-width: 1024px) 20vw, 50vw" />}
        {media?.kind === 'curated' && <Image alt="" className="object-cover" fill sizes="(min-width: 1024px) 20vw, 50vw" src={media.photo.src} />}
        {!media && <Decor className="z-0 [--decor-gradient-alpha:0.2] [--decor-stroke:#03afed]" rings={6} shape="arc" />}
        <span aria-hidden className="absolute top-2 right-2 z-10 grid size-7 scale-60 place-items-center rounded-full bg-primary text-primary-foreground opacity-0 transition-[opacity,scale] duration-200 group-data-[state=on]:scale-100 group-data-[state=on]:opacity-100">
          <CheckIcon className="size-4" />
        </span>
      </span>
      <span className="flex flex-col gap-1.5 p-3">
        <span className="text-base leading-snug font-semibold">{name}</span>
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground group-data-[state=on]:text-foreground">
          <PlusIcon aria-hidden className="size-3.5 group-data-[state=on]:hidden" />
          <CheckIcon aria-hidden className="hidden size-3.5 text-primary group-data-[state=on]:block" />
          <span className="group-data-[state=on]:hidden">{SPECIALTIES_COPY.work.add}</span>
          <span className="hidden group-data-[state=on]:inline">{SPECIALTIES_COPY.work.onYourProject}</span>
        </span>
      </span>
    </ToggleGroupItem>
  )
}

export const WorkCard = memo(WorkCardImpl)
```

`src/features/meeting-flow/ui/components/steps/specialties/work-card-group.tsx`:

```tsx
'use client'

import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'
import { useMemo } from 'react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { useTradeSelections } from '@/features/meeting-flow/contexts/trade-selections-context'
import { useTradeStage } from '@/features/meeting-flow/contexts/trade-stage-context'
import { useTradeEdits } from '@/features/meeting-flow/hooks/use-trade-edits'
import { formatCount } from '@/features/meeting-flow/lib/format-count'
import { selectScopeMedia } from '@/features/meeting-flow/lib/select-scope-media'
import { diffIds, findTradeSelection, selectedItemIds } from '@/features/meeting-flow/lib/trade-selection'
import { WorkCard } from '@/features/meeting-flow/ui/components/steps/specialties/work-card'
import { ToggleGroup } from '@/shared/components/ui/toggle-group'

interface WorkCardGroupProps {
  trade: Trade
}

/**
 * The stage trade's kinds of work. Adding one puts its project photo on stage; unticking the only one takes
 * the trade off the project with Undo (`useTradeEdits`). Cards take stable props, so a toggle re-renders the
 * group and the Radix items, never the cards' content.
 */
export function WorkCardGroup({ trade }: WorkCardGroupProps) {
  const { catalog, projects } = useTradeCatalogContext()
  const selections = useTradeSelections()
  const { showMedia } = useTradeStage()
  const { toggleWork } = useTradeEdits()

  const scopes = catalog.scopesByTrade.get(trade.id)?.scopes
  const entry = findTradeSelection(selections, trade.id)
  const selectedIds = useMemo(() => selectedItemIds(entry), [entry])
  const mediaByScope = useMemo(
    () => new Map((scopes ?? []).map(scope => [scope.id, selectScopeMedia(scope, projects)])),
    [scopes, projects],
  )

  if (!scopes || scopes.length === 0) {
    return <p className="text-sm text-muted-foreground">{SPECIALTIES_COPY.work.noWork(trade.name)}</p>
  }

  function handleValueChange(next: string[]) {
    const { added, removed } = diffIds(selectedIds, next)
    for (const id of [...added, ...removed]) {
      const scope = scopes?.find(entryScope => entryScope.id === id)
      if (!scope) {
        continue
      }
      toggleWork(trade.id, entry, { id: scope.id, label: scope.name })
      const media = mediaByScope.get(id)
      if (added.includes(id) && media) {
        showMedia(media.key)
      }
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted-foreground">{`${formatCount(scopes.length, SPECIALTIES_COPY.units.kind)} · ${SPECIALTIES_COPY.work.tapToAdd}`}</p>
      <ToggleGroup
        aria-label={SPECIALTIES_COPY.work.groupLabel(trade.name)}
        className="grid w-full grid-cols-2 gap-3 @min-[40rem]/specialties:grid-cols-3 @4xl/specialties:grid-cols-2"
        type="multiple"
        value={selectedIds}
        onValueChange={handleValueChange}
      >
        {scopes.map(scope => (
          <WorkCard key={scope.id} media={mediaByScope.get(scope.id) ?? null} name={scope.name} scopeId={scope.id} />
        ))}
      </ToggleGroup>
    </div>
  )
}
```

`src/features/meeting-flow/ui/components/steps/specialties/often-together.tsx`:

```tsx
'use client'

import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { TRADE_PAIRINGS } from '@/features/meeting-flow/constants/trade-pairings'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { useTradeSelections } from '@/features/meeting-flow/contexts/trade-selections-context'
import { useTradeStage } from '@/features/meeting-flow/contexts/trade-stage-context'
import { isTradeSelected } from '@/features/meeting-flow/lib/trade-selection'
import { TradeThumb } from '@/features/meeting-flow/ui/components/trade-thumb'
import { Button } from '@/shared/components/ui/button'

interface OftenTogetherProps {
  trade: Trade
}

/** Homeowner-safe pairing prompt: names the pair, never the internal reason (that lives in the panel). Shown when this trade is on the project and its pair is not. */
export function OftenTogether({ trade }: OftenTogetherProps) {
  const { catalog } = useTradeCatalogContext()
  const selections = useTradeSelections()
  const { showTrade } = useTradeStage()
  const pairing = TRADE_PAIRINGS[trade.slug]
  const paired = pairing ? catalog.tradesBySlug.get(pairing.pairedSlug) : undefined

  if (!paired || !isTradeSelected(selections, trade.id) || isTradeSelected(selections, paired.id)) {
    return null
  }

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border bg-card p-2">
      <TradeThumb className="size-11" trade={paired} />
      <p className="flex flex-col">
        <span className="text-sm font-semibold">{SPECIALTIES_COPY.work.together}</span>
        <span className="text-[13px] text-muted-foreground">{SPECIALTIES_COPY.work.togetherPair(trade.name, paired.name)}</span>
      </p>
      <Button className="h-11" variant="outline" onClick={() => showTrade(paired.id)}>
        {SPECIALTIES_COPY.work.show(paired.name)}
      </Button>
    </div>
  )
}
```

`src/features/meeting-flow/ui/components/steps/specialties/work-column.tsx`:

```tsx
'use client'

import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useStageTrade } from '@/features/meeting-flow/hooks/use-stage-trade'
import { OftenTogether } from '@/features/meeting-flow/ui/components/steps/specialties/often-together'
import { OnProjectTrades } from '@/features/meeting-flow/ui/components/steps/specialties/on-project-trades'
import { TradeSwitcher } from '@/features/meeting-flow/ui/components/steps/specialties/trade-switcher'
import { WorkCardGroup } from '@/features/meeting-flow/ui/components/steps/specialties/work-card-group'

/** The rep's column: the question, trades on the project, then one group headed by the switcher (spec D7). Scrolls on its own and clears the capsule. */
export function WorkColumn() {
  const trade = useStageTrade()

  return (
    <section
      aria-label={SPECIALTIES_COPY.work.regionLabel}
      className="min-h-0 overflow-y-auto overscroll-contain border-t bg-muted/30 @4xl/specialties:border-t-0 @4xl/specialties:border-l"
    >
      <div className="flex flex-col gap-6 px-6 pt-5 pb-(--stage-inset-b) @4xl/specialties:pt-6">
        <h2 className="font-sans text-lg font-semibold text-balance @4xl/specialties:text-xl">{SPECIALTIES_COPY.heading}</h2>
        <OnProjectTrades />
        {trade && (
          <div className="flex flex-col gap-3">
            <TradeSwitcher trade={trade} />
            <WorkCardGroup trade={trade} />
            <OftenTogether trade={trade} />
          </div>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 6: The step root**

Replace `src/features/meeting-flow/ui/components/steps/specialties/index.tsx` with:

```tsx
'use client'

import { memo } from 'react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { Showcase } from '@/features/meeting-flow/ui/components/steps/specialties/showcase'
import { WorkColumn } from '@/features/meeting-flow/ui/components/steps/specialties/work-column'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Button } from '@/shared/components/ui/button'

/**
 * Step 2, `split` layout: the step owns two scrollers inside `StepRegion`. A container query on the stage's
 * own width (not the viewport, so the CRM sidebar counts): two columns at 896px (`@4xl`) and wider, a pinned
 * photo band above the work column below. No props, so view re-renders never reach it.
 */
function SpecialtiesStepImpl() {
  const { catalog } = useTradeCatalogContext()

  if (catalog.isLoading) {
    return <LoadingState description={SPECIALTIES_COPY.catalogLoading.description} title={SPECIALTIES_COPY.catalogLoading.title} />
  }

  if (catalog.error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <ErrorState description={SPECIALTIES_COPY.catalogError.description} title={SPECIALTIES_COPY.catalogError.title} />
        <Button className="h-11" variant="outline" onClick={catalog.refetch}>{SPECIALTIES_COPY.retry}</Button>
      </div>
    )
  }

  return (
    <div className="@container/specialties h-full">
      <div className="grid h-full grid-rows-[42%_minmax(0,1fr)] @4xl/specialties:grid-cols-[minmax(0,1.45fr)_minmax(420px,1fr)] @4xl/specialties:grid-rows-1">
        <Showcase />
        <WorkColumn />
      </div>
    </div>
  )
}

export const SpecialtiesStep = memo(SpecialtiesStepImpl)
```

- [ ] **Step 7: Delete the old step and the sheet**

```bash
rm src/features/meeting-flow/ui/components/steps/specialties/project-strip.tsx \
   src/features/meeting-flow/ui/components/steps/specialties/step-intro.tsx \
   src/features/meeting-flow/ui/components/steps/specialties/trade-catalog.tsx \
   src/features/meeting-flow/ui/components/steps/specialties/trade-tile.tsx \
   src/features/meeting-flow/ui/components/trade-sheet/trade-sheet-host.tsx \
   src/features/meeting-flow/ui/components/trade-sheet/trade-sheet-body.tsx \
   src/features/meeting-flow/ui/components/trade-sheet/trade-sheet-header.tsx \
   src/features/meeting-flow/ui/components/trade-sheet/trade-sheet-footer.tsx \
   src/features/meeting-flow/ui/components/trade-sheet/trade-photo.tsx \
   src/features/meeting-flow/ui/components/trade-sheet/outcome-line.tsx \
   src/features/meeting-flow/ui/components/trade-sheet/pairing-card.tsx \
   src/features/meeting-flow/ui/components/trade-sheet/scope-tile-group.tsx \
   src/features/meeting-flow/ui/components/trade-sheet/scope-tile.tsx
```

(Use plain `rm` on these exact paths; never `git rm` with a directory or glob. The commit's pathspec records the deletions.)

`trade-sheet/{trade-note-field,orphan-item-chips,reason-chip-group}.tsx` stay until Task 5.

- [ ] **Step 8: Remove copy keys and helpers left without importers**

In `specialties-copy.ts` delete the keys `introWithLead`, `introNoLead`, `project`, `catalog`. Keep `heading`, `catalogLoading`, `catalogError`, `retry`, `start`, `lead` (Task 10), `sheet` (Task 5 removes it), `showcase`, `work`, `panel`, `undo`, `units`.

Then list remaining importers of each old helper:

```bash
for n in formatTradeMeta groupTradesByCategory filterTradesByQuery formatSelectionSummary countSelection SelectionCounts hasStoredEntry selectedItemIds orphanItems; do echo "== $n"; grep -rln "\b$n\b" src --include=*.ts --include=*.tsx; done
```

Delete `lib/format-trade-meta.ts`, `lib/group-trades-by-category.ts`, `lib/filter-trades-by-query.ts`, `lib/format-selection-summary.ts` when the grep lists only their own file. In `lib/trade-selection.ts` delete `countSelection`, `SelectionCounts` and `hasStoredEntry` when the grep lists only `trade-selection.ts`. Keep `selectedItemIds` and `orphanItems` (used by Task 5). Keep `derive-lead-trades.ts` and `steps/specialties/start-hint.tsx` (Task 10).

- [ ] **Step 9: Type-check and lint**

Run: `pnpm tsc && pnpm exec eslint --fix src/features/meeting-flow`
Expected: exit 0. A lint error for an unknown Tailwind class is not expected (the plugin does not validate classes); if `@4xl/specialties:` classes are reported by any rule, report it instead of changing the class names.

- [ ] **Step 10: Rendered check**

Build CSS first: `node .superpowers/sdd/2026-09-13-specialties-trade-sheet/tools/build-css.mjs $SCRATCH/checks/task4.css`.

Write `$SCRATCH/checks/task4-stage.mjs`:

```js
import { setup } from '/tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/653d8fe9-43af-47b1-9087-a9bf54a9f03e/scratchpad/t7-common.mjs'

const S = '/tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/653d8fe9-43af-47b1-9087-a9bf54a9f03e/scratchpad/checks'
const BASE = 'http://localhost:3000/dashboard/meetings/2069fa85-0357-4550-8eb5-6ae40eacf5a9'
const out = {}
for (const [w, h] of [[1440, 900], [820, 1180]]) {
  const { browser, page } = await setup({ width: w, height: h })
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  await page.goto(`${BASE}?step=2`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('section[aria-labelledby] h2', { timeout: 90000 })
  await page.addStyleTag({ path: `${S}/task4.css` })
  await page.waitForTimeout(800)
  const m = await page.evaluate(() => {
    const r = el => el && (({ x, y, width, height }) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(width), h: Math.round(height) }))(el.getBoundingClientRect())
    const show = document.querySelector('section[aria-labelledby]')
    const work = document.querySelector('section[aria-label="Choose the work"]')
    const cards = [...document.querySelectorAll('[data-scope-id]')]
    const reasonsInCanvas = ['Very old home', 'Doesn\'t trust themselves with decision'].some(t => document.querySelector('[data-step-root]')?.textContent?.includes(t))
    const weights = [...document.querySelectorAll('[data-step-root] *')].map(el => Number(getComputedStyle(el).fontWeight)).filter(v => v > 600)
    return { show: r(show), work: r(work), title: getComputedStyle(show.querySelector('h2')).fontSize, cards: cards.length, firstCard: r(cards[0]), reasonsInCanvas, heavyWeights: weights.length }
  })
  await page.screenshot({ path: `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.playwright-mcp/stage-task4-${w}.png` })
  out[w] = { ...m, errors }
  await browser.close()
}
console.log(JSON.stringify(out, null, 1))
```

Run: `node $SCRATCH/checks/task4-stage.mjs`
Expected at 1440: `show.x < work.x` (two columns, same `y`), `show.h` ≈ `work.h`, `title` `"36px"`, `cards` ≥ 1, `reasonsInCanvas: false`, `heavyWeights: 0`, `errors: []`. At 820: `show.y < work.y` (band above), `show.h` ≈ 42% of the stage height, `title` `"30px"`, `reasonsInCanvas: false`. Open both screenshots and confirm: photo or decor on stage, no empty frame, capsule not covering the title.

Then, by hand in the same kind of script or interactively: tap a card that is not selected → the card shows "On your project", the stage photo changes when that scope has a project photo, `?trade=` is unchanged; tap it again (not the only item) → unselected, no toast; open the switcher, type `roof`, press Enter → the stage shows Roof & Gutters and `?trade=` holds its id. Restore the meeting's selections exactly (compare `flowStateJSON.tradeSelections` from `getByIdWithJoins` before and after a reload).

- [ ] **Step 11: Commit**

```bash
N=$(git diff --cached --name-status | wc -l)
git add -- src/features/meeting-flow/hooks/use-stage-trade.ts src/features/meeting-flow/hooks/use-trade-edits.ts src/features/meeting-flow/ui/components/trade-thumb.tsx src/features/meeting-flow/ui/components/steps/specialties/showcase.tsx src/features/meeting-flow/ui/components/steps/specialties/showcase-media.tsx src/features/meeting-flow/ui/components/steps/specialties/showcase-fallback.tsx src/features/meeting-flow/ui/components/steps/specialties/showcase-text.tsx src/features/meeting-flow/ui/components/steps/specialties/project-proof-strip.tsx src/features/meeting-flow/ui/components/steps/specialties/work-column.tsx src/features/meeting-flow/ui/components/steps/specialties/on-project-trades.tsx src/features/meeting-flow/ui/components/steps/specialties/trade-switcher.tsx src/features/meeting-flow/ui/components/steps/specialties/work-card-group.tsx src/features/meeting-flow/ui/components/steps/specialties/work-card.tsx src/features/meeting-flow/ui/components/steps/specialties/often-together.tsx
git commit -m "feat(meeting-flow): specialties stage and rail: pinned photo showcase, work column with trade switcher and work cards, split layout; trade sheet retired" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- src/features/meeting-flow/hooks src/features/meeting-flow/ui/components/trade-thumb.tsx src/features/meeting-flow/ui/components/steps/specialties src/features/meeting-flow/ui/components/trade-sheet src/features/meeting-flow/contexts/trade-selection-provider.tsx src/features/meeting-flow/types/index.ts src/features/meeting-flow/constants/step-config.ts src/features/meeting-flow/constants/specialties-copy.ts src/features/meeting-flow/ui/views/meeting-flow.tsx src/features/meeting-flow/lib
git show --stat HEAD && echo "staged before $N, now $(git diff --cached --name-status | wc -l)"
```

---
### Task 5: The Project section in the meeting panel

**Files:**
- Modify: `src/features/meeting-flow/types/index.ts` (`PanelSection`)
- Modify: `src/features/meeting-flow/constants/shell.ts`, `src/features/meeting-flow/constants/shell-copy.ts`
- Modify: `src/features/meeting-flow/ui/components/shell/inspector-rail.tsx`, `src/features/meeting-flow/ui/components/shell/meeting-panel.tsx` (tab gap only)
- Modify: `src/features/meeting-flow/ui/views/meeting-flow.tsx` (render the section, pass the rail badge)
- Create: `src/features/meeting-flow/ui/components/project-section/{project-section,project-row,project-count-badge,work-option-list,reason-picker,trade-note-field,orphan-item-chips}.tsx`
- Delete: `src/features/meeting-flow/ui/components/trade-sheet/{trade-note-field,orphan-item-chips,reason-chip-group}.tsx`
- Modify: `src/features/meeting-flow/constants/specialties-copy.ts` (remove `sheet`)

**Interfaces:**
- Consumes (Tasks 2–4): the four context hooks, `useTradeEdits`, `TradeThumb`, `formatWorkSummary`, `formatCount`, `selectedTradeSelections`, `itemCount`, `selectedItemIds`, `orphanItems`, `diffIds`, `SPECIALTIES_COPY.panel/units`, `TRADE_PAIRINGS`, `meetingPainTypes` (`@/shared/constants/enums`).
- Produces: `PanelSection = 'meeting' | 'project' | 'context' | 'persona'`; `ProjectSection` (memo, no props); `InspectorRail` prop `projectBadge: ReactNode`.

- [ ] **Step 1: Add the section to the shell**

`src/features/meeting-flow/types/index.ts`:

```ts
export type PanelSection = 'meeting' | 'project' | 'context' | 'persona'
```

`src/features/meeting-flow/constants/shell.ts`:

```ts
export const PANEL_SECTIONS: PanelSection[] = ['meeting', 'project', 'context', 'persona']
```

`src/features/meeting-flow/constants/shell-copy.ts`, `PANEL_SECTION_LABELS`:

```ts
export const PANEL_SECTION_LABELS: Record<PanelSection, string> = {
  meeting: 'Meeting',
  project: 'Project',
  context: 'Context',
  persona: 'Persona',
}
```

`src/features/meeting-flow/ui/components/shell/inspector-rail.tsx`: add `projectBadge: ReactNode` to `InspectorRailProps` and to the destructure; import `ClipboardCheckIcon`; insert the second item and widen the gap (critique: ≥ 8px between 44px targets):

```tsx
  const items: { section: PanelSection, icon: ReactNode, badge?: ReactNode, accent?: boolean }[] = [
    { section: 'meeting', icon: <CalendarClockIcon className="size-5" /> },
    { section: 'project', icon: <ClipboardCheckIcon className="size-5" />, badge: projectBadge },
    {
      section: 'context',
      icon: <ClipboardListIcon className="size-5" />,
      badge: (
        <Badge
          className="absolute top-0 right-0 h-4 min-w-4 px-1 text-xs tabular-nums"
          variant={contextFilledCount > 0 ? 'secondary' : 'outline'}
        >
          {`${contextFilledCount}/${contextTotalCount}`}
        </Badge>
      ),
    },
    { section: 'persona', icon: <BrainIcon className="size-5" />, accent: personaHasData },
  ]
```

and in its `<aside>` class change `gap-1` to `gap-2`. In `shell/meeting-panel.tsx` change the tab row's `gap-0.5` to `gap-2`.

- [ ] **Step 2: The rail badge and the moved leaf components**

`src/features/meeting-flow/ui/components/project-section/project-count-badge.tsx`:

```tsx
'use client'

import { useTradeSelections } from '@/features/meeting-flow/contexts/trade-selections-context'
import { selectedTradeSelections } from '@/features/meeting-flow/lib/trade-selection'
import { Badge } from '@/shared/components/ui/badge'

/** Trades on the project, on the rail's Project button. Rendered by the view inside the provider. */
export function ProjectCountBadge() {
  const count = selectedTradeSelections(useTradeSelections()).length

  if (count === 0) {
    return null
  }

  return <Badge className="absolute top-0 right-0 h-4 min-w-4 px-1 text-xs tabular-nums">{count}</Badge>
}
```

`src/features/meeting-flow/ui/components/project-section/trade-note-field.tsx` (logic identical to the deleted `trade-sheet/trade-note-field.tsx`; copy keys and classes change):

```tsx
'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeActions } from '@/features/meeting-flow/contexts/trade-actions-context'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'

interface TradeNoteFieldProps {
  tradeId: string
  tradeName: string
  note: string
}

/**
 * Typing edits a local draft only; the model (and so the meeting write) sees the note on
 * blur or when the field unmounts, and only when the draft differs from the stored note.
 * The provider outlives the panel, so the unmount commit survives closing the row or the panel.
 * A note changed outside the field (a server re-seed) replaces the draft.
 */
export function TradeNoteField({ tradeId, tradeName, note }: TradeNoteFieldProps) {
  const { setNote } = useTradeActions()
  const id = `trade-note-${tradeId}`
  const [draft, setDraft] = useState(note)
  const [adoptedNote, setAdoptedNote] = useState(note)

  // Render-phase adjustment (React: "storing information from previous renders").
  if (note !== adoptedNote) {
    setAdoptedNote(note)
    setDraft(note)
  }

  const latestRef = useRef({ draft, note, tradeId, setNote })
  useLayoutEffect(() => {
    latestRef.current = { draft, note, tradeId, setNote }
  })

  useEffect(() => {
    const latest = latestRef
    return () => {
      const { draft: pending, note: stored, tradeId: pendingTradeId, setNote: commit } = latest.current
      if (pending !== stored) {
        commit(pendingTradeId, pending)
      }
    }
  }, [])

  function handleBlur() {
    if (draft !== note) {
      setNote(tradeId, draft)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase" htmlFor={id}>
        {SPECIALTIES_COPY.panel.note}
      </Label>
      <Textarea
        className="min-h-11 resize-none text-base motion-safe:transition-[min-height] motion-safe:duration-200 focus-visible:min-h-26"
        id={id}
        placeholder={SPECIALTIES_COPY.panel.notePlaceholder(tradeName)}
        rows={1}
        value={draft}
        onBlur={handleBlur}
        onChange={event => setDraft(event.target.value)}
      />
    </div>
  )
}
```

`src/features/meeting-flow/ui/components/project-section/orphan-item-chips.tsx` (now removes through `toggleWork`, so taking away a trade's last item also offers Undo):

```tsx
'use client'

import type { SelectionItem } from '@/features/meeting-flow/types'
import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import { XIcon } from 'lucide-react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeEdits } from '@/features/meeting-flow/hooks/use-trade-edits'
import { Button } from '@/shared/components/ui/button'

interface OrphanItemChipsProps {
  entry: TradeSelection
  items: SelectionItem[]
}

/** Stored items the current catalog no longer lists for this trade. Shown by stored label, removable, never dropped silently. */
export function OrphanItemChips({ entry, items }: OrphanItemChipsProps) {
  const { toggleWork } = useTradeEdits()

  if (items.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] text-muted-foreground">{SPECIALTIES_COPY.panel.orphanHint}</p>
      <ul className="flex flex-wrap gap-2">
        {items.map(item => (
          <li key={item.id}>
            <Button aria-label={SPECIALTIES_COPY.panel.removeItem(item.label)} className="h-11 font-normal" variant="outline" onClick={() => toggleWork(entry.tradeId, entry, item)}>
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

Delete `src/features/meeting-flow/ui/components/trade-sheet/trade-note-field.tsx`, `orphan-item-chips.tsx` and `reason-chip-group.tsx`, then remove the `sheet` key from `SPECIALTIES_COPY`. `grep -rn "SPECIALTIES_COPY.sheet\|trade-sheet/" src` must print nothing.

- [ ] **Step 3: The option rows and the reason picker**

`src/features/meeting-flow/ui/components/project-section/work-option-list.tsx`:

```tsx
'use client'

import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import type { ScopeOrAddon } from '@/shared/services/providers/notion/lib/scopes/schema'
import { CheckIcon } from 'lucide-react'
import { useId, useMemo } from 'react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeEdits } from '@/features/meeting-flow/hooks/use-trade-edits'
import { diffIds, selectedItemIds } from '@/features/meeting-flow/lib/trade-selection'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'

interface WorkOptionListProps {
  entry: TradeSelection
  scopes: ScopeOrAddon[]
}

/**
 * The "Mirror" option rows the owner picked (spec D8): full-width 44px rows, label left, checkbox square right,
 * pressed fill. A vertical `ToggleGroup`, so Radix owns pressed state, roving focus and `aria-pressed`. Never moves the stage.
 */
export function WorkOptionList({ entry, scopes }: WorkOptionListProps) {
  const { toggleWork } = useTradeEdits()
  const labelId = useId()
  const selectedIds = useMemo(() => selectedItemIds(entry), [entry])

  function handleValueChange(next: string[]) {
    const { added, removed } = diffIds(selectedIds, next)
    for (const id of [...added, ...removed]) {
      const scope = scopes.find(entryScope => entryScope.id === id)
      if (scope) {
        toggleWork(entry.tradeId, entry, { id: scope.id, label: scope.name })
      }
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase" id={labelId}>{SPECIALTIES_COPY.panel.work}</p>
      <ToggleGroup aria-labelledby={labelId} className="flex w-full flex-col gap-1" orientation="vertical" type="multiple" value={selectedIds} onValueChange={handleValueChange}>
        {scopes.map(scope => (
          <ToggleGroupItem
            key={scope.id}
            className="group h-auto min-h-11 w-full flex-none justify-between gap-2 rounded-md border border-border bg-card py-2 pr-2 pl-3 text-left text-[15px] font-normal whitespace-normal motion-safe:transition-colors motion-safe:duration-200 first:rounded-md last:rounded-md hover:bg-muted hover:text-foreground data-[state=on]:border-primary/45 data-[state=on]:bg-primary/8 data-[state=on]:text-foreground"
            value={scope.id}
          >
            <span>{scope.name}</span>
            <span aria-hidden className="grid size-[22px] shrink-0 place-items-center rounded-[3px] border-[1.5px] border-muted-foreground text-transparent group-data-[state=on]:border-foreground group-data-[state=on]:bg-foreground group-data-[state=on]:text-background">
              <CheckIcon className="size-3.5" />
            </span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
```

`src/features/meeting-flow/ui/components/project-section/reason-picker.tsx`:

```tsx
'use client'

import { CheckIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeActions } from '@/features/meeting-flow/contexts/trade-actions-context'
import { diffIds } from '@/features/meeting-flow/lib/trade-selection'
import { Button } from '@/shared/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'
import { meetingPainTypes } from '@/shared/constants/enums'

interface ReasonPickerProps {
  tradeId: string
  reasons: string[]
}

/** Selected reasons first; "Edit reasons" reveals all eleven. Rep-only (spec D9). */
export function ReasonPicker({ tradeId, reasons }: ReasonPickerProps) {
  const { toggleReason } = useTradeActions()
  const [editing, setEditing] = useState(false)
  const labelId = useId()
  const visible = editing ? meetingPainTypes : meetingPainTypes.filter(reason => reasons.includes(reason))

  function handleValueChange(next: string[]) {
    const { added, removed } = diffIds(reasons, next)
    for (const reason of [...added, ...removed]) {
      toggleReason(tradeId, reason)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase" id={labelId}>{SPECIALTIES_COPY.panel.reasons}</p>
        <Button aria-expanded={editing} className="h-11 px-2 font-semibold" variant="ghost" onClick={() => setEditing(value => !value)}>
          {editing ? SPECIALTIES_COPY.panel.doneEditing : SPECIALTIES_COPY.panel.editReasons}
        </Button>
      </div>
      {visible.length === 0
        ? <p className="text-[13px] text-muted-foreground">{SPECIALTIES_COPY.panel.noReason}</p>
        : (
            <ToggleGroup aria-labelledby={labelId} className="flex w-full flex-wrap gap-2" type="multiple" value={reasons} onValueChange={handleValueChange}>
              {visible.map(reason => (
                <ToggleGroupItem
                  key={reason}
                  className="group h-auto min-h-11 flex-none gap-1.5 rounded-[3px] border border-border px-3 py-2 text-sm font-normal whitespace-normal motion-safe:transition-colors motion-safe:duration-200 first:rounded-[3px] last:rounded-[3px] data-[state=on]:border-primary data-[state=on]:bg-primary/8 data-[state=on]:text-foreground"
                  value={reason}
                >
                  <CheckIcon aria-hidden className="hidden size-3.5 text-primary group-data-[state=on]:block" />
                  {reason}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
    </div>
  )
}
```

- [ ] **Step 4: The row and the section**

`src/features/meeting-flow/ui/components/project-section/project-row.tsx`:

```tsx
'use client'

import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import { ChevronDownIcon, EyeIcon } from 'lucide-react'
import { memo } from 'react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { TRADE_PAIRINGS } from '@/features/meeting-flow/constants/trade-pairings'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { useTradeStage } from '@/features/meeting-flow/contexts/trade-stage-context'
import { useTradeEdits } from '@/features/meeting-flow/hooks/use-trade-edits'
import { formatWorkSummary } from '@/features/meeting-flow/lib/format-work-summary'
import { orphanItems } from '@/features/meeting-flow/lib/trade-selection'
import { OrphanItemChips } from '@/features/meeting-flow/ui/components/project-section/orphan-item-chips'
import { ReasonPicker } from '@/features/meeting-flow/ui/components/project-section/reason-picker'
import { TradeNoteField } from '@/features/meeting-flow/ui/components/project-section/trade-note-field'
import { WorkOptionList } from '@/features/meeting-flow/ui/components/project-section/work-option-list'
import { TradeThumb } from '@/features/meeting-flow/ui/components/trade-thumb'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { AnimatedCollapsibleContent, Collapsible, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import { cn } from '@/shared/lib/utils'

interface ProjectRowProps {
  entry: TradeSelection
  expanded: boolean
  onStage: boolean
  pairedOnProject: boolean
  onExpandedChange: (tradeId: string, open: boolean) => void
  onBeforeRemove: (tradeId: string) => void
}

/**
 * One trade on the project, collapsed to a summary a rep can read at a glance (work, reasons). Expanded: the
 * option rows, orphans, reasons, note, "Show on stage" and "Remove from project" (Undo via toast). Memoized:
 * an edit to another trade leaves `entry` identical, so this row skips it.
 */
function ProjectRowImpl({ entry, expanded, onStage, pairedOnProject, onExpandedChange, onBeforeRemove }: ProjectRowProps) {
  const { catalog } = useTradeCatalogContext()
  const { showTrade } = useTradeStage()
  const { removeWithUndo } = useTradeEdits()
  const trade = catalog.tradesById.get(entry.tradeId)
  const group = catalog.scopesByTrade.get(entry.tradeId)
  const pairing = trade ? TRADE_PAIRINGS[trade.slug] : undefined
  const paired = pairing ? catalog.tradesBySlug.get(pairing.pairedSlug) : undefined
  const tradeName = trade?.name ?? entry.tradeName

  function handleRemove() {
    onBeforeRemove(entry.tradeId)
    removeWithUndo(entry)
  }

  return (
    <Collapsible className={cn('rounded-md border bg-card', onStage && 'border-primary/50')} open={expanded} onOpenChange={open => onExpandedChange(entry.tradeId, open)}>
      <CollapsibleTrigger asChild>
        <Button className="h-auto w-full justify-start gap-3 rounded-md px-3 py-2.5 text-left font-normal whitespace-normal hover:bg-muted/60" data-project-row-trigger data-trade-id={entry.tradeId} variant="ghost">
          <TradeThumb className="size-11" trade={trade} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
              {tradeName}
              {onStage && (
                <Badge className="gap-1" variant="secondary">
                  <EyeIcon aria-hidden className="size-3" />
                  {SPECIALTIES_COPY.panel.onStage}
                </Badge>
              )}
              {!trade && <Badge variant="outline">{SPECIALTIES_COPY.panel.notInCatalog}</Badge>}
            </span>
            <span className="text-[13px]">{formatWorkSummary(entry)}</span>
            <span className="truncate text-[13px] text-muted-foreground">{entry.painPoints.length > 0 ? entry.painPoints.join(' · ') : SPECIALTIES_COPY.panel.noReason}</span>
          </span>
          <ChevronDownIcon aria-hidden className={cn('size-4 shrink-0 text-muted-foreground motion-safe:transition-transform', expanded && 'rotate-180')} />
        </Button>
      </CollapsibleTrigger>
      <AnimatedCollapsibleContent className="flex flex-col gap-4 border-t px-3 pt-3 pb-1" open={expanded}>
        {group && group.scopes.length > 0 && <WorkOptionList entry={entry} scopes={group.scopes} />}
        <OrphanItemChips entry={entry} items={orphanItems(entry, group)} />
        <ReasonPicker reasons={entry.painPoints} tradeId={entry.tradeId} />
        <TradeNoteField note={entry.notes ?? ''} tradeId={entry.tradeId} tradeName={tradeName} />
        <div className="-mx-2 flex items-center justify-between">
          {onStage || !trade
            ? <span />
            : (
                <Button className="h-11 gap-1.5 px-2 font-semibold" variant="ghost" onClick={() => showTrade(entry.tradeId)}>
                  <EyeIcon aria-hidden className="size-4" />
                  {SPECIALTIES_COPY.panel.showOnStage}
                </Button>
              )}
          <Button className="h-11 px-2 font-semibold text-destructive hover:text-destructive" variant="ghost" onClick={handleRemove}>
            {SPECIALTIES_COPY.panel.remove}
          </Button>
        </div>
      </AnimatedCollapsibleContent>
      {paired && pairing && !pairedOnProject && (
        <div className="flex items-center justify-between gap-2 border-t border-dashed py-0.5 pr-1 pl-3">
          <p className="text-[13px] text-muted-foreground">{SPECIALTIES_COPY.panel.pairsWith(paired.name, pairing.reason)}</p>
          <Button className="h-11 shrink-0 px-2 font-semibold" variant="ghost" onClick={() => showTrade(paired.id)}>
            {SPECIALTIES_COPY.panel.show}
          </Button>
        </div>
      )}
    </Collapsible>
  )
}

export const ProjectRow = memo(ProjectRowImpl)
```

`src/features/meeting-flow/ui/components/project-section/project-section.tsx`:

```tsx
'use client'

import { memo, useCallback, useId, useMemo, useRef, useState } from 'react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { TRADE_PAIRINGS } from '@/features/meeting-flow/constants/trade-pairings'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { useTradeSelections } from '@/features/meeting-flow/contexts/trade-selections-context'
import { useTradeStage } from '@/features/meeting-flow/contexts/trade-stage-context'
import { formatCount } from '@/features/meeting-flow/lib/format-count'
import { itemCount, selectedTradeSelections } from '@/features/meeting-flow/lib/trade-selection'
import { ProjectRow } from '@/features/meeting-flow/ui/components/project-section/project-row'

/**
 * The panel's Project section (spec D3, D8). The row whose trade is on stage opens by itself; opening or
 * closing a row is the rep's choice until the stage trade changes. Removing a row moves focus to the next row
 * (or the heading) before it unmounts.
 */
function ProjectSectionImpl() {
  const selections = useTradeSelections()
  const { catalog } = useTradeCatalogContext()
  const { stageTradeId } = useTradeStage()
  const headingId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [choice, setChoice] = useState<{ stage: string | null, open: string | null } | null>(null)

  const onProject = selectedTradeSelections(selections)
  const scopeCount = onProject.reduce((total, entry) => total + itemCount(entry), 0)
  const idsKey = onProject.map(entry => entry.tradeId).join('|')
  const onProjectIds = useMemo(() => new Set(idsKey ? idsKey.split('|') : []), [idsKey])
  const expandedTradeId = choice && choice.stage === stageTradeId ? choice.open : stageTradeId

  const handleExpandedChange = useCallback((tradeId: string, open: boolean) => {
    setChoice({ stage: stageTradeId, open: open ? tradeId : null })
  }, [stageTradeId])

  const handleBeforeRemove = useCallback((tradeId: string) => {
    const triggers = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-project-row-trigger]') ?? [])]
    const index = triggers.findIndex(trigger => trigger.dataset.tradeId === tradeId)
    const target = triggers[index + 1] ?? triggers[index - 1] ?? headingRef.current
    target?.focus()
  }, [])

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 ref={headingRef} className="font-sans text-base font-semibold outline-none" id={headingId} tabIndex={-1}>{SPECIALTIES_COPY.panel.heading}</h3>
        <p className="text-[13px] text-muted-foreground tabular-nums">
          {`${formatCount(onProject.length, SPECIALTIES_COPY.units.trade)} · ${formatCount(scopeCount, SPECIALTIES_COPY.units.scope)}`}
        </p>
      </div>
      {onProject.length === 0
        ? <p className="text-sm text-muted-foreground">{SPECIALTIES_COPY.panel.empty}</p>
        : (
            <ul ref={listRef} className="flex flex-col gap-3">
              {onProject.map((entry) => {
                const slug = catalog.tradesById.get(entry.tradeId)?.slug
                const pairedSlug = slug ? TRADE_PAIRINGS[slug]?.pairedSlug : undefined
                const pairedId = pairedSlug ? catalog.tradesBySlug.get(pairedSlug)?.id : undefined
                return (
                  <li key={entry.tradeId}>
                    <ProjectRow
                      entry={entry}
                      expanded={expandedTradeId === entry.tradeId}
                      pairedOnProject={pairedId ? onProjectIds.has(pairedId) : false}
                      onBeforeRemove={handleBeforeRemove}
                      onExpandedChange={handleExpandedChange}
                      onStage={stageTradeId === entry.tradeId}
                    />
                  </li>
                )
              })}
            </ul>
          )}
    </section>
  )
}

export const ProjectSection = memo(ProjectSectionImpl)
```

- [ ] **Step 5: Wire the view**

In `src/features/meeting-flow/ui/views/meeting-flow.tsx`: import `ProjectSection` and `ProjectCountBadge` from `@/features/meeting-flow/ui/components/project-section/…`; inside `<MeetingPanel>` after the `meeting` block add

```tsx
              {panel === 'project' && <ProjectSection />}
```

and on `<InspectorRail>` add `projectBadge={<ProjectCountBadge />}`.

- [ ] **Step 6: Type-check and lint**

Run: `pnpm tsc && pnpm exec eslint --fix src/features/meeting-flow`
Expected: exit 0; `grep -rln "trade-sheet" src` prints nothing; the `trade-sheet/` directory is empty (remove it with `rmdir src/features/meeting-flow/ui/components/trade-sheet`).

- [ ] **Step 7: Rendered check**

Write `$SCRATCH/checks/task5-project.mjs`:

```js
import { setup } from '/tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/653d8fe9-43af-47b1-9087-a9bf54a9f03e/scratchpad/t7-common.mjs'

const S = '/tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/653d8fe9-43af-47b1-9087-a9bf54a9f03e/scratchpad/checks'
const BASE = 'http://localhost:3000/dashboard/meetings/2069fa85-0357-4550-8eb5-6ae40eacf5a9'
const { browser, page } = await setup({ width: 1440, height: 900 })
const errors = []
page.on('pageerror', e => errors.push(String(e)))
const readSelections = async () => {
  const resp = page.waitForResponse(r => r.url().includes('getByIdWithJoins'))
  await page.goto(`${BASE}?step=2`, { waitUntil: 'domcontentloaded' })
  const json = JSON.stringify(await (await resp).json())
  await page.waitForSelector('section[aria-labelledby] h2', { timeout: 90000 })
  await page.addStyleTag({ path: `${S}/task5.css` })
  return json.match(/"tradeSelections":(\[.*?\])\}/)?.[1] ?? null
}
const before = await readSelections()
await page.getByRole('button', { name: 'Project', exact: true }).click()
await page.waitForSelector('#meeting-panel [data-project-row-trigger]')
const rows = await page.locator('#meeting-panel [data-project-row-trigger]').count()
const expanded = await page.locator('#meeting-panel [data-project-row-trigger][aria-expanded="true"]').count()
const stageUrlBefore = page.url()
// tick an unselected option row in the expanded row, then untick it
const option = page.locator('#meeting-panel [role="group"] button[data-state="off"]').first()
const optionName = await option.textContent()
await option.click()
await page.waitForTimeout(300)
const tickedState = await page.locator('#meeting-panel [role="group"] button', { hasText: optionName }).first().getAttribute('data-state')
const stageUrlSame = page.url() === stageUrlBefore
await page.locator('#meeting-panel [role="group"] button', { hasText: optionName }).first().click()
await page.waitForTimeout(1500)
const reasonsInCanvas = await page.evaluate(() => ['Very old home', 'Had bad past experience', 'Home has inefficiencies'].some(t => document.querySelector('[data-step-root]')?.textContent?.includes(t)))
await page.screenshot({ path: '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.playwright-mcp/stage-task5-panel.png' })
const after = await readSelections()
console.log(JSON.stringify({ rows, expanded, tickedState, stageUrlSame, reasonsInCanvas, restored: before === after, errors }))
await browser.close()
```

Build CSS to `$SCRATCH/checks/task5.css` first (build-css.mjs), then run the script.
Expected: `rows` ≥ 1, `expanded: 1`, `tickedState: "on"`, `stageUrlSame: true`, `reasonsInCanvas: false`, `restored: true`, `errors: []`. Look at the screenshot: rows collapsed except the on-stage one, option rows with checkbox squares, the panel overlaying the work column with no reflow.

Then by hand on the dev meeting (and put it back afterwards): in the expanded row, untick the trade's only work item → the toast "{trade} is off the project" with Undo appears, focus lands on the next row or the heading; click Undo → the row returns with its reasons and note.

- [ ] **Step 8: Commit**

```bash
N=$(git diff --cached --name-status | wc -l)
git add -- src/features/meeting-flow/ui/components/project-section
git commit -m "feat(meeting-flow): Project section in the meeting panel: summary rows with option rows, reasons, note and removal with undo" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- src/features/meeting-flow/ui/components/project-section src/features/meeting-flow/ui/components/trade-sheet src/features/meeting-flow/types/index.ts src/features/meeting-flow/constants/shell.ts src/features/meeting-flow/constants/shell-copy.ts src/features/meeting-flow/constants/specialties-copy.ts src/features/meeting-flow/ui/components/shell/inspector-rail.tsx src/features/meeting-flow/ui/components/shell/meeting-panel.tsx src/features/meeting-flow/ui/views/meeting-flow.tsx
git show --stat HEAD && echo "staged before $N, now $(git diff --cached --name-status | wc -l)"
```

---

### Task 6: The meeting panel below `lg` opens through `ResponsiveSheet`

**Files:**
- Modify: `src/shared/components/dialogs/sheets/responsive-sheet.tsx`
- Create: `src/features/meeting-flow/ui/components/shell/meeting-panel-header.tsx`
- Modify: `src/features/meeting-flow/ui/components/shell/meeting-panel.tsx`

**Interfaces:**
- Consumes: `useIsBelowLg` (`@/shared/hooks/use-is-below-lg`), `PANEL_SECTIONS`, `PANEL_SECTION_LABELS`, `SHELL_COPY`.
- Produces: `ResponsiveSheet` props `sheetClassName?: string`, `drawerClassName?: string`, `hideTitle?: boolean` (the old `contentClassName` is removed; no caller remains after Task 4); `MeetingPanelHeader` props `{ openSection: PanelSection | null, headerRef: RefObject<HTMLDivElement | null>, onSelect: (section: PanelSection) => void, onClose?: () => void, className?: string }`.

- [ ] **Step 1: Split `ResponsiveSheet`'s class prop and allow a hidden title**

Confirm no caller uses `contentClassName`: `grep -rn "contentClassName" src --include=*.tsx | grep -v responsive-sheet.tsx` prints nothing. Then in `responsive-sheet.tsx` replace the `contentClassName` prop (interface doc and destructure) with:

```tsx
  /** Classes for the right-side Sheet (lg and up). */
  sheetClassName?: string
  /** Classes for the bottom Drawer (below lg), for example a height cap. */
  drawerClassName?: string
  /** The title stays for assistive tech but is visually hidden, for content that brings its own header. */
  hideTitle?: boolean
```

In the Drawer branch: `<DrawerContent className={drawerClassName} …>`, `<DrawerHeader className={cn('group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left', hideTitle && 'sr-only')}>`. In the Sheet branch: `<SheetContent className={cn('gap-0', sheetClassName)} …>`, `<SheetHeader className={cn('pr-12', hideTitle && 'sr-only')}>`. Update the component docblock's `contentClassName` sentence to name the two props.

- [ ] **Step 2: Extract the panel header**

`src/features/meeting-flow/ui/components/shell/meeting-panel-header.tsx`:

```tsx
'use client'

import type { RefObject } from 'react'
import type { PanelSection } from '@/features/meeting-flow/types'
import { XIcon } from 'lucide-react'
import { PANEL_SECTIONS } from '@/features/meeting-flow/constants/shell'
import { PANEL_SECTION_LABELS, SHELL_COPY } from '@/features/meeting-flow/constants/shell-copy'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface MeetingPanelHeaderProps {
  openSection: PanelSection | null
  /** The view focuses this header when the panel opens. */
  headerRef: RefObject<HTMLDivElement | null>
  onSelect: (section: PanelSection) => void
  /** Omitted in the drawer: it closes by drag, Escape or the scrim. */
  onClose?: () => void
  className?: string
}

/** Section tabs and the close button, shared by the lg+ overlay panel and the drawer below lg. */
export function MeetingPanelHeader({ openSection, headerRef, onSelect, onClose, className }: MeetingPanelHeaderProps) {
  return (
    <div ref={headerRef} className={cn('flex items-center gap-1 border-b border-border/40 px-2 py-2 outline-none', className)} tabIndex={-1}>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {PANEL_SECTIONS.map((section) => {
          const isCurrent = openSection === section
          return (
            <Button
              key={section}
              aria-pressed={isCurrent}
              className={cn(
                'h-11 flex-1 text-xs font-semibold motion-safe:transition-colors',
                isCurrent
                  ? 'bg-muted text-foreground hover:bg-muted hover:text-foreground'
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
      {onClose && (
        <Button className="size-11 shrink-0" size="icon" title={SHELL_COPY.closePanel} variant="ghost" onClick={onClose}>
          <XIcon className="size-5" />
          <span className="sr-only">{SHELL_COPY.closePanel}</span>
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Render the panel in `ResponsiveSheet` below lg**

Replace the body of `MeetingPanel` in `shell/meeting-panel.tsx` with (keep the props interface; update imports: add `useIsBelowLg`, `ResponsiveSheet`, `MeetingPanelHeader`; drop `XIcon`, `PANEL_SECTIONS`, `Button`):

```tsx
export function MeetingPanel({ openSection, headerRef, onSelect, onClose, children }: MeetingPanelProps) {
  const isOpen = openSection !== null
  const isBelowLg = useIsBelowLg()

  if (isBelowLg) {
    return (
      <ResponsiveSheet
        drawerClassName="h-[60dvh] max-h-[60dvh]"
        hideTitle
        open={isOpen}
        title={SHELL_COPY.panelLabel}
        onOpenChange={(open) => {
          if (!open) {
            onClose()
          }
        }}
      >
        <MeetingPanelHeader className="sticky top-0 z-10 -mx-4 bg-background px-3" headerRef={headerRef} openSection={openSection} onSelect={onSelect} />
        <div className="py-3">
          {openSection && <h2 className="sr-only">{PANEL_SECTION_LABELS[openSection]}</h2>}
          {children}
        </div>
      </ResponsiveSheet>
    )
  }

  return (
    <aside
      aria-label={SHELL_COPY.panelLabel}
      role="complementary"
      className={cn(
        'absolute inset-y-0 right-0 z-20 grid w-full max-w-full grid-rows-[auto_minmax(0,1fr)] border-l border-border/40 bg-card shadow-lg sm:w-[380px] lg:right-12',
        'motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-[cubic-bezier(.32,.72,0,1)]',
        isOpen ? 'translate-x-0' : 'translate-x-full',
      )}
      id={PANEL_ID}
      inert={!isOpen}
    >
      <MeetingPanelHeader headerRef={headerRef} openSection={openSection} onClose={onClose} onSelect={onSelect} />
      <div className="overflow-y-auto overscroll-contain px-4 py-3">
        {openSection && <h2 className="sr-only">{PANEL_SECTION_LABELS[openSection]}</h2>}
        {children}
      </div>
    </aside>
  )
}
```

Update the component docblock: "lg+: the shell-owned overlay (unchanged). Below lg: the same header and sections inside `ResponsiveSheet` (bottom drawer, 60% height) so the stage band stays visible (spec D5, §4.1)."

- [ ] **Step 4: Type-check and lint**

Run: `pnpm tsc && pnpm exec eslint --fix src/shared/components/dialogs/sheets/responsive-sheet.tsx src/features/meeting-flow/ui/components/shell`
Expected: exit 0.

- [ ] **Step 5: Rendered check at 820×1180**

Write `$SCRATCH/checks/task6-drawer.mjs`:

```js
import { setup } from '/tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/653d8fe9-43af-47b1-9087-a9bf54a9f03e/scratchpad/t7-common.mjs'

const S = '/tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/653d8fe9-43af-47b1-9087-a9bf54a9f03e/scratchpad/checks'
const { browser, page } = await setup({ width: 820, height: 1180 })
const errors = []
page.on('pageerror', e => errors.push(String(e)))
await page.goto('http://localhost:3000/dashboard/meetings/2069fa85-0357-4550-8eb5-6ae40eacf5a9?step=2', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('section[aria-labelledby] h2', { timeout: 90000 })
await page.addStyleTag({ path: `${S}/task6.css` })
const opener = page.getByRole('button', { name: 'Open meeting panel' })
await opener.click()
await page.waitForSelector('[role="dialog"]')
await page.waitForTimeout(500)
const m = await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]').getBoundingClientRect()
  const show = document.querySelector('section[aria-labelledby]').getBoundingClientRect()
  const tabs = document.querySelectorAll('[role="dialog"] [aria-pressed]').length
  return { drawerTop: Math.round(dialog.top), drawerHeight: Math.round(dialog.height), viewport: innerHeight, showBottom: Math.round(show.bottom), tabs }
})
await page.screenshot({ path: '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.playwright-mcp/stage-task6-drawer.png' })
await page.keyboard.press('Escape')
await page.waitForTimeout(600)
const closed = await page.locator('[role="dialog"]').count()
const focusOnOpener = await page.evaluate(() => document.activeElement?.getAttribute('aria-controls') === 'meeting-panel')
console.log(JSON.stringify({ ...m, closed, focusOnOpener, errors }))
await browser.close()
```

Build CSS to `$SCRATCH/checks/task6.css`, run the script.
Expected: `drawerHeight` ≤ 0.6 × `viewport` (≤ 708), `tabs` = 4, `closed` = 0, `focusOnOpener: true`, `errors: []`; the screenshot shows the stage band above the drawer. At 1440×900 the rail still opens the overlay panel (repeat Task 5 Step 7's first two assertions).

- [ ] **Step 6: Commit**

```bash
N=$(git diff --cached --name-status | wc -l)
git add -- src/features/meeting-flow/ui/components/shell/meeting-panel-header.tsx
git commit -m "feat(meeting-flow): meeting panel opens as a 60% bottom drawer below lg through ResponsiveSheet" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- src/shared/components/dialogs/sheets/responsive-sheet.tsx src/features/meeting-flow/ui/components/shell/meeting-panel-header.tsx src/features/meeting-flow/ui/components/shell/meeting-panel.tsx
git show --stat HEAD && echo "staged before $N, now $(git diff --cached --name-status | wc -l)"
```

---

### Task 7: Render budget: measure, dedupe the save refetch, and hold the line

**Files:**
- Create (git-ignored): `$WS/tools/measure-stage.mjs`
- Modify: `src/features/meeting-flow/ui/views/meeting-flow.tsx` (meeting writer `onSuccess`)

**Interfaces:**
- Consumes: `$WS/tools/instrument.js` (Task 1), the stage and panel DOM from Tasks 4–5 (`[data-scope-id]`, `section[aria-labelledby]`, `#meeting-panel`, rail button named "Project").
- Produces: `$WS/tools/stage-budget-1440.json` with per-scenario counts and a `pass` flag per budget line (spec §4.4).

- [ ] **Step 1: Write the measurement script**

`$WS/tools/measure-stage.mjs`:

```js
import fs from 'node:fs'
import path from 'node:path'
import { setup } from '/tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/653d8fe9-43af-47b1-9087-a9bf54a9f03e/scratchpad/t7-common.mjs'

const DIR = path.dirname(new URL(import.meta.url).pathname)
const MEETING = 'http://localhost:3000/dashboard/meetings/2069fa85-0357-4550-8eb5-6ae40eacf5a9'
const BUDGET = { scopeToggle: 90, reasonToggle: 60, getsPerSave: 1 }
const { browser, context, page } = await setup({ width: 1440, height: 900 })
await context.addInitScript({ path: path.join(DIR, 'instrument.js') })
const errors = []
page.on('pageerror', e => errors.push(String(e)))

const sum = o => Object.values(o).reduce((s, v) => s + v, 0)
const snapshot = () => page.evaluate(() => {
  const rr = window.__rr
  const img = document.querySelector('section[aria-labelledby] img:not([aria-hidden])')
  return {
    commits: rr.commits,
    renders: { ...rr.renders },
    mounts: { ...rr.mounts },
    gets: rr.fetches.filter(f => f.url.includes('getByIdWithJoins')).length,
    updates: rr.fetches.filter(f => f.url.includes('crud.update')).length,
    stageImgKept: img ? img.getAttribute('data-rr-img') === 'kept' : null,
    animations: rr.anim.filter(a => a.type === 'animationstart').map(a => `${a.name}@${a.target}`),
  }
})
async function scenario(act, { expectWrite }) {
  await page.evaluate(() => {
    window.__rrReset()
    document.querySelector('section[aria-labelledby] img:not([aria-hidden])')?.setAttribute('data-rr-img', 'kept')
  })
  await act()
  await page.waitForTimeout(300)
  const immediate = await snapshot()
  if (expectWrite) {
    await page.waitForFunction(() => window.__rr.fetches.some(f => f.url.includes('crud.update') && f.t1 != null), null, { timeout: 15000 })
  }
  await page.waitForTimeout(3000)
  const later = await snapshot()
  return { immediate: { ...immediate, total: sum(immediate.renders), mounted: sum(immediate.mounts) }, later: { ...later, total: sum(later.renders), mounted: sum(later.mounts) } }
}

const resp = page.waitForResponse(r => r.url().includes('getByIdWithJoins'))
await page.goto(`${MEETING}?step=2`, { waitUntil: 'domcontentloaded' })
const initial = JSON.stringify(await (await resp).json()).match(/"tradeSelections":(\[.*?\])\}/)?.[1] ?? null
await page.waitForSelector('[data-scope-id]', { timeout: 90000 })
await page.waitForTimeout(1500)

const out = { budget: BUDGET, scenarios: {} }
const off = page.locator('[data-scope-id][data-state="off"]').first()
const offId = await off.getAttribute('data-scope-id')
const card = page.locator(`[data-scope-id="${offId}"]`)
out.scenarios.scopeOn = await scenario(() => card.click(), { expectWrite: true })
out.scenarios.scopeOff = await scenario(() => card.click(), { expectWrite: true })

await page.getByRole('button', { name: 'Project', exact: true }).click()
await page.waitForSelector('#meeting-panel [data-project-row-trigger][aria-expanded="true"]')
const edit = page.locator('#meeting-panel').getByRole('button', { name: 'Edit reasons' }).first()
await edit.click()
const chip = page.locator('#meeting-panel [role="group"] button[data-state="off"]', { hasText: 'Fearful of construction' }).first()
out.scenarios.reasonOn = await scenario(() => chip.click(), { expectWrite: true })
out.scenarios.reasonOff = await scenario(() => page.locator('#meeting-panel [role="group"] button', { hasText: 'Fearful of construction' }).first().click(), { expectWrite: true })

const pass = s => ({
  scopeOn: s.scopeOn.immediate.total <= BUDGET.scopeToggle && s.scopeOn.immediate.mounted === 0,
  scopeOff: s.scopeOff.immediate.total <= BUDGET.scopeToggle && s.scopeOff.immediate.mounted === 0,
  reasonOn: s.reasonOn.immediate.total <= BUDGET.reasonToggle,
  reasonOff: s.reasonOff.immediate.total <= BUDGET.reasonToggle,
  getsPerSave: [s.scopeOn, s.scopeOff, s.reasonOn, s.reasonOff].every(x => x.later.gets <= BUDGET.getsPerSave),
  noAnimationReplay: [s.scopeOff, s.reasonOn, s.reasonOff].every(x => x.later.animations.length === 0),
})
out.pass = pass(out.scenarios)

const check = page.waitForResponse(r => r.url().includes('getByIdWithJoins'))
await page.goto(`${MEETING}?step=2`, { waitUntil: 'domcontentloaded' })
out.restored = (JSON.stringify(await (await check).json()).match(/"tradeSelections":(\[.*?\])\}/)?.[1] ?? null) === initial
out.errors = errors
fs.writeFileSync(path.join(DIR, 'stage-budget-1440.json'), JSON.stringify(out, null, 2))
console.log(JSON.stringify({ pass: out.pass, restored: out.restored, totals: Object.fromEntries(Object.entries(out.scenarios).map(([k, v]) => [k, [v.immediate.total, v.later.total, v.later.gets]])), errors }))
await browser.close()
```

Notes for the implementer: the scope-on toggle may legitimately change the stage photo (it is a new media key), so `stageImgKept` is only asserted for `scopeOff` and the reason scenarios (read it from the JSON). If `Fearful of construction` is already selected on the stage trade, pick any unselected reason label and use it in both reason scenarios.

- [ ] **Step 2: Run it and record the numbers**

Run: `node .superpowers/sdd/2026-09-14-specialties-stage-and-rail/tools/measure-stage.mjs`
Expected now: `restored: true`, `errors: []`. Record the totals. `getsPerSave` is expected to FAIL (2 GETs per save: the realtime echo plus the `onSuccess` invalidation).

- [ ] **Step 3: Skip the save's own invalidation while realtime is connected**

In `meeting-flow.tsx`, next to `invalidateRef`, keep the sync status in a ref and make the meeting writer's `onSuccess` conditional:

```tsx
  const syncStatusRef = useRef(syncStatus)
  useLayoutEffect(() => {
    syncStatusRef.current = syncStatus
  })
```

```tsx
  const [meetingWriter] = useState(() => new QueryMutationObserver(queryClient, trpc.meetingsRouter.crud.update.mutationOptions({
    // The server publishes `meeting:<id>` before it responds and `useMeetingSync` invalidates on it, so a second
    // invalidation here only duplicates the refetch. Without a live connection there is no echo: invalidate.
    onSuccess: () => {
      if (syncStatusRef.current !== 'connected') {
        invalidateRef.current()
      }
    },
    onError: () => toast.error('Failed to save'),
  })))
```

(`customerProfileWriter` keeps its unconditional invalidation.)

- [ ] **Step 4: Fix whatever is over budget, at the narrowest level**

Re-run the script. For each failing line, read `renders` in `stage-budget-1440.json` (top counts by component name) and apply the matching fix, then re-run:

| Over budget | Likely cause | Fix |
|---|---|---|
| `WorkCard` or `WorkCardImpl` appears per toggle | `media` prop identity changes | the `mediaByScope` map must depend only on `[scopes, projects]`; check `scopes` comes from the catalog map, not a fresh `?? []` |
| `Showcase`, `ShowcaseMedia`, `ProjectProofStrip` per toggle | stage context value changes on toggles | `stageValue` deps must be the resolved id string, the key, and the two stable callbacks |
| `TradeSwitcher` subtree large | the closed popover still renders `Command` | render `PopoverContent` children only when `open` (`{open && <Command>…</Command>}`) |
| `ProjectRow` for untouched trades | `onExpandedChange` or `pairedOnProject` changes | both must be stable across toggles (see `ProjectSection`) |
| `ToggleGroupItem` counts equal to all reasons on a scope toggle | the reasons group reads selections | `ReasonPicker` must receive `reasons` from its row; it must not call `useTradeSelections` |

Do not raise the budget. If a line still fails after these fixes, stop and report DONE_WITH_CONCERNS with the JSON path and the top ten component counts.

- [ ] **Step 5: Type-check, lint, final run**

Run: `pnpm tsc && pnpm exec eslint --fix src/features/meeting-flow && node .superpowers/sdd/2026-09-14-specialties-stage-and-rail/tools/measure-stage.mjs`
Expected: every `pass` value `true`, `restored: true`.

- [ ] **Step 6: Commit**

```bash
N=$(git diff --cached --name-status | wc -l)
git commit -m "perf(meeting-flow): one refetch per save while realtime is connected; stage and panel within the render budget" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- src/features/meeting-flow/ui/views/meeting-flow.tsx <every other file Step 4 changed, listed one by one>
git show --stat HEAD && echo "staged before $N, now $(git diff --cached --name-status | wc -l)"
```

Never pass a directory here: `src/features/meeting-flow/ui/components/presentation/scrim.tsx` holds another session's uncommitted edit.

---

### Task 8: Verification pass (spec §7) and fixes

**Files:**
- Create (git-ignored): `$WS/tools/verify-stage.mjs`
- Modify: only files created or modified by Tasks 1–7, when a check fails

**Interfaces:**
- Consumes: everything above.
- Produces: `$WS/tools/verify-stage.json` and screenshots `.playwright-mcp/stage-verify-<w>-<scheme>.png`.

- [ ] **Step 1: Write the verification script**

`$WS/tools/verify-stage.mjs`:

```js
import fs from 'node:fs'
import path from 'node:path'
import { setup } from '/tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/653d8fe9-43af-47b1-9087-a9bf54a9f03e/scratchpad/t7-common.mjs'

const DIR = path.dirname(new URL(import.meta.url).pathname)
const CSS = path.join(DIR, 'verify.css')
const SHOTS = '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.playwright-mcp'
const URL_STEP = 'http://localhost:3000/dashboard/meetings/2069fa85-0357-4550-8eb5-6ae40eacf5a9?step=2'
const VIEWPORTS = [[1440, 900], [1280, 800], [1024, 768], [820, 1180], [390, 844]]
const PAIN = ['Has urgent fixes', 'Home has physical damages', 'High maintenance / utility costs', 'Home has inefficiencies', 'Very old home', 'Had bad past experience', 'Fearful of construction', 'Doesn\'t trust themselves with decision', 'Has financial / budget constraints', 'Social (competition / status / family)', 'Home is not place of rest / comfort']
const results = []

for (const scheme of ['light', 'dark']) {
  for (const [width, height] of VIEWPORTS) {
    const { browser, page } = await setup({ scheme, width, height })
    const errors = []
    page.on('pageerror', e => errors.push(String(e)))
    await page.goto(URL_STEP, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('section[aria-labelledby] h2', { timeout: 90000 })
    await page.addStyleTag({ path: CSS })
    await page.waitForTimeout(900)
    const m = await page.evaluate((pain) => {
      const rect = el => el && (({ x, y, width: w, height: h }) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }))(el.getBoundingClientRect())
      const root = document.querySelector('[data-step-root]')
      const show = document.querySelector('section[aria-labelledby]')
      const work = document.querySelector('section[aria-label="Choose the work"]')
      const capsule = [...document.querySelectorAll('button[aria-label]')].find(b => /previous step/i.test(b.getAttribute('aria-label')))?.parentElement
      const title = show?.querySelector('h2')
      const outcome = title?.nextElementSibling
      const small = [...root.querySelectorAll('button, [role="button"], a')].filter(el => el.offsetParent && el.getBoundingClientRect().height < 44).map(el => el.textContent.trim().slice(0, 30))
      const heavy = [...root.querySelectorAll('*')].filter(el => Number(getComputedStyle(el).fontWeight) > 600).length
      const text = root.textContent
      return {
        twoColumns: show && work ? Math.abs(rect(show).y - rect(work).y) < 2 && rect(show).x < rect(work).x : false,
        show: rect(show), work: rect(work), capsule: rect(capsule),
        titlePx: title ? getComputedStyle(title).fontSize : null,
        outcomePx: outcome ? getComputedStyle(outcome).fontSize : null,
        painInCanvas: pain.filter(p => text.includes(p)),
        smallTargets: small,
        heavyWeights: heavy,
        bodyScrollX: document.documentElement.scrollWidth > innerWidth,
      }
    }, PAIN)
    // no reflow when the panel opens (lg+ only)
    if (width >= 1024) {
      const before = await page.evaluate(() => [document.querySelector('section[aria-labelledby]').getBoundingClientRect().width, document.querySelector('section[aria-label="Choose the work"]').getBoundingClientRect().width].map(Math.round))
      await page.getByRole('button', { name: 'Project', exact: true }).click()
      await page.waitForTimeout(500)
      const after = await page.evaluate(() => [document.querySelector('section[aria-labelledby]').getBoundingClientRect().width, document.querySelector('section[aria-label="Choose the work"]').getBoundingClientRect().width].map(Math.round))
      m.noReflow = before[0] === after[0] && before[1] === after[1]
    }
    await page.screenshot({ path: `${SHOTS}/stage-verify-${width}-${scheme}.png` })
    results.push({ scheme, width, height, ...m, errors })
    await browser.close()
  }
}
fs.writeFileSync(path.join(DIR, 'verify-stage.json'), JSON.stringify(results, null, 2))
console.log(JSON.stringify(results.map(r => ({ s: r.scheme, w: r.width, two: r.twoColumns, title: r.titlePx, outcome: r.outcomePx, pain: r.painInCanvas.length, small: r.smallTargets.length, heavy: r.heavyWeights, scrollX: r.bodyScrollX, noReflow: r.noReflow, errors: r.errors.length }))))
```

- [ ] **Step 2: Run it**

Build CSS to `$WS/tools/verify.css` with build-css.mjs, then run `node .superpowers/sdd/2026-09-14-specialties-stage-and-rail/tools/verify-stage.mjs`.

Expected for every row: `pain: 0`, `heavy: 0`, `scrollX: false`, `errors: 0`, `small: 0` (report any label listed in `smallTargets`). `two: true` and `title: "36px"` / `outcome: "20px"` at 1440 and 1280 (the dev meeting's sidebar state decides 1280: if the sidebar is open the stage is ~976px, still two columns); `two: false`, `title: "30px"` at 820 and 390. `noReflow: true` at 1440, 1280 and 1024. Open all ten screenshots: in both schemes the capsule never covers the title, the outcome or the last card at rest (scroll the work column to the end once per width by hand), photos or decor fill the stage, no empty frame.

- [ ] **Step 3: Behavior and accessibility, by hand on the dev meeting**

At 1440 and 820, check and note the result of each (restore the meeting afterwards):
1. Tap an unselected card → "On your project" appears, the stage photo changes if that scope has a project, nothing else moves.
2. Switcher: Tab to it, Enter opens, type part of a trade name, ArrowDown, Enter → stage shows that trade, focus returns to the switcher button; Escape inside the open popover closes only the popover.
3. `?trade=<id>` pasted into the URL opens that trade on stage; `?trade=nonsense` shows the default trade.
4. Panel Project row: option rows tick and untick without moving the stage; untick the only item → toast with Undo, focus on the next row or heading; Undo restores reasons and note.
5. Present mode (P) closes the panel; the showcase is unchanged.
6. Keyboard focus is visible on cards, option rows, reason chips and the switcher in both schemes.

Fix any failure in the owning file (narrowest level), re-run Steps 1–2, and repeat once at most.

- [ ] **Step 4: Type-check and lint**

Run: `pnpm tsc && pnpm exec eslint src/features/meeting-flow src/shared/components/dialogs/sheets/responsive-sheet.tsx src/shared/components/ui/toggle-group.tsx`
Expected: exit 0.

- [ ] **Step 5: Commit (only if Steps 2–3 required fixes)**

```bash
N=$(git diff --cached --name-status | wc -l)
git commit -m "fix(meeting-flow): stage and rail verification fixes" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- <the exact files you changed>
git show --stat HEAD && echo "staged before $N, now $(git diff --cached --name-status | wc -l)"
```

---

## USER GATE: tasks below start only after the user runs the named data-access change (spec §5)

### Task 9 (USER GATE, DA1): Showcase projects from the projects read model

**Before starting:** the user confirms Who We Are round 2 R3 (`scopeIds` filter), R10 (one public project read procedure) and S1 (public projection) are on `main`. Read that procedure's input and output types in `src/trpc/routers/projects.router/` and the projection type in `src/shared/modules/projects/` (read only).

**Files:**
- Modify: `src/features/meeting-flow/hooks/use-showcase-projects.ts`
- Modify: `src/features/meeting-flow/lib/index-showcase-projects.ts` (input type only)
- Test: `$SCRATCH/checks/stage-lib.ts` (update the `project(...)` factory to the new row shape)

- [ ] **Step 1:** Update the assertion script's `project()` factory to build rows of the new public projection type (same fields the index reads: id, city, state, duration, hero image, scope ids) and run it; expect a type error or failed assertion.
- [ ] **Step 2:** Change `indexShowcaseProjects`'s first parameter type to the new row type and map its field names in the `item` object literal; run the script; expect `stage-lib: all assertions passed`.
- [ ] **Step 3:** In the hook, replace `trpc.projectsRouter.showroomDisplay.getAll.queryOptions()` with the new procedure's `queryOptions(...)` (visibility public, no scope filter: the index needs all public projects); delete the `// LAZY:` header.
- [ ] **Step 4:** `pnpm tsc && pnpm exec eslint --fix src/features/meeting-flow/hooks/use-showcase-projects.ts src/features/meeting-flow/lib/index-showcase-projects.ts`; re-run Task 8 Step 1–2 at 1440 light; expect the same stage photos as before for Windows & doors and Roof & Gutters.
- [ ] **Step 5:** Commit `refactor(meeting-flow): showcase projects read from the projects read model` with the two paths.

### Task 10 (USER GATE, DA4 requestedTrades): "Requested" trades in the switcher and as the default stage

**Before starting:** the user confirms the lead's requested trades reach the meeting-flow customer (round-1 spec §9 item 2) and names the field. Round-1 plan Task 9 holds the edge mapper `lib/get-requested-trades.ts`; build it first exactly as written there if it does not exist.

**Files:**
- Modify: `src/features/meeting-flow/lib/group-trades-for-switcher.ts`, `src/features/meeting-flow/lib/resolve-stage-trade.ts`, `src/features/meeting-flow/contexts/trade-selection-provider.tsx`, `src/features/meeting-flow/constants/specialties-copy.ts`
- Test: `$SCRATCH/checks/stage-lib.ts`

- [ ] **Step 1:** Add assertions: `groupTradesForSwitcher(trades, selections, requestedIds)` returns a first group `{ key: 'requested', label: 'You called about' }` with requested trades not yet on the project; `resolveStageTradeId(null, [], catalog, requestedIds)` returns the first requested catalog trade when nothing is on the project. Run; expect failure.
- [ ] **Step 2:** Add the optional `requestedIds: ReadonlySet<string> = new Set()` parameter to both functions: `groupTradesForSwitcher` prepends `{ key: 'requested', label: SPECIALTIES_COPY.lead.eyebrow, trades: trades.filter(t => requestedIds.has(t.id) && !isTradeSelected(selections, t.id)) }` and excludes those trades from the category groups; `resolveStageTradeId` checks requested trades after on-project trades and before the first catalog trade. Run; expect pass.
- [ ] **Step 3:** In the provider, derive `requestedIds` from `flowContext.customer` through `getRequestedTrades` (memoized on the customer) and pass it to `resolveStageTradeId`; expose it on the catalog context value as `requestedIds` (add the field to `TradeCatalogContextValue`) and pass it from `TradeSwitcher` to `groupTradesForSwitcher`.
- [ ] **Step 4:** `pnpm tsc`, eslint, Task 8 Step 1–2 at 1440; expect the switcher's first group on a meeting whose lead requested trades.
- [ ] **Step 5:** Commit `feat(meeting-flow): requested trades lead the switcher and the default stage`.

### Task 11 (USER GATE, DA4 add-ons): Add-on cards in the work column

**Before starting:** the user confirms add-ons belong in proposal SOW defaults (round-1 spec §9 item 3).

**Files:**
- Modify: `src/features/meeting-flow/ui/components/steps/specialties/work-card-group.tsx`, `src/features/meeting-flow/ui/components/project-section/project-row.tsx`, `src/features/meeting-flow/constants/specialties-copy.ts`

- [ ] **Step 1:** Add `SPECIALTIES_COPY.work.addons: 'Add-ons'`.
- [ ] **Step 2:** In `WorkCardGroup`, after the scopes `ToggleGroup`, render a second block when `catalog.scopesByTrade.get(trade.id)?.addons.length` > 0: a `p` label `text-[13px] text-muted-foreground` with `SPECIALTIES_COPY.work.addons` and a second `ToggleGroup type="multiple"` with the same classes and `WorkCard` children for `addons`, using the same `selectedIds`, `diffIds`, `toggleWork` and `mediaByScope` logic (extend the map to add-ons).
- [ ] **Step 3:** In `ProjectRow`, render a second `WorkOptionList` for `group.addons` under a `panel.work`-style label reading `SPECIALTIES_COPY.work.addons` (add an optional `label?: string` prop to `WorkOptionList`, defaulting to `SPECIALTIES_COPY.panel.work`).
- [ ] **Step 4:** `pnpm tsc`, eslint, re-run Task 7's measurement (budget unchanged) and Task 8 Step 1–2 at 1440.
- [ ] **Step 5:** Commit `feat(meeting-flow): add-on cards and option rows`.

---

## Self-review against the spec

| Spec section | Task |
|---|---|
| §2 D1, D2, D10 (two columns, no strip, showcase left) | 4 |
| §2 D3, D8 (Project section, summary rows, Mirror option rows) | 5 |
| §2 D4 (overlay, no reflow) | 5 (unchanged overlay), 8 (`noReflow`) |
| §2 D5 (drawer below lg) | 6 |
| §2 D6 (type) | Global Constraints, 4, 8 (`heavyWeights`, title/outcome px) |
| §2 D7 (on-project above switcher) | 4 (`WorkColumn`) |
| §2 D9 (privacy) | Global Constraints, 4 (no reasons on canvas), 5, 8 (`painInCanvas`) |
| §2 D11 (owned photos, fallback) | 2 (media selectors), 4 (`ShowcaseFallback`) |
| §2 D12, §4.4 (render budget) | 1, 3, 4, 7 |
| §2 D14 (panel edits never move the stage; undo) | 4 (`useTradeEdits`), 5 (`WorkOptionList`, no `showTrade`) |
| §3 content and copy | 2 (keys), 4, 5 |
| §4.1 layout (`split`, container query, capsule clearance, panel) | 4, 6 |
| §4.2 model (context split, stage replaces sheet, last untick removes, no stage move) | 2, 3, 4 |
| §4.3 components, retirements | 4, 5, 6 |
| §4.5 data and types | 2 |
| §4.6 responsive | 4, 6, 8 |
| §4.7 motion | 4 (crossfade), 5 (collapsible), Global Constraints |
| §4.8 accessibility | 4 (switcher, regions), 5 (focus on removal), 6 (drawer focus), 8 |
| §5 data access (reads as-is, LAZY, gates) | 2, 9, 10, 11 |
| §6 edge cases | 2 (`resolveStageTradeId`, zero scopes), 4 (fallback, no-work text), 5 (orphans, not in catalog) |
| §7 verification | 7, 8 |
| §8 files | File Structure table (with listed deviations) |

Placeholder scan: Tasks 9–11 depend on APIs that do not exist yet; each names what to read first and the exact change, and each is behind its gate. Type names checked across tasks: `TradeActions.removeTrade/restoreTrade`, `TradeStageState.showTrade(tradeId: string | null)`, `useTradeEdits().toggleWork(tradeId, entry, item)`, `ShowcaseMedia.key`, `SwitcherGroup`, `PanelSection 'project'`, `ResponsiveSheet` `drawerClassName`/`hideTitle`, `QueryMutationObserver`.
