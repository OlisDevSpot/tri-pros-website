# Expandable table rows: research

Date: 2026-09-24. Scope: `src/shared/components/data-table/ui/data-table.tsx` (HEAD `b6396b0f`).
Installed: `@tanstack/react-table` 8.21.3 (`@tanstack/table-core` 8.21.3), `@radix-ui/react-popover` 1.1.15, `@radix-ui/react-dropdown-menu` 2.1.16, `motion` 12.31.0, `react` 19.2.4.

## Question

We want a row click to open a full-width region directly under the row: an extra `<tr>` holding one `<td colSpan={all}>`. It has to work with:

1. Interactive cells that must not toggle the row: `StatusDropdownCell`, `ParticipantPicker`, `DateTimePicker`, `EntityActionMenu`, and `HybridPopoverTooltip` (a Popover on touch devices).
2. Phones, where the table scrolls sideways and the first column stays frozen. The opened region must stay pinned to the visible width.
3. Server pagination. The expanded state must be keyed by row id and hold up across refetches and page changes.

## What the code does today (HEAD)

- `useReactTable` gets **no `getRowId`** (data-table.tsx:274-332), so `row.id` is the row index. Line 552 uses it as the React `key`. No code depends on index-based ids. The only `row.id` in the column registries (`customers/lib/columns-registry.tsx:91`) belongs to the entity object, not the TanStack row.
- The scroll container is `scrollRef` (`overflow-auto`, line 369). The shadcn `Table` wrapper div's own `overflow-x-auto` is overridden to visible (line 370), so `scrollRef` is the only scroll container between a cell and the viewport.
- `containerWidth` is already measured with a ResizeObserver (lines 136-152). It's the `contentRect.width` of `scrollRef`.
- **Stale ref in the brief:** the brief says cells render with "overflow-hidden-style behavior". At HEAD, `TableCell` (`src/shared/components/ui/table.tsx:81-92`) has no overflow class, just `p-2 align-middle whitespace-nowrap`. The only `overflow-hidden` in the body is the pull-to-refresh spacer's inner div (data-table.tsx:492). The Chromium failure in the prototype must have come from a class the prototype added to its own detail `td`. The fix is the same either way (see B).
- Click isolation is done with scattered `e.stopPropagation()` calls: `status-dropdown-cell.tsx:51` (trigger) and `:65` (content); wrapper divs in `meetings/lib/columns-registry.tsx:91,111,126`; `entity-action-menu.tsx:64`; `entity-action-dropdown.tsx:64,70`. **`HybridPopoverTooltip` has none.** On touch it renders a Radix Popover, so tapping the "Addendum" badge in `modules/proposals/core/lib/columns-registry.tsx:44` opens the popover and also reaches the row. The proposals table passes no `onRowClick`, so today that only toggles the unread mobile `activeRowId`: no visible effect.

## Findings

### A. TanStack Table v8: the detail-row pattern, expanded state, pagination, ids

- **The documented pattern is to render your own extra `<tr>`.** The v8 Expanding guide ("Custom Expanding UI") says `row.getCanExpand()` returns false unless the row has `subRows`, and that you override it with `getRowCanExpand: row => true`. You then render `{row.getIsExpanded() && <tr><td colSpan={row.getAllCells().length}>…</td></tr>}`. The official `sub-components` example uses a `Fragment` per row, `colSpan={row.getVisibleCells().length}`, and `renderSubComponent({ row })`. That function is ours, not a library API. Sources: https://tanstack.com/table/v8/docs/guide/expanding, https://github.com/TanStack/table/blob/v8.21.3/examples/react/sub-components/src/main.tsx
- **`getExpandedRowModel` is not needed for a flat detail panel.** The docs example passes it, and a summary of the guide claims it is "still needed". The installed source says otherwise (`table-core/build/lib/features/RowExpanding.js`):
  - `row.getIsExpanded()` reads `state.expanded[row.id]` directly (or `getIsRowExpanded`).
  - `row.toggleExpanded()` writes state without checking `getCanExpand`.
  - `table.getExpandedRowModel()` just returns the sorted row model when the option is absent.
  - The option only flattens `subRows` into view, and our rows have none.
  - One catch: `row.getToggleExpandedHandler()` does check `getCanExpand()`. Without `getRowCanExpand: () => true` it is a no-op for flat rows.
