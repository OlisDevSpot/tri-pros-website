# Specialties — Trade Sheet Design

Meeting-flow step 2, "Which Specialties Matter to You", rebuilt as a lead panel, a catalog grid, and one trade sheet on a single selection model.

Studies page (chosen direction B, "lead with the reason"): https://claude.ai/code/artifact/d7cab77d-5924-492e-aebc-0de7dc32c5d6
Requirements list and architecture choice: agreed in session on 2026-09-13.
Companion process: `docs/how-to/ui-exploration.md`.

---

## 1. Goal

The agent, with the homeowner beside them on a laptop or tablet, confirms the trade the homeowner called about, picks the work, tags why, adds the natural pairing, and moves on while still talking. Every trade on the page opens the same sheet; the sheet is the only place work is chosen; nothing on the page reflows.

The step is customer-facing and Operate-mode: scanability, native expectations, and the real usage scene outrank expression.

## 2. Decisions already made

| Decision | Choice | Where it was made |
|---|---|---|
| Direction | B, lead with the reason, on one trade sheet | User, 2026-09-13 |
| Architecture | View-scoped selection context, one sheet host mounted by the view, open trade in the URL | User, 2026-09-13 (option 1 of 3) |
| Selected means | One or more scopes or add-ons chosen. Zero-item trades are never drawn as selected and never persisted | Requirements 2 |
| Add-ons | Selectable, stored beside scopes in `selectedScopes` with their labels | User, 2026-09-13 |
| Reasons | Per trade, inside the trade sheet, written to that trade's `painPoints`. Not per meeting | User, 2026-09-13 (reversed an earlier call) |
| Imagery | Curated local project photos where a trade has one, labeled placeholder slots elsewhere. Notion cover URLs are not rendered | User, 2026-09-13 |
| Primitives | shadcn only: Sheet (Radix Dialog), Drawer (vaul), ToggleGroup and Toggle (Radix). No hand-rolled overlay, no hand-rolled pressed state | User correction, 2026-09-13 |
| Rendering | Toggling an item updates that item. The sheet never remounts on a toggle; no animation replays on unrelated updates | User correction, 2026-09-13 |
| Data access | UI-only build. Backend, schema, and business-rule changes are aggregated in §9 for the user to run first | Ground rule |
| Device | Laptop and tablet weighted equally | Carried from Who We Are, 2026-09-11 |

## 3. Content

- **Trades**: 27 from Notion via `notionRouter.trades.getAll` (id, name, slug, type, homeOrLot, relatedScopes). Disabled trades are dropped at extraction.
- **Scopes and add-ons**: 100 from `notionRouter.scopes.getAll` (id, name, entryType `Scope | Addon`, unitOfPricing, relatedTrade). Grouped on the client by `relatedTrade`.
- **Reasons**: `meetingPainTypes` from `src/shared/constants/enums/meetings.ts`, eleven strings, verbatim.
- **Outcome lines**: five, verbatim from `docs/sales/in-home-meeting-playbook.md` (roofing, insulation, windows, HVAC, bathroom), keyed by trade slug. Trades without one show nothing; no line is invented.
- **Pairings**: three from the same playbook (insulation + HVAC, roofing redeck + insulation, windows + insulation), keyed by trade slug, each with its one-line reason.
- **Photos**: seven trades and seven scopes from `public/portfolio-photos/projects/` (Monique kitchen and bath, Riviera pool, Altura turf, Bliss pavers, Olympia tile, Atlas patio, outdoor kitchen, and garage), keyed by trade slug and scope name. Everything else renders `PlaceholderSlot` with the trade name.
- **Lead trades**: the customer's requested trade ids from the lead, when present on the joined customer (§9 confirms the field).

## 4. Architecture

### 4.1 The selection model

`src/features/meeting-flow/contexts/trade-selection-context.tsx`

`TradeSelectionProvider` wraps the meeting-flow view's content (inside `MeetingFlowViewInner`, once the meeting has loaded), so every step can read and open trades. It owns:

