# Construction P0 — Provider Hardening — Design

**Status:** draft for approval, 2026-09-15.
**Epic:** `docs/plans/2026-09-15-construction-data-standardization-epic.md` — phase **P0**.
**Owns:** F3, F4, F5 · B1–B4, B14–B18 · A3.
**Design rationale:** `docs/plans/2026-09-14-construction-catalog-centralization-design.md` §10 (phasing), Appendix A (bugs).
**Baseline:** `main` at `dd2ba19d`. **Evidence** gathered by a read-only research pass 2026-09-15; every line number below was verified against the working tree that day.

---

## 1. Goal

Fix the live correctness bugs in the Notion construction-data path **without moving, renaming, or restructuring anything.** P0 is the one phase that depends on nothing — not P1, not the in-flight specialties build — so it can ship immediately and independently.

Every later phase inherits this code. Fixing truncation and crash-on-one-bad-row here means P1 moves *correct* code into the module instead of carrying the bugs across a rename.

## 2. Non-goals

No `modules/construction`. No `ConstructionCatalogSource`. No `notionRouter` → `constructionRouter` rename. No caching or `baseProcedure` changes (P1 owns those — the public uncached reads stay public and uncached for now). No translator relocation. No consumer edits beyond what a changed signature forces. **`getScopesByQuery` is not deleted** — it is live behind `useGetScopes` and goes at P3.

## 3. Changes

### 3.1 Paginate every Notion read (F3, B2)

**`src/shared/services/providers/notion/dal/query-notion-database.ts`** — three call paths, zero pagination. `dataSources.query` runs at Notion's default page size of 100, which is also its maximum, and silently truncates. `getAllScopes` is the highest-volume read, feeding 8+ surfaces including the specialties step.

Add a private `queryAllPages(args)` helper in the provider that loops on `has_more` / `next_cursor` with `page_size: 100`, and route both query paths through it:
- `:47-59` the unfiltered path
- `:61-68` the filtered path

**`src/shared/services/providers/notion/lib/page-to-tiptap-json.ts`** — `page_size: 100` hardcoded at `:17` (recursive children) and `:30` (top-level), `has_more` never read. A SOW page with more than 100 top-level blocks, or a list with more than 100 children, is silently truncated. Add a `listAllBlockChildren(blockId)` helper that loops, and call it from both sites.

While in `resolveChildren` (`:9-25`): the recursive `Promise.all` fan-out has no concurrency cap. Leave the structure alone — note it, do not restructure in P0.

**Also fixed here, same file** (all three are one-line changes in code being touched anyway):
- **B14** `:40-46` — `pages.retrieve` is cast to `PageObjectResponse[]` unchecked, but can return a `PartialPageObjectResponse`. Guard with an `'properties' in page` check and return `[]` when it is partial.
- **B15** `:61-68` — the filtered path silently drops `sorts`, though `propertyToSortBy` is computed at `:38`. Pass `sorts` on this path too.
- **B16** `:75` — `throw new Error('ERROR QUERYING FOR DATA!')` discards the cause. Throw with `{ cause: e }` and a message naming the data source.

### 3.2 Adapters return `Entity | null`, never throw (F4, B3, B17)

`pageToTrade` (`lib/trades/adapter.ts`) is already the compliant reference implementation: disabled gate first, `safeParse`, `console.warn` + `return null` on failure, `try/catch` around extraction. `providers/notion/DOCS.md:9-15` states the rule and `:15` already admits the other three still throw.

Bring the other three to the same shape:

| File | Today | After |
|---|---|---|
| `lib/scopes/adapter.ts:21,39` | `pageToScope(page): ScopeOrAddon`, `throw new Error(valid.error.message)` | `pageToScope(page): ScopeOrAddon \| null`, `console.warn` + `return null`, wrapped in `try/catch` |
| `lib/sows/adapter.ts:7,21` | `pageToSOW(page): SOW`, throws | `pageToSOW(page): SOW \| null`, same treatment |
| `lib/pain-points/adapter.ts:7,31` | `pageToPainPoint(page): NotionPainPoint`, throws | `pageToPainPoint(page): NotionPainPoint \| null`, same treatment |