- **`autoResetExpanded`:** the API reference says it "automatically reset[s] the expanded state of the table when expanding state changes". In 8.21.3 the only caller of `table._autoResetExpanded()` is `getGroupedRowModel` (`utils/getGroupedRowModel.js:137`). Changing data, pages or sorting never resets expansion in this table. Setting `autoResetExpanded: false` changes nothing today; it only guards against grouping being added later. Source: https://tanstack.com/table/v8/docs/api/features/expanding
- **Manual pagination:** `paginateExpandedRows` (default `true`) only matters to `getPaginationRowModel`, which we skip when `manualPagination` is on. With server pages, rows the server doesn't return simply aren't rendered. Their `expanded` keys stay in state until something prunes them.
- **`getRowId` is required.** The core reference says: "If not provided the rows index is used … If you need to identify individual rows that are originating from any server-side operations, it's suggested you use this function to return an ID that makes sense regardless of network IO … eg. a … database ID field". Without it, expanding row 3 and then sorting or changing page expands whatever row lands at index 3. Source: https://tanstack.com/table/v8/docs/api/core/table (option `getRowId`)
- `ExpandedState = true | Record<string, boolean>`. It can be controlled with `state.expanded` and `onExpandedChange`.

### B. `position: sticky` inside a colSpan `td` in a horizontally scrolling container

- **Which ancestor it sticks to.** Per the spec, a sticky box's insets are measured from "the scrollport of the nearest scroll container with a matching scrollable axis". The box is shifted "insofar as it can while its position box remains contained within its containing block". MDN adds that it sticks to the nearest ancestor with a scrolling mechanism "(created when overflow is hidden, scroll, auto, or overlay), even if that ancestor isn't the nearest actually scrolling ancestor". Sources: https://drafts.csswg.org/css-position-3/#stickypos-insets, https://developer.mozilla.org/en-US/docs/Web/CSS/position
- **Why `overflow: hidden` on the `td` broke the prototype.** CSS Overflow 3 says "scroll, auto, and hidden … cause the box to be a scroll container". `overflow` applies to block containers, and a table cell is one. An `overflow:hidden` td therefore becomes the sticky element's scroll container. It never scrolls, so the sticky element never moves. This is spec behavior, not a Chromium quirk, so WebKit and Gecko behave the same. **`overflow: clip` does not create a scroll container** ("forbids scrolling entirely"). Use it if a clip is ever needed on an ancestor of a sticky box. Support: Chrome 90, Firefox 81, Safari/iOS 16 (MDN BCD). Sources: https://drafts.csswg.org/css-overflow-3/#overflow-properties, https://github.com/mdn/browser-compat-data/blob/main/css/properties/overflow.json
- **The containing-block limit is met.** The sticky div's containing block is the `td`. With `colSpan` = all columns, the td is as wide as the table, and the table is at least as wide as the container (`tableWidth` in data-table.tsx:340). A box of `containerWidth` can therefore slide across the full scroll range. The td needs `p-0`. With padding, the box sits 8px in at `scrollLeft=0` and a full-container-width box overflows 8px to the right.
- **WebKit:**
  - WebKit bug 155496, "Position sticky does not work within table cells", was FIXED on 2021-09-09 in r282201. The cause was that WebKit computed the containing-block rect with the cell's *intrinsic padding*, which is what `vertical-align: middle` creates. The fix switched to the CSS content box and added test `position-sticky-contained-by-display-table.html`. That matters here because `TableCell` uses `align-middle`. Sources: https://bugs.webkit.org/show_bug.cgi?id=155496, https://trac.webkit.org/changeset/282201/webkit
  - WebKit bug 238016 (sticky inside `contain: paint` / `overflow: clip`) was fixed in Safari 15.5. Source: https://bugs.webkit.org/show_bug.cgi?id=238016
  - caniuse: Safari and iOS Safari 13+ support sticky unprefixed (7.1–12.x needed `-webkit-`). Its table-part notes only concern sticky on `thead` and `tr`. Our sticky element is a plain `div` inside a `td`. Source: https://github.com/Fyrd/caniuse/blob/main/features-json/css-sticky.json
- **Is the prototype sound?** Yes, with these conditions:
  - The detail `td` must not be a scroll container. Leave it at the default `overflow: visible`, or use `clip` if a clip is needed.
  - The td needs `p-0`.
  - Nothing between the td and `scrollRef` may have `overflow` other than `visible`/`clip`. That holds today because line 370 forces the shadcn wrapper to visible.
- **Options compared:**