- **The shadow**: `useState<TradeSelection[]>` seeded from `flowState.tradeSelections`, re-seeded when the server value changes (the existing `serverJson` reconcile, moved here from the step).
- **The write path**: `useDebounce(normalized, 800)` from `src/shared/hooks/use-debounce.ts`; an effect calls `onFlowStateChange({ tradeSelections })` when the debounced value differs from the last written value. `normalized` drops zero-item trades and is the only thing ever persisted. Opening or closing the sheet never writes.
- **The open state**: `useQueryState('trade', tradeSheetParser)` with `tradeSheetParser = parseAsString` added to `constants/query-parsers.ts`. `focusScopeId` is transient component state, not URL.
- **Actions**: `openTrade(tradeId, { focusScopeId? })`, `closeTrade()`, `toggleScope(tradeId, scope)`, `toggleAddon(tradeId, addon)`, `toggleReason(tradeId, reason)`, `setNote(tradeId, note)`, `clearTrade(tradeId)`.
- **Derived facts** through pure functions in `lib/trade-selection.ts`: `isTradeSelected`, `itemCount`, `selectionSummary`, `normalizeForWrite`, `withScopeToggled`, `withAddonToggled`, `withReasonToggled`, `withNote`, `withoutTrade`. All take and return `TradeSelection[]`; no component reimplements any of them.

Context value is split in two so tiles do not re-render on open-state changes: `TradeSelectionContext` (selections plus actions) and `TradeSheetContext` (`openTradeId`, `focusScopeId`, `openTrade`, `closeTrade`). Hooks `useTradeSelection()` and `useTradeSheet()` throw outside the provider, mirroring `usePresentation`.

### 4.2 Catalog data

`src/features/meeting-flow/hooks/use-trade-catalog.ts`

One hook that runs the two list queries and returns `{ trades, scopesByTrade, isLoading, error }` where `scopesByTrade` is a `Map<tradeId, { scopes: ScopeOrAddon[], addons: ScopeOrAddon[] }>` built by `lib/group-scopes-by-trade.ts`. No hover-time queries. No per-trade queries. The provider exposes the catalog too, so the sheet and the tiles resolve names, units, and photos from the same map.

Loading and error render through `LoadingState` and `ErrorState` per `frontend-stack.md#error-and-loading-states`.

### 4.3 The trade sheet

`src/shared/components/dialogs/sheets/responsive-sheet.tsx` (new, shared)

A generalized host, not a feature-local wrapper: above `lg` it renders `Sheet` / `SheetContent side="right"` from `ui/sheet.tsx`; below `lg` (`useIsBelowLg`) it renders `Drawer` / `DrawerContent` from `ui/drawer.tsx` with `direction="bottom"`. Props: `open`, `onOpenChange`, `title`, `description?`, `footer?`, `contentClassName?`, `children`. Header and footer map to `SheetHeader` / `SheetFooter` and `DrawerHeader` / `DrawerFooter`. The Radix and vaul primitives supply the overlay, focus trap, Escape, scroll lock, and return-focus; nothing is re-implemented. The context panel and persona panel can adopt it later without change.

`src/features/meeting-flow/ui/components/trade-sheet/`

- **`trade-sheet-host.tsx`** — mounted once by the view next to the context and persona panels. Reads `useTradeSheet()`; renders `ResponsiveSheet` with `open={!!openTradeId}` and `<TradeSheetBody key={openTradeId} tradeId={openTradeId} />`. Keyed on the trade id only, so toggles inside never remount the body.
- **`trade-sheet-body.tsx`** — composition for one trade: `TradeSheetHeader`, `TradePhoto` (real photo or `PlaceholderSlot`), `OutcomeLine` (renders nothing when absent), `ScopeTileGroup`, `AddonChipGroup`, `ReasonChipGroup`, `TradeNoteField`, `PairingCard`, and the footer with `Remove from project` (hidden until selected) and `Done`.
- **`scope-tile-group.tsx`** — `ToggleGroup type="multiple"` from `ui/toggle-group.tsx`, `value` = the trade's selected scope ids, `onValueChange` → `toggleScope` per changed id. Items are `ScopeTile`.
- **`scope-tile.tsx`** — one presentational card (photo or unit-of-pricing block, name, unit, check mark) with a `mode` prop. `mode="toggle"` renders a `ToggleGroupItem`, so pressed state comes from Radix (`data-state=on`, `aria-pressed`); this is the sheet. `mode="open"` renders a `Button` with `aria-pressed` mirrored from the model and an `onOpen` callback; this is the lead panel, where a tap opens the sheet rather than toggling. Same markup and classes in both modes. Wrapped in `React.memo`. Highlight for `focusScopeId` uses `outline-2 outline-primary -outline-offset-2`, never `ring`.
- **`addon-chip-group.tsx`** and **`reason-chip-group.tsx`** — `ToggleGroup type="multiple"` with `ToggleGroupItem size="sm"` pill styling. Reasons are the eleven `meetingPainTypes`.
- **`trade-note-field.tsx`** — `Textarea`, local value, writes `setNote` on blur, as today.
- **`pairing-card.tsx`** — reads `TRADE_PAIRINGS`; renders only when the trade is selected. Its button calls `openTrade(pairedId)`. `AnimatePresence initial={false}` so it animates on appear and never replays on unrelated updates.