**B17 is fixed by the same change.** `scopes/adapter.ts:30` reads `relationIds(...)[0]`, which is `undefined` for a scope with no trade relation, while `scopeOrAddonSchema.relatedTrade` is a required `z.string()` — so such a row throws today. Once `safeParse` failure returns `null`, that row is skipped and logged instead.

**Extractors keep throwing.** `lib/extractors.ts:6-11` `must()` and the typed extractors throw by design; `DOCS.md:41-49` (`#extractors-throw-by-design-adapters-recover`) says recovery belongs in the adapter. Do **not** add defaults there — the adapter's new `try/catch` is the recovery point.

**Callers switch `.map` → `.flatMap`** (the pattern `construction-data.service.ts:20-23,35-38` already uses for trades):
- `construction-data.service.ts:43, 52, 60` (`getAllScopes`, `getScopesByQuery`, `getScopesByTrade`)
- `construction-data.service.ts:68` (`getSOWsByScope`)
- `src/features/meeting-flow/lib/get-cached-pain-points.ts:8`

**Note (B18), no change in P0:** `disabled` exists **only** on trades — `lib/trades/properties-map.ts:21-24` and `lib/trades/schema.ts:11`. Scopes, SOWs and pain points have no such property or schema field, so F4's "drop disabled rows at extraction" is already satisfied for them vacuously. The redundant client-side re-filter at `use-trade-catalog.ts:16` (the anti-pattern `DOCS.md:72` names) is dead-but-harmless; it goes at P1 with the hook move.

### 3.3 Normalize Notion ids (F5)

There is no normalize helper anywhere in the repo. Notion returns dashed lowercase UUIDs, and every comparison is raw string equality or a `Map` key — so a dashed/undashed mismatch produces a silent empty result rather than an error. One undashed id is already checked in: `app/(frontend)/(site)/tests/[label]/page.tsx:17`.

Add **`lib/normalize-notion-id.ts`** in the provider: strip dashes, lowercase, re-insert dashes in 8-4-4-4-12 positions; return the input unchanged if it is not 32 hex characters.

Apply it:
- In all four adapters, to `id` and to every relation id (`relatedTrade`, `relatedScopes`, `relatedScope`, `trades`).
- In **`lib/property-filter.ts:22`**, the `'relation'` branch only — `{ property, relation: { contains: normalizeNotionId(query) } }`. This is where an undashed caller id silently returns nothing. **Only that branch**: `title`, `rich_text`, `select` and the rest filter on free text and must not be touched.

### 3.4 Delete dead code (B4)

Verified zero consumers:
- `lib/page-to-html.ts` — exports `pageToHTML`, nothing imports it.
- `lib/blocks-to-html.ts` — exports `blocksToHtml`, nothing imports it. (`page-to-html.ts:2` imports `blocksToHtml` from the npm package `@notion-utils/html`, not from this file, so it is orphaned even from the orphan.)
- `lib/page-to-blocks.ts` — 0 bytes.
- `dal/trades/hooks/queries/use-get-trades.ts:4-7` — the **`useGetTrades` export only**. The same file's `useGetAllTrades` (`:9-12`) is live in three places; the file stays.
- `routers/notion.router/trades.router.ts:10-17` `getTradesByQuery` + `construction-data.service.ts:26-39` — reachable only through the dead `useGetTrades`.

**Needs an owner call — `getScopesByTrade`.** `routers/notion.router/scopes.router.ts:25-29` + `construction-data.service.ts:55-61` have exactly one consumer: `app/(frontend)/(site)/tests/[label]/page.tsx:17`, a "Run Notion Test" button that `console.log`s the result using a hardcoded **undashed** trade id — so it is already broken (§3.3 explains why it returns empty). Recommendation: delete the procedure, the service function and that scratch page together. If the page is wanted, keep both and fix the id instead.