| Approach | Pros | Cons |
|---|---|---|
| **1. Sticky wrapper, `left:0`, `width: containerWidth` (prototype)** | Uses the RO width that already exists (no new infrastructure). Proven in Chromium. Works in WebKit ≥ the r282201 fix. Keeps the region in table flow, so row height pushes the rows below it naturally. | One extra render on resize. Width is 0 before the first RO callback. That can't matter in practice: expansion happens on user click, long after measurement. |
| **2. Sticky wrapper with `width: 100cqi`, plus `container-type: inline-size` on `scrollRef`** | No JS width at all. Updates in the same frame on resize or rotation. The container size is `scrollRef`'s content box, so it excludes the scrollbar just like the RO value. Support: Chrome 105, Firefox 110, Safari/iOS 16. | Applies inline-size and style containment to `scrollRef`. Harmless here because its width comes from the parent, not its content, but it hasn't been tested on this table in WebKit. Falls back to `svw` if no container is found. |
| **3. Render the detail outside the table** (absolute overlay in the scroll container plus a spacer `tr` of measured height) | Immune to any table or sticky quirk. | Must measure the detail height and keep it in sync, including during animation. Duplicates the layout. Loses natural flow. Much more code. |

  **Recommendation: approach 1.** Approach 2 is a drop-in follow-up once someone checks it on real iOS.

### C. Click handling, Radix portals, and accessibility

- **Portal clicks bubble to the row.** React: "Events from portals propagate according to the React tree rather than the DOM tree. For example, if you click inside a portal, and the portal is wrapped in `<div onClick>`, that `onClick` handler will fire." Clicks inside a portaled `PopoverContent` (rendered to `document.body` by default) therefore reach the `tr`'s `onClick`. That's why `status-dropdown-cell.tsx:65` stops propagation on the content, and why the wrapper divs in the meetings registry catch both trigger and content. Sources: https://react.dev/reference/react-dom/createPortal, https://www.radix-ui.com/primitives/docs/components/popover
- **The consequence for `closest()` checks.** The DOM target of a portaled click is not inside the `tr`. A check like `target.closest('[data-row-interactive]')` can't see the cell's marker. The portal case has to be caught with `!e.currentTarget.contains(e.target as Node)`. That one line rejects every portal-originated click (popover, dropdown, dialog opened from a cell) in any library, with no per-cell code.
- **Radix trigger attributes (checked in the installed packages):**
  - `PopoverTrigger` renders `aria-haspopup="dialog"`, `aria-expanded` and `data-state`, and opens on `onClick` (`react-popover/dist/index.mjs:86-97`).
  - `DropdownMenuTrigger` renders `aria-haspopup="menu"` and opens on `onPointerDown` (`react-dropdown-menu/dist/index.mjs:66`, `:74`).
  - Tooltip triggers set `data-state` and `aria-describedby`, but no `aria-haspopup`.
  - As a result, `closest('[aria-haspopup]')` catches every popover and menu trigger we use. That includes `HybridPopoverTooltip` on touch, `DateTimePicker`, `ParticipantPicker` and `StatusDropdownCell`. It correctly leaves desktop hover-tooltips clickable.
  - `composeEventHandlers` only skips Radix's own handler on `defaultPrevented`, so the existing `stopPropagation` calls never block opening.
- **Use `onClick` on the row, not `onPointerDown`.** On a phone, pointerdown fires at the start of every horizontal pan of the scroll container, so rows would toggle while scrolling. `click` fires only for a tap. Radix menu triggers act on pointerdown and are handled by the `closest` check anyway.
- **Accessibility:**
  - A `<tr>` inside a table may only take `role=row` (HTML-ARIA), so it can't be `role=button`. Making a container `role=button` would also make its descendants presentational (ARIA 1.2 "Children Presentational: True"), hiding the pickers from assistive technology. ARIA 1.2 describes `aria-expanded` on `row` for treegrid use only.
  - The APG Disclosure pattern is the fit: an element with **role button**, **`aria-expanded`** true/false, optional **`aria-controls`** pointing at the content, and toggling on **Enter and Space**. A native `<button>` gives all of that for free.
  - So the row's `onClick` is a pointer shortcut. The accessible control is a real chevron `<button aria-expanded aria-controls>` in the first (frozen) cell.
  - Sources: https://www.w3.org/TR/html-aria/#docconformance, https://www.w3.org/TR/wai-aria-1.2/#row, https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/

### D. motion/react height animation (cheap and safe)

