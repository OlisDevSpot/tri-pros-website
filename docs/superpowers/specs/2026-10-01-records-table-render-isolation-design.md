# Records table render isolation

Status: approved for planning · 2026-10-01

## Why

The Meetings records page feels sluggish. A browser probe on the dev server (React profiling hook, long-task observer, network log; 20 rows) measured:

| Interaction | Today |
|---|---|
| Open a row's customer modal | whole table re-renders: ~730 ms render, 587 ms frozen frame |
| Close the modal | whole table re-renders: ~340 ms render, 379 ms frozen frame |
| Expand / collapse a row | whole table re-renders: 250–270 ms commit |
| Initial load | each status cell renders ~28×; 51 commits; 615 ms worst commit |
| Search keystroke / page change | 220–330 ms commits re-rendering the table; 20 `getParticipants` requests |
| Warm sidebar navigation | rows visible after 0.85–1.25 s; fully shown 1.1–1.6 s (250 ms of it is a deliberate animation delay) |
| Hover, scroll, idle | clean: 0 commits |

Dev React is roughly 3–5× slower than production; ratios hold.

The causes live in shared primitives, not the meetings table. Every records page (customers, meetings, proposals, projects) and the campaign-leads and lead-source customer sections render through `DataTable` with a callback `meta`; 18 callers subscribe to the whole modal store; seven records routes share `RecordsPageMotionShell`. So the fixes go into the primitives, and a table built the usual way is fast without its author knowing these rules.

## Goals

- A state change re-renders only the rows it affects, on every `DataTable`.
- Opening or closing a modal re-renders nothing on the page that opened it.
- Table cells make no per-row network requests until the user opens them.
- Records pages appear without an artificial delay, still with a quick fade.
- A repeatable probe proves the above on every records page.

## Non-goals (deferred, re-measure after this ships)

- Narrowing `useInvalidation`'s router-level `pathFilter()` (a deliberate self-healing rule; most of its cost disappears once cells stop owning per-row queries).
- Trimming `meetingsRouter.reads.list`'s selected columns (`flowStateJSON`, `contextJSON`, notes shipped per row).
- `next/dynamic` for the customer profile, participants and assign-project modals.
- The list SQL (correlated proposal subqueries; no index on `meetings.customer_id` / `scheduled_for`).
- Any Router-level re-render left on URL state changes after A lands.

## Design

### A. `DataTable` isolates rows from unrelated renders

Today `DataTableBody` is memoized only during a column drag, rows are not memoized, and each consumer's `meta` (built with `useMemo` over `useMutation` objects and plain closures) changes identity on nearly every render. Any render of the page re-renders every cell.