### 3.5 Fix energy-trade classification (B1)

**The live bug, confirmed:** `energy-trades.ts:3-5` tests `['insulation','hvac','windows','solar'].includes(tradeId)`, but `tradeId` is a dashed Notion page UUID (`trade-selection.ts:79` sets `tradeId: trade.id`, which is `trades/adapter.ts:38` `page.id`). The comparison is always `false`, so `qualifyEnergySaver` (`programs.ts:14-30`, wired at `:104`) **always** returns `qualified: false`. The Energy Saver+ program is permanently unqualifiable.

**The list is broken a second way.** Against the seeded Postgres accessors (`db/seeds/data/trades.ts`), `hvac` and `solar` exist, `windows` does not (it is `windowsAndDoors`), and **`insulation` is not a trade at all** — so even in its own intended id space, half the list is dead.

**Fix by category, not by a hardcoded list.** `Trade.type` is a live Notion select — `providers/notion/lib/trades/schema.ts:8`, `z.enum(['Energy Efficiency', 'General Construction', 'Structural / Rough'])` — and landing already classifies on it (`notion-trade-helpers.ts:15-18` `PILLAR_TYPE_MAP` maps `energy-efficient-construction` → `['Energy Efficiency']`). This is exactly the rule the epic's F11 lands at P2; P0 adopts it early because there is no correct hardcoded list to fall back on.

Changes:
1. `energy-trades.ts` — `isEnergyEfficientTrade(trade: Trade): boolean` returns `trade.type === 'Energy Efficiency'`.
2. `QualificationContext` (`features/meeting-flow/types/index.ts:43-47`) gains `tradesById: Map<string, Trade>`. Persisted `TradeSelection` is **not** touched — it keeps `tradeId` + `tradeName` only.
3. `qualifyEnergySaver` (`programs.ts:15`) resolves each selection through `ctx.tradesById` and filters on the resolved trade. Selections whose trade is missing from the catalog do not qualify, and are not an error.
4. `ProgramStep` (`ui/components/steps/program-step.tsx:36-41`) already builds the context in a `useMemo`; it calls `useTradeCatalog()` — which already exposes `tradesById` — and adds it to the memo and its dep array.
5. **Delete** `energyEfficientTradeAccessors` and `EnergyEfficientTrade` from `shared/constants/enums/meetings.ts:145-147`. `energy-trades.ts` is their only consumer.

The other two qualifiers (`qualifyMonthlySpecial:5`, `qualifyExistingCustomer:32`) are untouched; adding a context field is additive.

### 3.6 Update the provider DOCS (A3, V7)

`src/shared/services/providers/notion/DOCS.md`:
- `:15` — drop "Other entity adapters (`pageToScope`, `pageToSOW`, `pageToPainPoint`) still throw"; all four now return `Entity | null`.
- `:78` — the generic query layer description is accurate but silent about pagination, and the doc never mentions a row cap. State that reads paginate and that there is no 100-row limit.
- Add a note that ids are normalized to dashed lowercase at the adapter, and that relation filters normalize their input.
- `:72` keep the "filtering disabled rows outside the adapter" anti-pattern entry; add that `disabled` exists only on trades.

## 4. Verification

No unit test runner exists (`package.json` has no `test` script; no vitest/jest). The repo's two established patterns are `scripts/verify-*.ts` (pure logic, `node:assert/strict`, no env — e.g. `scripts/verify-is-long-sow.ts`) and `scripts/tmp-*.ts` (DB/IO, `import './lib/load-env'` as the first line).