- Motion animates `height` in and out of `"auto"` (`initial={{ height: 0 }} animate={{ height: 'auto' }}`). `AnimatePresence` tracks its **direct children by `key`**. "Any motion components within the exiting component will fire animations defined on their exit props before the component is removed." `AnimatePresence` renders no DOM, so wrapping the detail `<tr>` inside `<tbody>` is valid. Sources: https://motion.dev/docs/react-animation, https://motion.dev/docs/react-animate-presence
- **Animate an inner `div`, never the `tr` or `td`.** Keep `layout` animations and transforms off table parts. data-table.tsx:485 already notes that a transform breaks the frozen column's `sticky-left`.
- **Nesting order matters for sticky:** `td (p-0, overflow visible)` > **sticky div** (`left:0`, width) > **motion.div** (height, `overflow: hidden`) > content. The clipping div is a *descendant* of the sticky div, so it can't become the sticky box's scroll container.
- **Reduced motion:** `MotionConfig reducedMotion="user"` only disables *transform and layout* animations; "other animations, like opacity … will persist". A `height` tween would still run. Use `useReducedMotion()`, which the repo already does in 5 places (e.g. `features/meeting-flow/.../project-photo.tsx:21`), and set `transition={{ duration: 0 }}`. Or skip `initial` and `exit` when it is true. Source: https://motion.dev/docs/react-accessibility

## Recommendation for `DataTable`

1. **Always pass `getRowId: row => row.id`.** `TData extends { id: string }` already guarantees the field. This keys expansion (and React `key`s) by database id, so expansion survives refetches, sorting and page flips. Nothing reads the index ids today.
2. **Add one opt-in prop, `renderExpandedRow?: (row: Row<TData>) => ReactNode`.** When it is set:
   - `getRowCanExpand: () => true`
   - `autoResetExpanded: false` (documents intent; a no-op today)
   - internal `const [expanded, setExpanded] = useState<ExpandedState>({})` wired to `state.expanded` and `onExpandedChange`
   - **no** `getExpandedRowModel`
   - a row click toggles expansion instead of calling `onRowClick` or setting the mobile `activeRowId`. Tables without the prop behave exactly as now.
3. **Page and sort policy.** Clear expansion when `serverPagination.pageIndex`, `pageSize` or the sort key changes. Do it in the existing `onPaginationChange`/`onSortingChange` wrappers (lines 288-317), not in an effect. Keep it across a same-page refetch (ids stable). Whether to allow one open row (accordion) or several is a product call. One-open is simpler on a 390px phone.
4. **Row click handler** (replaces the `stopPropagation` pattern for toggling):
   ```ts
   const INTERACTIVE = 'button, a, input, select, textarea, label, [role="button"], [role="checkbox"], [aria-haspopup], [data-row-interactive]'
   function onRowClick(e: React.MouseEvent<HTMLTableRowElement>, row: Row<TData>) {
     const target = e.target as Element
     if (!e.currentTarget.contains(target)) return // portaled popover/menu/dialog content
     if (target.closest(INTERACTIVE)) return // trigger or control inside the row
     if (window.getSelection()?.toString()) return // user was selecting text
     row.toggleExpanded()
   }
   ```
   The existing `stopPropagation` calls keep working and can be removed gradually. `HybridPopoverTooltip` is covered by `[aria-haspopup]` with no change. `data-row-interactive` is the explicit escape hatch for custom widgets.
5. **Accessible toggle.**
   - In the first (frozen) cell, render a chevron `<button type="button" aria-expanded={row.getIsExpanded()} aria-controls={detailId} aria-label="Show details">` whose `onClick` calls `row.toggleExpanded()`. The row handler ignores it through `closest('button')`.
   - Give the detail region `id={detailId}` (e.g. `` `${tableId ?? 'dt'}-detail-${row.id}` ``).
   - Put `data-state="open|closed"` on the `tr` for styling only.
6. **Markup** (inside a `Fragment key={row.id}`, under `AnimatePresence initial={false}`):
   ```tsx
   <tr key={`${row.id}-detail`}>
     <td colSpan={row.getVisibleCells().length} className="p-0 border-b border-border/50"> {/* overflow stays visible */}
       <div id={detailId} className="sticky left-0" style={{ width: containerWidth || undefined }}>
         <motion.div
           initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
           transition={reduce ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
           className="overflow-hidden"
         >
           {renderExpandedRow(row)}
         </motion.div>
       </div>
     </td>
   </tr>
   ```
   Reuse `containerWidth`. The pull-to-refresh spinner already relies on it. Never put `overflow-hidden` on the `td` or on the sticky div. If a clip is ever needed there, use `overflow-clip` (Safari 16+).