1. **Stable `meta`.** A shared hook, `useStableCallbacks(value)` (`src/shared/hooks/use-stable-callbacks.ts`), splits an object, or an array of objects, into function entries and value entries.
   - Functions are read through a ref updated after commit, and exposed as stable wrappers. Callbacks run in event handlers, so they always see the latest closure.
   - Values (e.g. `canAssignMeeting`, campaign leads' `selectedIds` and `pageRowIds`) are compared by identity against the previous render.
   - The returned object keeps its identity until a value entry changes. `DataTable` runs `meta` through it, so cells read a `table.options.meta` whose identity is the re-render signal. Consumers keep passing a plain object; their `useMemo`s can be dropped.
   - Rule, written on the `meta` prop: a function entry is an event callback. Anything a cell reads while rendering is a value.
2. **Memoized rows.** The per-row JSX in `DataTableBody` moves into a memoized `DataTableRow`. It re-renders only when one of these changes: its row's data (`row.original` identity), `isExpanded`, `meta` identity, the `columns` identity or visible column ids, `isFrozen`, or its row class name.
   - The row's data is compared rather than the TanStack `Row` instance, because any refetch that changes one row rebuilds every `Row`. Query structural sharing keeps unchanged rows' data identical.
   - Column widths are excluded: body cells take widths from the header row under `table-layout: fixed`.
   - An expanded row's panel is rendered fresh each time the body renders, so only expanded rows re-render on unrelated renders.
3. **Remove row inputs that change for every row at once.**
   - `showFrozenShadow` (flips on horizontal scroll) moves to a data attribute on the table container, with the frozen cell's shadow driven by CSS.
   - `activeRowId` is dropped from `meta`; nothing reads it.
4. The existing column-drag body memo stays.
5. **Row action configs are values.** Found while planning: all four column registries read `meta.<entity>Actions(row)` during render, and each entity's `use<Entity>ActionConfigs` rebuilds its array on every render, because `useMutation` objects, `useConfirm`'s `confirm` and inline `overrides` are new each time. A stable wrapper would show stale `isLoading`, and an unwrapped one re-renders every row.
   - `customerActions`, `meetingActions`, `proposalActions` and `projectActions` become values (`EntityActionConfig<Row>[]`), not getters.
   - Each `use<Entity>ActionConfigs` returns its array through `useStableCallbacks`. The array keeps its identity until a value in it changes (an `isLoading` flips, an action is added), and those are exactly the times rows should re-render.

Result: modal open/close and fetch-state flips re-render zero rows; expand re-renders one row; a selection change in campaign leads re-renders rows (value changed), which is correct.

### B. `useOpenModal()`: opening a modal doesn't re-render the opener

`useModalStore()` is called without a selector in 18 places, so every caller re-renders on every `isOpen` / `modal` change.

- New plain function `openModal(modal)` in `src/shared/lib/open-modal.ts` sets and opens the modal through `useModalStore.getState()`. It's not a hook (simpler than the `useOpenModal()` first proposed): an opener subscribes to nothing and has nothing to put in deps.
- Every opener migrates to `openModal(modal)`. Readers (`global-dialogs`, modals that read `isOpen` / `close`) switch to per-field selectors; `sow-field`'s in-callback `close` reads `useModalStore.getState().close()`.
- Same change, no shim: `useModalStore()` with no selector stops appearing in `src/`.

### C. Cells read row data; per-entity queries wait for the user to open them

`ParticipantPicker` passes the row's owner as `placeholderData`, which doesn't write to the cache, so all 20 rows fetch `getParticipants` on every load, page change, search and focus refetch. The comment claiming it removes the N+1 is wrong.

- The picker's query gets `enabled: popoverOpen || !snapshot`, where the snapshot is built from `initialOwner` / `initialCoOwner`, which the list already returns. A picker without a snapshot keeps fetching as today.
- While closed, a picker with a snapshot renders its trigger from the snapshot, not from the cache. A disabled query isn't refetched on invalidation, so cached data would show a stale owner after a reassign; the refetched list row carries the fresh owner.
- The misleading comments in `participant-picker.tsx` and `types.ts` are corrected.
- This is the only per-row query in the four column registries today. The rule lives in the code at that spot, not in a doc.

### D. Shared component fixes

- **`DateTimePicker`** syncs its draft on `value?.getTime()` instead of `value`, so a fresh `Date` with the same instant doesn't trigger a second render per row.
- **`RecordsPageMotionShell`** (owner ruling 2026-10-01: keep the animation, no delay, quicker fade):
  - no delay, no `y` slide
  - opacity 0 → 1 over 150 ms
  - exit is opacity only
  - the hydration skip stays

### E. Records perf probe

`scripts/perf/records-probe.mjs`, run directly as `node scripts/perf/records-probe.mjs <path>` against the running dev server. No `package.json` entry (owner ruling 2026-10-01).

- Signs in through `/api/dev/playwright-session` and loads the page.
- Runs a fixed set of scenarios:
  - initial load, idle, hover sweep, scroll
  - row click → modal open, then modal close
  - expand and collapse a row
  - search keystroke, next page
- Per scenario it prints:
  - React commits and render time
  - **row render count**, from a `DataTableRow` displayName tally
- Reads `DEV_LOGIN_SECRET` from `.env.local`; the secret is never written into the script.
  - long tasks
  - tRPC procedures called
- Scenarios that don't apply to a page (no expand, no modal) are skipped.

## Acceptance

Run the probe on `/dashboard/meetings`, `/dashboard/customers`, `/dashboard/proposals` and `/dashboard/projects` before and after; numbers go in the PR.

- Modal open and close: 0 `DataTableRow` renders.
- Expand or collapse: exactly 1 `DataTableRow` render.
- Initial load: each row renders at most 2 times.
- `getParticipants`: 0 requests on load, page change or search; 1 when a picker opens.
- Hover, scroll, idle: still 0 commits.
- Warm navigation: fully shown at least 0.25 s sooner than baseline, with a visible fade.
- Behaviour unchanged when checked by hand on each page:
  - inline outcome, status and date edits
  - row actions menu
  - campaign-leads select-all and selection
  - column resize and freeze
  - row expand panel
  - mobile row tap
- `pnpm tsc` and `pnpm lint` clean.
