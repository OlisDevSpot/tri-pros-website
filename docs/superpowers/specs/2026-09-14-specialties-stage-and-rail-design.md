# Specialties, Stage and Rail — Design

**Status:** draft for approval, 2026-09-14. Round 2 of the Specialties step. Supersedes the step layout, the trade sheet and the project strip in `2026-09-13-specialties-trade-sheet-design.md`; keeps its selection model (§4.1 there, with §10 amendments) except where §2 and §4.2 below change it.

**Studies (what this spec describes):** https://claude.ai/artifact/XAkzajHMWv3APK6piustET, Study B, version 3.

**Evidence:** critiques `.impeccable/critique/2026-09-14T17-28-59Z__…specialties.md` (shipped step, 22/40) and `2026-09-15T02-46-52Z__specialties-r2-studies-html.md` (Study B v1, 20/40); render measurements `<scratchpad>/r3/rerender/tables.md`; baseline `<scratchpad>/r2/baseline.json`.

---

## 1. Goal

The owner, on a large laptop screen: the step "does what it's supposed to, but not in the right way in the right places." Step 2 is the Phase 4 moment of the in-home playbook ("sell the destination, not the ticket"). The homeowner should see a large, real Tri Pros project for the trade being discussed and hear its outcome, while the rep picks the work beside it. What the rep records about the homeowner stays out of the homeowner's view.

## 2. Decisions already made