7. **Verify** with `pnpm tsc` and `pnpm lint`, plus a manual check at 390px in Chromium and on a real iOS Safari device: scroll sideways with a row open, rotate, open a status popover inside an expanded row, and tap the Addendum badge.

## Unverified

- Which Safari release first shipped WebKit r282201 (sticky within table cells, Sept 2021). Probably Safari 15.4, but I found no release note. iOS < 15.4 was not considered.
- The `100cqi` alternative (approach 2) has not been tested in this table on WebKit. Its behavior with `border-separate` / `table-fixed` inside a `container-type: inline-size` scroll container is inferred from the specs, not observed.
- Whether iOS momentum scrolling repositions a sticky `div` inside a `td` smoothly, with no one-frame jitter, under `overscroll-none touch-pan-x touch-pan-y`. I found no bug either way, and it needs a device test.
- The full ARIA 1.2 supported-states list for `row` was truncated in the fetch. The "aria-expanded on row is for treegrid" point comes from the fetched summary, not a verbatim quote. The recommendation doesn't depend on it, since the button carries `aria-expanded`.
- When a Radix Popover is open and the user taps a different row, Radix dismisses on pointerdown-outside and the following `click` still toggles that row. I believe this is acceptable, but I haven't checked it in a browser.
- The brief's claim that cells are "currently rendered with overflow-hidden" does not match HEAD (see "What the code does today").

## Verification against the installed package

Checked `node_modules/.pnpm/@tanstack+table-core@8.21.3/.../build/lib/features/RowExpanding.d.ts`. It declares `autoResetExpanded?: boolean` (l.46), `getExpandedRowModel?: (table) => () => RowModel` (l.58), `getRowCanExpand?` (l.70), `manualExpanding?` (l.76), `onExpandedChange?` (l.82), `paginateExpandedRows?` (l.88), and row APIs `getIsExpanded` (l.26), `getToggleExpandedHandler` (l.32) and `toggleExpanded` (l.38). **Confirmed.**

`RowExpanding.js` confirms three behaviors: `getIsExpanded` reads state directly, `toggleExpanded` ignores `getCanExpand`, and `getToggleExpandedHandler` respects it. `grep` shows `_autoResetExpanded()` is called only from `getGroupedRowModel.js:137`. `core/table.js:110-112` confirms the default row id is the index.

## Sources

- TanStack Table v8 Expanding guide: https://tanstack.com/table/v8/docs/guide/expanding
- TanStack Table v8 Expanding API: https://tanstack.com/table/v8/docs/api/features/expanding
- TanStack Table v8 Table API (`getRowId`): https://tanstack.com/table/v8/docs/api/core/table
- TanStack sub-components example (v8.21.3): https://github.com/TanStack/table/blob/v8.21.3/examples/react/sub-components/src/main.tsx
- CSS Positioned Layout 3, sticky: https://drafts.csswg.org/css-position-3/#stickypos-insets
- CSS Overflow 3: https://drafts.csswg.org/css-overflow-3/#overflow-properties
- MDN `position`: https://developer.mozilla.org/en-US/docs/Web/CSS/position
- MDN `<length>` (container query units): https://developer.mozilla.org/en-US/docs/Web/CSS/length
- MDN BCD overflow `clip`: https://github.com/mdn/browser-compat-data/blob/main/css/properties/overflow.json
- MDN BCD container query length units: https://github.com/mdn/browser-compat-data/blob/main/css/types/length.json
- CSS Conditional 5 (`container-type: inline-size`): https://drafts.csswg.org/css-conditional-5/#container-lengths
- caniuse `css-sticky` data: https://github.com/Fyrd/caniuse/blob/main/features-json/css-sticky.json
- WebKit bug 155496: https://bugs.webkit.org/show_bug.cgi?id=155496 · changeset r282201: https://trac.webkit.org/changeset/282201/webkit
- WebKit bug 238016: https://bugs.webkit.org/show_bug.cgi?id=238016
- React `createPortal`: https://react.dev/reference/react-dom/createPortal
- Radix Popover: https://www.radix-ui.com/primitives/docs/components/popover
- WAI-ARIA APG Disclosure: https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/
- ARIA in HTML: https://www.w3.org/TR/html-aria/#docconformance
- WAI-ARIA 1.2 `row`: https://www.w3.org/TR/wai-aria-1.2/#row
- Motion: https://motion.dev/docs/react-animation, https://motion.dev/docs/react-animate-presence, https://motion.dev/docs/react-accessibility