Rendering rule, binding: a toggle changes one item's pressed state. React reconciles the changed `ToggleGroupItem`; no ancestor is keyed on selection, no list is rebuilt, no animation restarts. The body reads its trade's entry through `useTradeSelection()`; memoized items receive primitive props only.

### 4.4 The step

`src/features/meeting-flow/ui/components/steps/specialties/`

- **`index.tsx`** — `SpecialtiesStep`. Composition only: `StepIntro`, `ProjectStrip`, `LeadPanels`, `TradeCatalog`. Reads the catalog and the model from context; holds no state.
- **`project-strip.tsx`** — selected trades as `Toggle`-styled chips with item counts; a chip calls `openTrade(id)`. Empty copy when nothing is selected.
- **`lead-panels.tsx`** and **`lead-panel.tsx`** — one panel per lead trade that exists in the catalog: photo or slot, "You called about", name, outcome line, every scope as `ScopeTile mode="open"` whose `onOpen` calls `openTrade(tradeId, { focusScopeId })`, `PairingCard`. With no lead trade the panels render nothing and `StartHint` renders instead.
- **`trade-catalog.tsx`** — search input (`useState`, filters by name), three category sections from `TRADE_CATEGORY_ORDER`, each a wrapping grid of `TradeTile`. No horizontal scrolling.
- **`trade-tile.tsx`** — a `Button variant="outline"` with `aria-pressed={isTradeSelected}` and the item count; click → `openTrade(id)`. Tiles never toggle selection.

The old `specialties-step.tsx`, `trade-card.tsx`, `trade-detail.tsx`, and `scope-card.tsx` are deleted. `trade-project-grid.tsx` stays; the portfolio step uses it.

### 4.5 Data and types

Persisted shape is unchanged: `tradeSelectionSchema` in `src/shared/entities/meetings/schemas/index.ts`. Add-ons are stored in `selectedScopes` as `{ id, label }` alongside scopes. Reasons stay in `painPoints`. Notes stay in `notes`.

New constants, all in `src/features/meeting-flow/constants/`:

- `trade-outcomes.ts` — `TRADE_OUTCOMES: Record<slug, string>`, five entries, playbook verbatim.
- `trade-pairings.ts` — `TRADE_PAIRINGS: Record<slug, { pairedSlug, reason }>`, three entries.
- `trade-photos.ts` — `TRADE_PHOTOS: Record<slug, string>` and `SCOPE_PHOTOS: Record<scopeName, string>` pointing at files under `public/portfolio-photos/projects/`. Replaced by `mediaFiles` when the R2 cover-image migration lands.
- `query-parsers.ts` — adds `tradeSheetParser`.

New types in `src/features/meeting-flow/types/index.ts`: `TradeCatalog`, `TradeSelectionActions`, `TradeSheetState`.

`lib/derive-lead-trades.ts` — reads the customer's requested trade ids when the field is present and returns those that exist in the catalog.

### 4.6 Responsive behavior

- **≥ lg**: side sheet, `contentClassName="sm:max-w-xl"` so scope tiles fit three across. Lead panel is photo left, content right.
- **< lg**: bottom drawer at up to 80vh (vaul default), drag handle from `DrawerContent`. Lead panel stacks photo above content. Catalog grid drops to two columns at `sm` and one below.
- The page scroller keeps a bottom padding equal to the footer's floating-trigger clearance so the Context and Persona triggers never cover the last row. The view publishes that clearance as one CSS variable and both the page scroller and the presentation step read it, which retires the value the presentation step hard-codes today.

### 4.7 Motion

`motion/react` only. Pairing card appear and leave through `AnimatePresence initial={false}` with `COLLAPSE_TRANSITION`. Sheet and drawer animation come from the primitives. No animation on toggle. The view wraps its content in `MotionConfig reducedMotion="user"`; the presentation primitive keeps its own, which nests harmlessly.