- **V1** `pnpm tsc` + `pnpm lint` clean. Never `pnpm build`.
- **P0-V1** `scripts/verify-normalize-notion-id.ts` — dashed in, undashed in, already-dashed idempotence, uppercase, and a non-UUID passthrough. Pure, `node:assert/strict`.
- **P0-V2** `scripts/verify-notion-adapters.ts` — feed each of the four adapters a valid page fixture, a missing-required-property page, and (for scopes) a page with no trade relation. Assert an entity, `null`, `null` — and that nothing throws.
- **P0-V3 (F3/V5)** `scripts/tmp-verify-notion-pagination.ts` — a live count against the real scopes data source, asserting the paginated read returns the full row count rather than stopping at 100. Needs `NOTION_API_KEY`, so it loads env; delete after the run.
- **P0-V4 (B1/V4)** Energy Saver qualifies in the browser: open a meeting, pick a trade whose Notion `type` is `Energy Efficiency`, go to the program step, confirm the program shows qualified — and that a non-energy-only selection still shows the "Requires at least 1 energy-efficient trade" reason.
- **P0-V5** Grep gates: zero remaining `throw` in the four adapters; zero `energyEfficientTradeAccessors`; zero imports of the deleted files.
- **Smoke** the surfaces that consume `scopes.getAll` after the adapter change — meeting-flow specialties, proposal SOW field, portfolio filtering — to confirm nothing regressed on the `.map` → `.flatMap` switch.

## 5. Files

**Modified**
- `src/shared/services/providers/notion/dal/query-notion-database.ts` — pagination, B14, B15, B16
- `src/shared/services/providers/notion/lib/page-to-tiptap-json.ts` — block pagination
- `src/shared/services/providers/notion/lib/property-filter.ts` — normalize the relation branch
- `src/shared/services/providers/notion/lib/{scopes,sows,pain-points}/adapter.ts` — return `| null`
- `src/shared/services/providers/notion/lib/trades/adapter.ts` — id normalization only
- `src/shared/services/providers/notion/dal/trades/hooks/queries/use-get-trades.ts` — drop the `useGetTrades` export
- `src/shared/services/providers/notion/DOCS.md`
- `src/shared/services/construction-data.service.ts` — `.flatMap`; delete `getTradesByQuery` (+ `getScopesByTrade`, pending §3.4)
- `src/features/meeting-flow/lib/get-cached-pain-points.ts` — `.flatMap`
- `src/features/meeting-flow/constants/energy-trades.ts` — classify by category
- `src/features/meeting-flow/constants/programs.ts` — resolve through `tradesById`
- `src/features/meeting-flow/types/index.ts` — `QualificationContext.tradesById`
- `src/features/meeting-flow/ui/components/steps/program-step.tsx` — pass `tradesById`
- `src/shared/constants/enums/meetings.ts` — delete the energy accessors
- `src/trpc/routers/notion.router/trades.router.ts` — delete `getTradesByQuery`
- `src/trpc/routers/notion.router/scopes.router.ts` — delete `getScopesByTrade` (pending §3.4)

**Added**
- `src/shared/services/providers/notion/lib/normalize-notion-id.ts`
- `scripts/verify-normalize-notion-id.ts`, `scripts/verify-notion-adapters.ts`

**Deleted**
- `src/shared/services/providers/notion/lib/{page-to-html,blocks-to-html,page-to-blocks}.ts`
- `src/app/(frontend)/(site)/tests/[label]/page.tsx` (pending §3.4)

**Off limits** — foreign edits live in the tree: `src/features/meeting-flow/ui/components/steps/specialties/**` and `trade-sheet/**` (the specialties build), `src/shared/modules/**`, `docs/design-system/**`.

## 6. Out of scope and follow-ups

- **Concurrency cap** on `resolveChildren`'s recursive `Promise.all` fan-out (`page-to-tiptap-json.ts:9-25`) — noted, not restructured in P0.
- **`constructionTypes`** (`domains/construction/constants/enums.ts:4`) is a *third* taxonomy — `['energy-efficient','rough-construction','finish-construction']` — agreeing with neither the Notion select nor `PILLAR_TYPE_MAP`. P2 (F11) consolidates; P0 only stops the energy bug.
- **Public uncached reads** stay as they are until P1 (F6).
- **`getScopesByQuery` / `useGetScopes`** per-row picker queries go at P3 (F13).
- **`use-trade-catalog.ts:16`** redundant `disabled` filter — removed at P1 with the hook move.