| # | Decision | Source |
|---|---|---|
| D1 | Study B, "Stage and rail": the step is full width and two columns. Left: the **showcase** (homeowner). Right: the **work column** (rep). | Owner, 2026-09-14 |
| D2 | No project strip on the canvas. | Owner |
| D3 | Trades and scopes become a **Project** section of the meeting panel, directly under Meeting: Meeting → Project → Context → Persona. | Owner |
| D4 | The panel **overlays** the stage on lg+, as the shipped shell does today; nothing reflows when it opens. | Owner (correction #2) |
| D5 | Below lg the meeting panel opens through `ResponsiveSheet` (bottom drawer). | Owner |
| D6 | Type: no weight above 600. Syne 600 only for the trade title, the step question and section headings; Nunito 400/600 for everything else. The outcome sentence is the lead; the title sits one step above it. | Owner (correction #1) |
| D7 | "On your project" trades sit **above** the trade switcher; the switcher heads its own group with the work cards and "Often done together". | Owner (correction #3) |
| D8 | Project section = **Summary rows**, using the **Mirror option rows** (checkbox rows) to choose work. | Owner |
| D9 | Reasons and the note live **only** in the panel's Project section. The canvas never shows them. | Owner |
| D10 | Showcase left, work right. | Owner |
| D11 | Only owned photos: the committed trade photos and Tri Pros portfolio projects. No Notion cover URLs. A trade with neither gets a typographic fallback, never an empty frame. | Owner, round 2 Q3 |
| D12 | Selecting anything must not re-render unrelated UI. Measured today: no remount or animation replay, but ~403 renders per toggle and ~1,480 per save. | Owner (correction #5), measurement |
| D13 | Carried from round 1: a trade is on the project only with one or more scopes; one selection source; every scope is editable; laptop and tablet, keyboard plus 44px touch; shadcn primitives, no hand-rolled controls. | Round 1 |
| D14 | Panel edits never move the homeowner's stage; only an explicit "Show" does. Every removal offers Undo. | Critique 2, accepted into the mock |

## 3. Content

| Beat | Copy / data | Source |
|---|---|---|
| Step question (work column head) | "What areas of your home matter most?" | `SPECIALTIES_COPY.heading` |
| Showcase eyebrow | Trade category label | `TRADE_CATEGORY_LABELS[trade.type]` |
| Showcase title | Trade name | Notion catalog `trade.name` |
| Showcase lead | Outcome line (5 trades today; none invented) | `TRADE_OUTCOMES[slug]` |
| Showcase status | "On your project · N pieces of work" | new copy, `SPECIALTIES_COPY.showcase.status` |
| Benefit lines (≤2 on laptop, hidden on the tablet band) | headline + body | `BENEFIT_TEMPLATES[*].byTrade[trade.name]`, lines containing a number excluded (§4.5) |
| Showcase photo + caption | Portfolio project hero; caption "Tri Pros project · {city}, {state} · {duration}" or the curated photo's alt text | portfolio projects read (§5), `TRADE_PHOTOS` / `SCOPE_PHOTOS` |
| Proof strip | "Our projects · N" + up to 4 thumbnails (only when N ≥ 2) | same read |
| Fallback (no photo) | "What's included" + the trade's scope names | catalog scopes |
| On-project row label | "On your project"; empty: "Nothing yet. Choose a trade and add the work that fits." | new copy |
| Switcher | "Trade" label, trade name; list groups "On your project", then the three categories; row meta "N kinds of work" / "Scopes to define"; filter "Filter trades…"; empty "No trades match." | new copy + `SPECIALTIES_COPY.catalog` |
| Work meta | "N kinds of work · tap to add" | new copy |
| Work card state | "Add to project" / "On your project" | new copy |
| Often done together (canvas) | "Often done together" + "{trade} and {paired}" + "Show {paired}" — the internal pairing reason is **not** shown here | `TRADE_PAIRINGS[slug].pairedSlug` |
| Project section | "On the project", "N trades · N scopes", row summary (first scope "+N"), reasons as text or "No reason yet", "On stage", "Work", "Reasons", "Edit reasons" / "Done", "Note", "Show on stage", "Remove from project", "Pairs with {paired}: {reason}" + "Show" | new copy + `TRADE_PAIRINGS[slug].reason` + `meetingPainTypes` |
| Undo toast | "{trade} is off the project" + "Undo" (unticking a non-last scope needs no toast: the unticked card or option row stays visible and re-tickable) | new copy |

All new strings go into `constants/specialties-copy.ts` (replace the unused `project`, `start`, `sheet.*` keys that the retired components used).

## 4. Architecture

### 4.1 Layout

- **Step root:** `MeetingStepLayout` gains `'split'` (`types/index.ts:81`), and step 2's config uses it. For `split` the view still renders `StepRegion` (so `data-step-root` focus and the step heading stay), with `className="overflow-hidden p-0"`; the step owns its two scrollers inside it. `page` and `presentation` are unchanged.
- **Container query, not viewport:** the step root is `@container/specialties`. At `@4xl` (stage ≥ 896px wide) it is a grid `grid-cols-[minmax(0,1.45fr)_minmax(420px,1fr)]` at full stage height: showcase pinned left (no scroll), work column scrolls right. Below `@4xl` it is the **band layout**: grid rows `42% minmax(0,1fr)`, the showcase as a pinned band with title and outcome over a scrim, the work column scrolling beneath. A container query keeps a 1280px laptop with the CRM sidebar open (stage ≈ 976px) in two columns, and puts an 820px tablet in the band.
- **Capsule clearance:** the showcase text block pads its bottom by `--stage-inset-b`; the work column pads its bottom by the same variable.
- **Panel:** unchanged overlay at lg+ (`MeetingPanel`, `absolute … lg:right-12`, non-modal). Below lg the panel content renders in `ResponsiveSheet` (Drawer), capped at 60% height so the showcase band stays visible. The rail stays lg+ only; below lg the top bar's panel button opens the drawer.

### 4.2 Selection model changes

The provider (`contexts/trade-selection-provider.tsx`) keeps its shadow, debounce, echo and rollback rules. Changes:

1. **Split the context** (render cost, D12): `TradeCatalogContext` (catalog, stable), `TradeActionsContext` (`toggleItem`, `toggleReason`, `setNote`, `removeTrade`, `restoreTrade`; stable callbacks), `TradeSelectionsContext` (`selections`; changes on every edit), `TradeStageContext` (`stageTradeId`, `stageMediaKey`, `showTrade`, `showMedia`; replaces `TradeSheetContext`). Hooks: `useTradeCatalogContext`, `useTradeActions`, `useTradeSelections`, `useTradeStage`. No selector store: entries keep their identity across edits to other trades (`upsert` maps only the touched entry, `lib/trade-selection.ts:82`), so memoized children take the entry (`ProjectRow`) or a `pressed` boolean (`WorkCard`, option rows) as props and skip untouched trades.
2. **Stage focus replaces the sheet.** `openTrade(tradeId, { focusScopeId })` becomes `showTrade(tradeId)`. `?trade=` (`tradeSheetParser`) stays and now means "the trade on stage"; it defaults to the first on-project trade, else the first catalog trade.
3. **Unticking the last scope removes the trade.** The item toggle that empties a trade's items calls `removeTrade` (drops scopes, reasons and note) and raises an Undo toast holding the removed entry; `restoreTrade(entry)` puts it back. This retires follow-up item 0 for this step: an emptied trade is no longer kept as a zero-item entry. Zero-item entries that arrive from the server (meeting creation) are still kept untouched by `normalizeForWrite`; they simply never show as selected. The construction catalog design (D5) and this rule now agree (see §9, stale doc).
4. **Panel edits carry no stage change.** Only `showTrade` and `showMedia` move the showcase.

### 4.3 Components

Feature-local, one component per file, named exports, no file-level constants in component files.

**Canvas — `ui/components/steps/specialties/`**
| File | Role |
|---|---|
| `index.tsx` | `SpecialtiesStep` (memoized, no props): loading/error gate, container, two regions |
| `showcase.tsx` | Left region: `ShowcaseMedia` + text block (eyebrow, title, outcome, status, benefits) |
| `showcase-media.tsx` | Keyed stage image. `AnimatePresence` with `key={mediaKey}` crossfade (opacity, 400ms, `--ease-brand`); reduced motion shows the final image. Project media through `OptimizedImage` (`sizes` for a ~60vw column); curated photos through `next/image`. Caption and the proof strip overlay the image. |
| `showcase-fallback.tsx` | Blueprint decor (anchored top-right, DESIGN.md §Atmosphere) + "What's included" list |
| `project-proof-strip.tsx` | "Our projects · N" + ≤4 `Toggle` thumbnails → `showMedia(key)` |
| `showcase-benefits.tsx` | ≤2 benefit lines, two columns at `@4xl`, hidden in the band |
| `work-column.tsx` | Right region: question, `OnProjectTrades`, work group |
| `on-project-trades.tsx` | Horizontally scrolling chip row (thumbnail + name + count) → `showTrade`; reserved min-height when empty |
| `trade-switcher.tsx` | shadcn `Popover` + `Command` (combobox with filter, arrow keys, Enter, groups); rows show a thumbnail and meta |
| `work-card-group.tsx` | shadcn `ToggleGroup type="multiple"` of `WorkCard`; replaces `trade-sheet/scope-tile-group.tsx` |
| `work-card.tsx` | Memoized; photo (4:3) or decor fallback, scope name, state line, corner check; no unit, no caption. Replaces `trade-sheet/scope-tile.tsx` |
| `often-together.tsx` | Homeowner-safe pairing prompt → `showTrade(paired)` |

**Panel — `ui/components/project-section/`**
| File | Role |
|---|---|
| `project-section.tsx` | "On the project" summary + one `ProjectRow` per on-project trade; empty state |
| `project-row.tsx` | shadcn `Collapsible`. Header: thumbnail, name, "On stage" marker, work summary, reasons as text. The row whose trade is on stage opens by default; the rep can open any one row. Body: `WorkOptionList`, `ReasonPicker`, `TradeNoteField`, footer ("Show on stage" when not on stage, "Remove from project"). Trailing "Pairs with …" line. |
| `work-option-list.tsx` | **The Mirror option rows:** `ToggleGroup type="multiple"` whose items are full-width 44px rows (label left, checkbox square right, pressed fill). Used for work in the panel. |
| `reason-picker.tsx` | Selected reasons first as pressed chips; "Edit reasons" reveals all 11 as a `ToggleGroup`. Replaces `trade-sheet/reason-chip-group.tsx` |
| `trade-note-field.tsx` | Moved from `trade-sheet/`; draft commits on blur or unmount (unchanged behavior); 44px collapsed, grows on focus |
| `orphan-item-chips.tsx` | Moved from `trade-sheet/`; shown inside the row |

**Shell**
- `constants/shell.ts`: `PANEL_SECTIONS = ['meeting', 'project', 'context', 'persona']`; `types/index.ts` `PanelSection` gains `'project'`; `shell-copy.ts` label "Project".
- `shell/inspector-rail.tsx`: Project item (clipboard-check icon) second, badge = on-project trade count.
- `shell/meeting-panel.tsx`: lg+ unchanged overlay; below lg renders its header + body inside `ResponsiveSheet`. `ResponsiveSheet` gains separate `sheetClassName` / `drawerClassName` (follow-up 12) so the drawer can cap at 60%.
- `views/meeting-flow.tsx`: renders `<ProjectSection />` for `panel === 'project'`; retires `<TradeSheetHost />`.
- Step 2 opens the panel on Project? **No**: the panel stays closed by default (present-mode privacy rule from the shell spec).

**Retired:** `steps/specialties/{project-strip,step-intro,trade-catalog,trade-tile}.tsx`, `trade-sheet/{trade-sheet-host,trade-sheet-body,trade-sheet-header,trade-sheet-footer,trade-photo,outcome-line,pairing-card,scope-tile-group,scope-tile,reason-chip-group}.tsx` (moved or replaced as listed). `start-hint.tsx` and `deriveLeadTrades` stay for the gated lead-requested group (§5).

### 4.4 Render budget (D12)

Measured baseline, 1440×900: ~403 renders per toggle, ~1,480 per save (3 full view commits), 2 GETs per save. Fixes, in this order, each measured with the same commit hook (`<scratchpad>/r3/rerender/instrument.js`):
1. `SpecialtiesStep` and the panel's `ProjectSection` are `memo` with no props, so view re-renders never reach them.
2. The view stops subscribing to mutation status: `handleFlowStateChange` depends only on the stable `mutate` and reads the current `flowStateJSON` from the query cache at call time (`queryClient.getQueryData`), so `flowContext` keeps its identity across pending/success. Same for `updateCustomerProfile`.
3. Context split (§4.2.1); `WorkCard` and `ProjectRow` are memoized and read their own entry.
4. Memoize the shadcn `ToggleGroupContext` value (`src/shared/components/ui/toggle-group.tsx:36`); memoize `selectedIds` arrays; module-level empty-array fallbacks.
5. Drop the `onSuccess` invalidation for the trade selection write where the realtime echo (`use-meeting-sync.ts`) already invalidates, or seed the cache from the mutation response — whichever keeps the provider's echo detection intact (verified by the rollback test from round 1).

**Budget (verification gate) — amended 2026-09-16 by the owner:** the gate is behavioral, not a raw render count.
- 0 mounts on any toggle; no entrance animation replays on a toggle or a save.
- 2 `getByIdWithJoins` GETs per save (the save's own refetch plus the realtime echo) — amended 2026-09-16 by the owner; 1 GET per save waits on DA5 or round-1 follow-up 9. Never 0.
- A stage `WorkCard`'s content never re-renders on any toggle; a panel `ProjectRow` re-renders only for an edit to its own trade; every app component that reads selections renders at most once per toggle.
- A panel edit never re-renders the stage's work cards. Inside the edited trade's own panel row, its controls may re-render together (its work option rows map their items inline).
- The showcase `<img>` node is replaced only when the media key changes.
- Regression baseline (dev meeting, 1440×900, measured 2026-09-16 at `d00d08d7`): scope on 100, scope off 74, reason on 451, reason off 335 renders. A later run more than 10% above any of them is a regression to explain.

*Why the raw caps were dropped:* the original caps (scope toggle ≤ 90, reason toggle ≤ 60) were set before a working instrument existed. Measured, every remaining render is Radix `ToggleGroup` internals: about 13 component fibers per item, for every item in the tapped group, across two commits per tap (roving focus moves the tab stop, then the value changes). Meeting the caps would mean replacing the primitive D8 chose and hand-rolling its roving focus, for a saving of a few milliseconds per tap.

*Step 5 not done (owner, 2026-09-16):* skipping the save's own refetch made correctness depend on the realtime echo arriving. `handleContextChange` and `handleFlowStateChange` merge each patch onto the cached meeting, so a missed echo lets the next edit overwrite the previous one on the server. The skip was reverted (`6091ac3c`, `3451b9cd`); the save's own refetch stays until DA5 (origin-tagged publish) or round-1 follow-up 9 (optimistic cache update or per-key server merge) lands.

### 4.5 Data and types

- `lib/select-trade-showcase.ts` (edge mapper): `(trade, catalog, projects, curated) → { media: ShowcaseMedia[], outcome?, benefits: TradeBenefit[] }`. `ShowcaseMedia = { key, kind: 'project' | 'curated', file | src, caption }`. Project ranking = most of the trade's scopes first (same rule as `projectsByTrade` in the mock and as Who We Are round 2 V3).
- `lib/select-scope-media.ts`: curated scope photo, else the first project tagged with the scope.
- `lib/select-trade-benefits.ts`: reads `BENEFIT_TEMPLATES` by trade name and drops lines listed in `constants/trade-benefit-exclusions.ts` (the seven lines with numbers, verbatim, each with a comment). No regex heuristics.
- `hooks/use-showcase-projects.ts`: the portfolio projects read (§5), `staleTime` long; mapped once into `projectsByScope` / `projectsByTrade` maps.
- Types in `types/index.ts`: `ShowcaseMedia`, `TradeShowcase`, `TradeBenefit`, `TradeStageState`, the split context value types; remove `TradeSheetState`, `OpenTradeOptions`.

### 4.6 Responsive

| Stage width (container) | Layout |
|---|---|
| ≥ 896px (`@4xl`) | Two columns; showcase full height, work column scrolls; 2 benefit lines; work cards 2 per row |
| < 896px | Band: showcase 42% of the stage height, title (30px) + outcome (17px) over a scrim, no benefits, proof strip top-right; work column scrolls beneath; cards 3 per row ≥ 640px, 2 below |
| Viewport < 1024px | Panel = `ResponsiveSheet` drawer, ≤ 60% height |
| Viewport < 640px | Band 36%; outcome clamps to 3 lines; cards 1 per row |

### 4.7 Motion

- Showcase image crossfade 400ms opacity on media-key change only; `MotionConfig reducedMotion="user"` already wraps the stage.
- Card and option-row pressed state: 180ms border/background (`--dur-fast`), not `transition-none` (critique finding).
- Project row expand: `AnimatedCollapsibleContent` (existing).
- No entrance animation replays on data changes (verified in §7).

### 4.8 Accessibility

- Showcase is a `region` labelled by the trade title; the image `alt` is the caption; decor `aria-hidden`.
- Switcher: `Command` supplies combobox/listbox semantics and keyboard; Esc closes the popover before the panel (Radix `defaultPrevented`, honored by `useMeetingFlowKeys`).
- Work cards and option rows: `ToggleGroup` items with `aria-pressed`; roving focus.
- Removal moves focus to the next row header (or the section heading) before the row unmounts; the Undo toast is `role="status"` and never steals focus.
- Contrast: small accent text uses a ≥ 4.5:1 token in both schemes (critique: 3.5–3.7:1 today). Touch targets ≥ 44px everywhere including step tabs.
- Panel tab buttons and rail buttons get ≥ 8px gaps.

## 5. Data access

**Reads used as-is**
- `meetingsRouter.reads.getByIdWithJoins` — `flowStateJSON.tradeSelections`, customer.
- `notionRouter.trades.getAll`, `notionRouter.scopes.getAll` — catalog.
- `projectsRouter.showroomDisplay.getAll` — **new consumer on step 2**: `project.{id, city, state, projectDuration}`, `heroImage` (media file with `pathKey`, `bucket`, `optimizationStatus`, `blurDataUrl`), `scopeIds`. Wrapped by `hooks/use-showcase-projects.ts` + the §4.5 mappers, with a `// LAZY:` header pointing at Who We Are round 2 R3/R10.

**Writes used as-is**
- `meetingsRouter.crud.update` with `flowStateJSON.tradeSelections` through the provider.

**Required changes — you run these first (none blocks Tasks 1–7)**
| # | Change | Why | Gates |
|---|---|---|---|
| DA1 | Who We Are round 2 R3 + R10 + S1 (projects read model with a `scopeIds` filter and one public projection; retire `showroomDisplay`) | The showcase should read projects the same way every surface will; S1: `showroomDisplay.getAll` returns full project rows (address, zip, customer and owner ids) to anonymous callers today | The LAZY swap task |
| DA2 | Notion scopes query cap (100 rows; `notionRouter.scopes.getAll` returns 100 today) | Some trades show fewer scopes than Notion holds; construction catalog design lists it | Correct work lists (not a build gate) |
| DA3 | Showcase content: outcome lines for the other 22 trades, benefit lines beyond 8 trades, numeric claims re-sourced or dropped | The layout can't create persuasion; 3 of 27 trades are complete today | Content only |
| DA4 | Carried from round 1 §9: lead `requestedTrades` onto the flow customer; add-ons in proposal SOW defaults; Energy Saver qualification rule | Lead-requested group in the switcher; add-on cards | Gated Tasks (lead group, add-ons) |
| DA5 | Realtime publish tagged with an origin (or no publish-before-respond) | Removes the duplicate GET per save if §4.4 step 5 can't drop the client invalidation safely | §4.4 step 5 fallback |
| DA6 | Cover images into R2 (#243/#244) | Owned media for trades with no project; the Notion covers stay unused | None |

**UI adaptations at the edge:** the mappers in §4.5 translate project rows into `ShowcaseMedia`; the benefit exclusion list stands in for catalog-owned copy (construction catalog design D4).

## 6. Error handling and edge cases

- Catalog loading/error: the step shows the existing loading/error states in both regions; selections are kept; Retry.
- Projects read loading: showcase shows the curated photo or the fallback; no spinner over the stage. Error: same fallback, silent (the step works without it).
- Trade with 0 scopes (Framing, Tile today): switcher meta "Scopes to define"; work column "No work to choose yet for {trade}."; fallback stage lists "Scopes to define".
- `?trade=` unknown: stage falls back to the first on-project trade, else the first catalog trade; the param is rewritten.
- Stored trade or scope missing from the catalog: the row shows the stored name with "Not in the current catalog"; orphan items stay removable in the row.
- Last scope unticked (canvas or panel): trade removed, Undo toast 7s; Undo restores scopes, reasons and note.
- Two removals within 7s: the newer toast replaces the older; the older removal stands.
- Note typed and the panel closed or the step changed: draft committed on unmount (unchanged); the provider flush rule from round 1 applies.
- Present mode: panel closes (unchanged); the showcase is unaffected.
- Sidebar toggled while open: container query re-lays out; no remount (verify).

## 7. Verification

Playwright (standalone, auth via `/api/dev/playwright-session`, dev meeting `2069fa85-…?step=2`, fresh CSS per the round-1 recipe), viewports 1440×900 (sidebar open and collapsed), 1280×800, 1024×768, 820×1180, 390×844; light and dark.

1. **Layout:** two columns at ≥ 896px stage width; band below; showcase never scrolls; work column scrolls; capsule clears the last card and the showcase text.
2. **No reflow:** opening the panel leaves the showcase and work column rects unchanged (±0px) at lg+.
3. **Tablet:** drawer height ≤ 60% of the viewport; the showcase band stays visible above it.
4. **Privacy:** with the panel closed, no reason label from `meetingPainTypes` and no note text exists in the canvas DOM.
5. **Render budget (§4.4):** the behavioral lines hold; 0 mounts; showcase `<img>` replaced only on media-key change; GETs per save as §4.4 states.
6. **Behavior:** tap card → selected + stage media switches to that scope's project; panel option row → selection changes, stage unchanged; untick last scope → trade leaves, Undo restores reasons and note; switcher keyboard (type, ↓, Enter, Esc); `?trade=` deep link.
7. **Type:** computed weights ≤ 600 in the step and panel; title 36px, outcome 20px (two columns).
8. **A11y:** touch targets ≥ 44px (including step tabs), small text contrast ≥ 4.5:1 in both schemes, focus lands on the next row after a removal.
9. **Rollback regression:** the round-1 provider rollback check still passes (stale merge from another step).
10. `pnpm tsc`, `pnpm lint`. Never `pnpm build`.

## 8. Files

**Create:** `steps/specialties/{showcase,showcase-media,showcase-fallback,project-proof-strip,showcase-benefits,work-column,on-project-trades,trade-switcher,work-card-group,work-card,often-together}.tsx`; `ui/components/project-section/{project-section,project-row,work-option-list,reason-picker}.tsx`; `lib/{select-trade-showcase,select-scope-media,select-trade-benefits}.ts`; `hooks/use-showcase-projects.ts`; `constants/trade-benefit-exclusions.ts`; contexts for the split (`contexts/trade-{catalog,actions,selections,stage}-context.tsx`).

**Modify:** `steps/specialties/index.tsx`; `contexts/trade-selection-provider.tsx`; `constants/{shell,shell-copy,specialties-copy,query-parsers}.ts`; `types/index.ts`; `shell/{inspector-rail,meeting-panel}.tsx`; `views/meeting-flow.tsx`; `src/shared/components/dialogs/sheets/responsive-sheet.tsx` (class split); `src/shared/components/ui/toggle-group.tsx` (memoized context value); `lib/trade-selection.ts` (remove-on-last-untick helper).

**Move:** `trade-sheet/{trade-note-field,orphan-item-chips}.tsx` → `ui/components/project-section/`.

**Delete:** `steps/specialties/{project-strip,step-intro,trade-catalog,trade-tile}.tsx`; `trade-sheet/{trade-sheet-host,trade-sheet-body,trade-sheet-header,trade-sheet-footer,trade-photo,outcome-line,pairing-card,scope-tile-group,scope-tile,reason-chip-group}.tsx`; `contexts/trade-selection-context.tsx` (replaced by the split); the unused `SPECIALTIES_COPY` keys.

**Off limits:** `src/trpc/**`, `src/shared/entities/**`, `src/shared/modules/**`, `src/shared/db/**`, `src/shared/services/**`, seeds, `docs/design-system/DESIGN.md` (foreign edits in the tree).

## 9. Out of scope and follow-ups

- **Homeowner-facing project recap** at the end of the step (critique 2 question): not in this round; Closing (step 6) covers the recap today.
- **⚠️ Stale doc:** `docs/design-system/DESIGN.md:26-27` asks for 800/900 display weight and bans 500; the app (`globals.css:525-535`) uses 600/500 and the owner rejected heavy display type. Proposed rewrite: "Syne 500/600 for display and headings; Nunito 400/600 for UI and body; hierarchy by size and color before weight." The file has uncommitted edits by another session.
- **⚠️ Stale doc:** `docs/plans/2026-09-14-construction-catalog-centralization-design.md` D5 says the specialties write path drops zero-scope trades; the shipped `normalizeForWrite` keeps server-held ones. §4.2.3 makes the UI remove emptied trades; the doc should say "emptied by the rep → removed; zero-item entries from meeting creation → kept".
- **⚠️ Stale comment:** `trade-sheet/trade-sheet-body.tsx:26` ("children take primitive props") — deleted by this spec.
- Construction catalog migration (`modules/construction`, design D6): the new mappers and contexts move with it; no new catalog helpers beyond §4.5.
- Round-1 follow-ups resolved here: 0 (untick last scope), 5 (Remove undo), 6 (photo pushes scopes below the fold), 7 (outcome line border), 8 (tile semantics), 12 (ResponsiveSheet class split), 13 (focus after pairing). Still open: 1, 2, 4, 9, 10, 11, 14–18.
- Temporary implementations, each with a `// LAZY:` header: `use-showcase-projects.ts` (→ DA1), `trade-benefit-exclusions.ts` (→ DA3 / catalog D4).