### 4.8 Accessibility

- Sheet and drawer are dialogs with focus trap, Escape, and return-focus from the primitives.
- Every toggle exposes `aria-pressed` through Radix; group roving focus through ToggleGroup.
- 44px minimum targets on tiles and chips at every breakpoint; 16px body text.
- Selected state is shown by border, fill, and check mark, never color alone.
- Focus scope: the sheet scrolls the focused tile into view and moves focus to it once on open.
- Highlights use outline with negative offset inside the scrolling body.

## 5. Error handling and edge cases

- Catalog fails to load: `ErrorState` with retry; the model still holds the selections so nothing is lost.
- A persisted selection references a trade or scope no longer in the catalog: the tile renders by stored name with a muted "not in the catalog" hint; the sheet shows the stored items as removable chips; nothing is dropped silently.
- Trade with no scopes (Framing, Tile): the sheet says so and offers add-ons if any; the trade can be selected through an add-on only.
- Server refetch while the sheet is open: the shadow re-seeds, the sheet stays open (URL state), pressed states update in place.
- Another device edits the same meeting: last write wins, as today. Not solved here.

## 6. Verification

Playwright against the dev server, both color schemes, at 1440×900, 1024×768, 820×1180, 390×844:

1. Open from a catalog tile, from a lead-panel scope (focused scope highlighted and focused), from a project-strip chip, and from the pairing card. Each opens the same sheet with the right trade.
2. Toggle a scope, an add-on, and a reason: only that item's pressed state changes; no remount (the DOM node identity of an untouched sibling is stable across the toggle); no animation replays.
3. Open a trade, close without picking: tile not pressed, project strip unchanged, nothing written.
4. Page height and scroll position unchanged across open and close.
5. Persisted `tradeSelections` after a debounce equals the normalized model: scopes and add-ons as id plus label, reasons, note; zero-item trades absent.
6. Escape closes; focus returns to the opener; drawer drag-to-close below `lg`.
7. `?trade=<id>` survives a reload and opens the sheet.
8. Search filters tiles and categories; no horizontal scroll at any width.

`pnpm tsc` and `pnpm lint` clean.

## 7. Files

Create:

- `src/shared/components/dialogs/sheets/responsive-sheet.tsx`
- `src/features/meeting-flow/contexts/trade-selection-context.tsx`
- `src/features/meeting-flow/hooks/use-trade-catalog.ts`
- `src/features/meeting-flow/lib/trade-selection.ts`
- `src/features/meeting-flow/lib/group-scopes-by-trade.ts`
- `src/features/meeting-flow/lib/derive-lead-trades.ts`
- `src/features/meeting-flow/constants/trade-outcomes.ts`
- `src/features/meeting-flow/constants/trade-pairings.ts`
- `src/features/meeting-flow/constants/trade-photos.ts`
- `src/features/meeting-flow/ui/components/trade-sheet/{trade-sheet-host,trade-sheet-body,trade-sheet-header,trade-photo,outcome-line,scope-tile-group,scope-tile,addon-chip-group,reason-chip-group,trade-note-field,pairing-card}.tsx`
- `src/features/meeting-flow/ui/components/steps/specialties/{index,step-intro,project-strip,lead-panels,lead-panel,start-hint,trade-catalog,trade-tile}.tsx`

Modify:

- `src/features/meeting-flow/constants/query-parsers.ts` — `tradeSheetParser`.
- `src/features/meeting-flow/types/index.ts` — new types.
- `src/features/meeting-flow/ui/views/meeting-flow.tsx` — wrap content in `TradeSelectionProvider`, mount `TradeSheetHost`, import the new step.
- `src/features/meeting-flow/ui/components/steps/who-we-are/placeholder-slot.tsx` — moves to `ui/components/presentation/placeholder-slot.tsx` so both steps share it.
- `src/features/meeting-flow/ui/components/steps/who-we-are/credentials-section.tsx` and `point-media-layer.tsx` — import path updated for the moved `PlaceholderSlot`.

Delete:

- `src/features/meeting-flow/ui/components/steps/specialties-step.tsx`
- `src/features/meeting-flow/ui/components/steps/trade-card.tsx`
- `src/features/meeting-flow/ui/components/steps/trade-detail.tsx`
- `src/features/meeting-flow/ui/components/steps/scope-card.tsx`

## 8. Out of scope

- Per-scope sell-side text (Notion SOW pages) in the sheet. The read procedures exist; a later pass loads them lazily inside the sheet.
- Opening the trade sheet from the portfolio and closing steps. The provider already covers them; wiring is a follow-up.
- Replacing `TRADE_PHOTOS` with `mediaFiles` (R2 cover-image migration, issues #243 and #244).
- Any change to the seven downstream consumers of `tradeSelections`.

## 9. Data access — you run these first

None of the following is touched by the UI build. Tasks that depend on an item sit behind a user gate in the plan.

| Item | What | Why | Gate for |
|---|---|---|---|
| Energy Saver qualification | `constants/programs.ts:15` passes the Notion trade id to a slug check (`energy-trades.ts`), so it never matches, and the catalog has no Solar trade. Decide the rule and where slugs come from (store `tradeSlug` beside `tradeId`, or resolve through the cached catalog at qualification time) | Real bug, business ruling | Nothing in this build; the program step |
| Requested trades on the flow context | Confirm `leadMetaJSON.requestedTrades[].tradeId` (Notion ids) reaches `flowContext.customer` through `getByIdWithJoins`. The join spreads every customer column; the JSONB decomposition may have moved the field | Lead panels pre-seed | `lead-panels.tsx` |
| Add-ons in proposal defaults | `build-proposal-defaults.ts` maps `selectedScopes` into SOW sections. Add-ons will now appear there. Confirm that is the intended semantics or split them | Add-on selectability | `addon-chip-group.tsx` |
| Cover images | R2 migration (#243, #244) owns hosting. This build reads `TRADE_PHOTOS` from `public/` | Imagery decision | Nothing |

## 10. Amendments (2026-09-14, at execution start)

The meeting-flow shell (`docs/superpowers/specs/2026-09-13-meeting-flow-shell-design.md`, shipped `cfb963d6..be4db514`) landed after this spec was approved and rebuilt the view. Where the two disagree, the shell wins for shell concerns. Changes made by the SDD controller, each recorded as a ruling in the plan's ledger:

- **§4.6 clearance variable: dropped.** The shell's `StepRegion` already pads the page scroller by `--stage-inset-b`, which clears the floating step capsule. The footer triggers this section referred to no longer exist.
- **§4.3 "the context panel and persona panel can adopt it later": superseded.** The shell hosts them in its own `MeetingPanel`, which is deliberately not a sheet. `ResponsiveSheet` stays a shared primitive with the trade sheet as its one consumer; whether it stays in `shared/` is a follow-up.
- **§4.1 and §4.7 provider and `MotionConfig`:** mounted around the shell's `StageFrame`, inside the final render of the view.
- **Keyboard:** the shell's `useMeetingFlowKeys` is the one key owner. It ignores portaled dialogs and typing targets, so the trade sheet adds no key handling.
- **§7 `placeholder-slot.tsx` move: deferred.** Another session's uncommitted Who We Are corrections edit that file and add an untracked importer. The trade sheet imports it from `steps/who-we-are/` and recolors it with classes.
- **§4.3 note field: writes on change, not on blur.** Escape and overlay clicks unmount the textarea before `blur` fires, which would lose the note. The model's server write is already debounced.
- **§4.1 re-seed rule:** the shadow re-seeds only when the server value is something this provider never wrote, so a stale refetch landing after a newer write cannot roll it back.
- **§3 and §4.5 photo source: moved.** `public/portfolio-photos/projects/` is git-ignored, so those files never deploy. The curated photos are optimized to webp under `public/meeting-flow/trades/`; the R2 migration still replaces them.
- **§2 "never persisted": reversed to preserve data.** Meeting creation and the old step already save trades with no items, sometimes with reasons and notes, and seven downstream readers handle them. A write now keeps every entry except one that is completely empty and was never on the server; "Remove from project" deletes explicitly and shows whenever the trade has a stored entry. "Selected" in the UI still means one or more items.
- **§4.1 write path:** after the server has confirmed the latest write, a rollback to an older value this provider wrote triggers a re-write of the latest. The root cause, the view merging patches into a cached `flowStateJSON` with no optimistic update, is a follow-up.
- **§4.4 start hint:** not rendered until lead panels exist, because its copy says nothing was requested.
- **§4.3 note field:** back to a local draft, committed on blur and when the field unmounts (the provider outlives the sheet), so typing does not send a meeting update on every pause.
