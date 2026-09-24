# P2 — Construction Rules & Identity

> **Epic:** `docs/plans/2026-09-15-construction-data-standardization-epic.md` (the live index — update it, not this file).
> **Phase:** P2 of six. **Blocked by:** P1 (shipped 2026-09-22, `616465a7..5ed73a2b`, unpushed).
> **Owns:** C2, C5, C7 (rules half) · F9, F10, F11, F12, F17, F18 · A5, A8, A11, A12 · B5, B6 · K4 (P2 anchors).
> **Baseline:** `main` at `0029c77b`.
> **Date:** 2026-09-22.
> **Shape:** one spec, **two plans** — plan 1 is every external write (Notion, Postgres, generated file), plan 2 is pure code. See §7.
>
> **Settled by P1, not re-opened here:** `core/` unit, plural `sources/`, `service.ts` at the module root, `catalogSource` bound once, one cache tag `construction-catalog` at 600s, `constructionRouter`, `buildCatalogIndex` + `useConstructionCatalog`, `providers/notion` = three files + DOCS, no root barrel, scripts import `catalogSource` and never `service.ts`.

---

## 1. Goal

After P2 the construction module is the only place a trade or scope **rule** is defined: identity (id, slug, name), taxonomy, energy-efficient classification, the primary-trade rule, scope-vs-add-on, pairing and outcome copy, and id-to-entity resolution. Features keep presentation and choreography and import the rule (C7). Every old home of a rule is deleted in the same change that moves it (D6).

Success:

- `pnpm tsc` and `CI=1 pnpm lint` clean.
- The V2 grep gates find zero feature-local pairing, outcome, category, energy or scope-to-trade copies.
- The seam script proves the stored slug, the two Notion selects and the snapshot against production Notion.
- Eight DOCS anchors exist and are cited from code by slug.
- Both trackers amended; nothing decided in the brainstorm lives only in chat.

## 2. Decisions recorded by this spec

All taken 2026-09-22 in the P2 brainstorm. Plan 2 writes them into the tracker's §1 (see §8).

| ID | Decision |
|---|---|
| **D4 — closed** | One code registry in the module, slug-keyed. Two registers per entry, named for the surface they are written for (owner, 2026-09-22: "`landing-copy` and `presentation-copy` for now, to be explicit"; code keys are camelCase `landingCopy` / `presentationCopy`): **`landingCopy`** = the public services pages (from the live landing copy, itself written from `docs/proposal/scope-presentation.md`); **`presentationCopy`** = the in-home meeting presentation (from `docs/sales/in-home-meeting-playbook.md`). `landingCopy` is required, `presentationCopy` is optional and falls back to `landingCopy`. For outcomes both are homeowner-facing (grid card vs stage lead); for pairings the presentation copy is an **agent-only cue** shown in the panel row, never on the homeowner-facing card. Pairings are trade-level, directed, many per trade; the first entry is the meeting-flow card's pick. Paired names come from the catalog, never the registry. These names supersede design §6's `story` / `reason` and the brainstorm's interim `web` / `spoken`. |
| **D2 — spec-time detail** | `Slug` is a Notion **rich_text** property on the Trades data source. The backfill script is dry-run by default; `--apply` is owner-run. |
| **F12 mechanism** | A generated `TradeSlug` snapshot enforced by `tsc`, plus a runtime keys check for maps that have no slug to key on. **Retires at P5**, when slugs are a Postgres column and the type derives from the schema. |
| **P2 reach** | Rules move and their old homes die. UI edits are import-level, plus the memo-body swaps in §4.7-C. Picker-row internals wait for P3. |
| **Taxonomy** | `constructionTypes` is retired; `tradeCategories` is the one taxonomy, mirrored from the Notion `Type` select. One DDL on the seed-only `scopes` table. **P5 note:** the taxonomy returns to Neon as an enum mirroring `tradeCategories` when the catalog migrates. |
| **F18 / B6 shape** | Trade names for a lead are resolved in one place, `customerIntakeService.ingestLead`, from the cached catalog. The funnel page resolves its display name at the RSC. The Bina normalizer emits funnel slugs, not names. GHL free text stays raw. |
| **F9 reach** | The resolver ships in the module and every non-component site repoints. The five component sites in §4.7-C are repointed too, confined to the `useMemo` body. Sites that fall back to a *persisted* label snapshot are P4 (A9). |
| **F10** | Already delivered by P0 + P1 (`kind` set at the adapter, index splits on it, landing filters on it). P2 records it and writes `#scope-vs-addon`. |
| **D8 note** | `src/pain-points.ts` (1,313 lines, zero importers) stays until P4, which extracts anything worth keeping before deleting it. |
| **Cut** | One spec, two plans, in that order. |

## 3. Non-goals

1. Picker rows, `TradeScopeRow`, `TemplatesModal`, the three per-row `scopes.byTrade` queries, the two specialties rows — F13, F8, P3.
2. Persisted reference shapes, selection reducers, `trade-selection.ts` — P4; feature-layering D8 already defers there.
3. Owner escalations 2 and 3. P2 repoints one import in `programs.ts` and touches nothing else in that file or in `program-step.tsx`. Appendix C records the roofing mechanism as evidence.
4. A root barrel on the module.
5. Any visual change beyond the three copy changes named in §4.3.
6. `tradeLocations` and the rest of the property-profile vocabulary in `core/constants/enums.ts`.
7. `package.json`. Both new scripts and the keys check run via `npx tsx`, like the seam check.
8. B8, B10, B11 and the new B19 (§8) — P3.
9. The `constructionTypes` migration files under `src/shared/db/migrations/` — legacy snapshots, untouched.

## 4. The design

### 4.1 Module surface

Everything lands under `core/`, following `modules/proposals/core/`. Types are co-located with the constants that use them.

| Path | Holds | Req |
|---|---|---|
| `core/constants/trade-slugs.generated.ts` | `tradeSlugs` const array + `TradeSlug`. Generated by `scripts/generate-trade-slugs.ts`; header says do not edit. | F12, A11 |
| `core/constants/trade-pairings.ts` | `TradePairing { pairedSlug: TradeSlug; landingCopy: string; presentationCopy?: string }` and `TRADE_PAIRINGS: Partial<Record<TradeSlug, readonly TradePairing[]>>`. | D4, C5 |
| `core/constants/trade-outcomes.ts` | `TradeOutcome { landingCopy: string; presentationCopy?: string }` and `TRADE_OUTCOMES: Partial<Record<TradeSlug, TradeOutcome>>`. | D4, C5 |
| `core/constants/energy-efficient-categories.ts` | `ENERGY_EFFICIENT_CATEGORIES: readonly TradeCategory[] = ['Energy Efficiency']`. | F11 |
| `core/constants/enums.ts` | `constructionTypes` and `ConstructionType` deleted. Nothing else changes. | A5 |
| `core/schemas/index.ts` | `pricingUnits = ['unit', 'sqft', 'space', 'linear ft', 'bsq'] as const`, `PricingUnit`; `scopeSchema.unitOfPricing: z.enum(pricingUnits)` with **no default** — today's `.default('unit')` can mask a blank select, so plan 1 step 5 first reports scopes with a blank `Unit of Pricing` and the owner fills them in Notion before the enum lands; after that a blank row is skipped and warned, like `kind`. | A5 |
| `core/lib/build-catalog-index.ts` | `CatalogIndex` gains `scopesById: ReadonlyMap<string, Scope>`. **Delivered early** by the portfolio step plan (`b17f7ae3`, `docs/superpowers/plans/2026-09-23-portfolio-step-project-story.md` Task 5). | F9 |
| `core/lib/resolve-catalog-ids.ts` | `resolveTrades(ids, index)` and `resolveScopes(ids, index)` → `{ found: T[]; orphans: string[] }`, stored order preserved. **Delivered early** by the portfolio step plan (`b17f7ae3`, `docs/superpowers/plans/2026-09-23-portfolio-step-project-story.md` Task 5). The result type is exported as `ResolvedCatalogIds<T>`. | F9 |
| `core/lib/is-energy-efficient-trade.ts` | `isEnergyEfficientTrade(trade): boolean` — `trade.category` ∈ `ENERGY_EFFICIENT_CATEGORIES`. | F11 |
| `core/lib/pick-primary-trade.ts` | `pickPrimaryTrade(ids, index): Trade \| undefined` — first id present in the catalog, stored order. | F11 |
| `core/lib/primary-pairing.ts` | `primaryPairing(slug): TradePairing \| undefined` — `TRADE_PAIRINGS[slug]?.[0]`. | D4 |
| `core/lib/register-copy.ts` | `registerCopy(entry, register: 'landing' \| 'presentation'): string \| undefined` — the one place `presentationCopy ?? landingCopy` lives. | D4 |
| `sources/notion/trades/properties-map.ts` | `slug: { label: 'Slug', type: 'rich_text' }`; `TradePropertySource` becomes `Omit<Trade, 'coverImageUrl'> & { disabled: boolean }`. | C2 |
| `sources/notion/trades/adapter.ts` | reads `Slug`; a blank slug fails `tradeSchema` and the row is skipped with a warn. No derived fallback. | C2 |
| `sources/notion/scopes/adapter.ts` | the `selectName<'sqft' \| …>` cast at `:33` goes; the enum parse does the checking. | A5 |
| `DOCS.md` | eight anchors (§4.6); `#category-taxonomy` rewritten. | A8, K4 |

### 4.2 Identity

**`#catalog-identity`.** A trade has three names for three jobs: `id` (the normalized Notion page id) is the persisted reference; `slug` is the stable key for URLs, registries and copy maps; `name` is display only and may change in Notion at any time. Nothing keys on `name`.

**`#slug-is-stored`.** `Trade.slug` is read from the Notion `Slug` property (D2, A11 `derived-values.md#snapshot-discipline`). The adapter never derives it. A trade with a blank `Slug` is not in the catalog — it fails schema and is skipped with a warn — so the backfill dry-run is the tool that finds blanks, for new trades too.

**Backfill** (`scripts/backfill-trade-slugs.ts`, plan 1):

- Reads every row of the Trades data source through the Notion client and the data-source id the module already exports, paging with `start_cursor`, **disabled rows included**, so a trade re-enabled later never arrives slugless.
- Derives each slug from the title with `slugifyTradeName`, which **moves** to `scripts/lib/slugify-trade-name.ts` (its only remaining consumer). V2 asserts zero hits for it under `src/`.
- Asserts derived slugs are unique across all rows before writing anything.
- Dry run prints a table: id, title, disabled, derived slug, current `Slug`, action (`write` / `same` / `conflict`). `--apply` writes only the `write` rows. Idempotent.
- Writes through `pages.update` on the provider client. No new seam method: the seam is read-only.

**V3 by construction.** The stored slug equals today's derived slug for every row, so no URL changes and the sitemap is byte-identical.

**Snapshot** (`scripts/generate-trade-slugs.ts`, plan 1): reads `catalogSource.getTrades()`, writes `core/constants/trade-slugs.generated.ts` sorted, with a generated-file header. Re-run whenever a trade is added or enabled; the keys check (§5 V5) says when.

### 4.3 Registries and registers

- Both registries are `Partial<Record<TradeSlug, …>>`, so a key the catalog does not know fails `tsc`.
- `landingCopy` is required on every entry; `presentationCopy` is optional. Consumers read copy only through `registerCopy(entry, register)`.
- **Where each register renders today.** Outcomes: `landingCopy` is the three-line blurb under the trade name on the pillar pages' trade cards (`trade-card.tsx:52`); `presentationCopy` is the lead line under the trade title on the meeting stage (`showcase-text.tsx:26`), homeowner-visible in the room. Pairings: `landingCopy` is the story on the "Projects That Work Better Together" cards on both the pillar pages (featured pairs) and the trade pages (`natural-pairings.tsx`); `presentationCopy` is the agent-only cue in the panel row, "Pairs with X: …" (`project-row.tsx:100`), and the homeowner-facing often-together card deliberately omits it. `#trade-pairings` and `#trade-outcomes` state this.
- Pairings are directed: `TRADE_PAIRINGS['roof-and-gutters']` lists what to offer *with roofing*. Many per trade. `primaryPairing(slug)` is the meeting-flow card's pick.
- Paired names are resolved from the catalog (`tradesBySlug`), never stored.
- The copy itself is in **Appendix A**, verbatim with source lines. Plan 2 copies from Appendix A, never from the old files.

**Three visible copy changes, accepted in the brainstorm:**

1. Landing pairings show catalog names (`Attic & Basement`, `Roof & Gutters`, `Windows & doors`) where they showed `Insulation`, `Roofing`, `Windows`.
2. The energy pillar's featured pairs read the registry's per-trade wording instead of their own copies: windows→attic gains `you can do` at the end. One string, three words.
3. Any entry keyed on a slug that is not live is dropped (see `solar`, §9). Under §9 option (b) the energy pillar's second featured pair becomes roof→attic, with that entry's wording.

### 4.4 Rules

**`#energy-efficient-trades`.** A trade is energy-efficient iff its category is in `ENERGY_EFFICIENT_CATEGORIES`. Landing derives its pillar from this predicate (`pillarForTrade(trade)`: energy → `energy-efficient-construction`, else `luxury-renovations`); the category map dies. Live today: Attic & Basement, Dryscaping, Exterior Paint Stucco & Siding, HVAC, Roof & Gutters, Water heating, Windows & doors.

**`#primary-trade`.** The primary trade of an ordered set is the **first in stored order**. Nothing reorders, scores or prefers. `pickPrimaryTrade(ids, index)` adds one thing: it skips ids the catalog no longer has. The meeting stage's URL override is choreography layered on top in `resolve-stage-trade.ts`, not a second rule. SQL and TypeScript `sow[0]` sites cite the anchor and stay as they are.

**`#scope-vs-addon`.** `Scope.kind` is set once at the adapter from the `Scope or Addon` select. `buildCatalogIndex` splits on it. No consumer classifies. (Delivered by P0 + P1; the anchor is new.)

**`#category-taxonomy`** (rewritten). `tradeCategories` in `core/schemas/index.ts` is the one taxonomy, mirroring the Notion `Type` select verbatim (`#source-select-is-source-of-truth-for-enums`). `constructionTypes` is gone: it only ever typed the seed-only `scopes.construction_type` column, never a property profile (the P1 text saying otherwise was stale). The seam script asserts the select's option list equals the array. **P5:** the taxonomy returns to Neon as an enum mirroring `tradeCategories`.

**Pricing units.** `pricingUnits` mirrors the `Unit of Pricing` select the same way; live values today are `unit` 48, `sqft` 23, `space` 32, `linear ft` 12, `bsq` 5. Landing's `UNIT_LABELS` becomes `Record<PricingUnit, string>` and loses its string fallback, so a new option fails `tsc` there too.

### 4.5 Resolver and index

`resolveTrades` / `resolveScopes` are the only id→entity path. They return orphans instead of dropping them; callers decide what an orphan means (a warn on a landing page, a thrown config error on a funnel page, a logged skip at lead ingest). `scopesById` on the index removes every hand-built scope→trade map.

### 4.6 DOCS anchors

New: `#catalog-identity` · `#slug-is-stored` · `#scope-vs-addon` · `#energy-efficient-trades` · `#trade-pairings` · `#trade-outcomes` · `#primary-trade`. Rewritten: `#category-taxonomy`. Rule text is §4.2–4.4 above; plan 2 copies it into `DOCS.md` in the module's existing format (rule, why, enforced-by). `#stored-references` and `#catalog-read-and-cache` from A8's list are **not** P2's: the first is P4, the second is already `#one-cache-tag` + `#one-read-model`.

### 4.7 Consumers

**A. Old homes that die**

| File | Replaced by |
|---|---|
| `src/features/meeting-flow/constants/trade-pairings.ts` | `core/constants/trade-pairings.ts` + `primaryPairing` |
| `src/features/meeting-flow/constants/trade-outcomes.ts` | `core/constants/trade-outcomes.ts` + `registerCopy` |
| `src/features/meeting-flow/constants/energy-trades.ts` | `core/lib/is-energy-efficient-trade.ts` |
| `src/features/meeting-flow/types/index.ts` `TradePairing` (`:265`) | the module's exported type |
| `src/features/landing/constants/trade-pairings.ts` | `core/constants/trade-pairings.ts` |
| `src/features/landing/constants/trade-outcome-statements.ts` | `core/constants/trade-outcomes.ts` |
| `src/features/landing/constants/pillar-config.ts` `pairings` + `PillarPairing` | `featuredPairings: ReadonlyArray<readonly [TradeSlug, TradeSlug]>`; copy comes from the registry |
| `src/features/landing/lib/notion-trade-helpers.ts` `PILLAR_CATEGORY_MAP` | `src/features/landing/lib/pillar-for-trade.ts` |
| `src/shared/lib/slugify-trade-name.ts` | moves to `scripts/lib/`; the adapter never derives |
| `build-persona-profile.ts` `getTradeNameById` (`:74`) | `tradesById` passed in; maps keyed by slug |
| `business.router.ts:186-190` inline `nameById` | `ingestLead` resolution (D) |
| `core/constants/enums.ts` `constructionTypes` | `tradeCategories` |

**B. Import-level repoints**

Meeting-flow:
- `often-together.tsx:22`, `project-row.tsx:43`, `project-section.tsx:74` → `primaryPairing(trade.slug)`.
- `showcase-text.tsx:26` → `registerCopy(TRADE_OUTCOMES[trade.slug], 'presentation')`; `:27` passes `trade.slug` to `selectTradeBenefits`. `project-row.tsx:100` → `registerCopy(primaryPairing(trade.slug), 'presentation')` for the cue.
- `programs.ts:2` → module import. Nothing else in the file.
- `resolve-stage-trade.ts` keeps the URL override and the `catalog.trades[0]` fallback; the middle step becomes `pickPrimaryTrade(selectedTradeSelections(selections).map(s => s.tradeId), catalog)?.id`.
- `persona-profile-maps.ts` `byTrade` maps → `Partial<Record<TradeSlug, string>>`, same bodies. `select-trade-benefits.ts` takes a slug. `build-persona-profile.ts` input gains `tradesById: ReadonlyMap<string, Trade>`; `meeting-flow.router.ts:67` reads `constructionService.getCatalog()` and passes it. `trade-benefit-exclusions.ts` re-cites D8/P4 instead of D4.
- `trade-photos.ts`: `TRADE_PHOTOS: Partial<Record<TradeSlug, TradePhoto>>`; `SCOPE_PHOTOS` keyed by **scope id** with the scope name in a trailing comment. `select-stage-media.ts:21` and `select-scope-media.ts:8` index by `scope.id`. `index-showcase-projects.ts` and `use-showcase-projects.ts` take `scopesById` instead of rebuilding the inverse map (**Delivered early** by the portfolio step plan (`b17f7ae3`, `docs/superpowers/plans/2026-09-23-portfolio-step-project-story.md` Task 5).)

Landing:
- `trade-card.tsx:52` → `registerCopy(TRADE_OUTCOMES[trade.slug], 'landing') ?? <existing fallback sentence>`. The fallback stays: it is landing's own wording for a trade with no entry.
- `trade-view.tsx:42` and `pillar-view.tsx:32` → `resolveTradePairings(slug, index)` / `resolveFeaturedPairings(pillarSlug, index)` in `src/features/landing/lib/resolve-trade-pairings.ts`, returning `{ trade: Trade; pillarSlug: PillarSlug; landingCopy: string }[]`. A paired slug the live catalog lacks is `console.warn`ed and skipped, never silent. The index comes from the same `constructionService.getCatalog()` read the page already does; B11's double computation is P3.
- `notion-trade-helpers.ts`: delete the map, filter with `pillarForTrade`. `PillarSlug` stays where it is.
- `trade-benefits.ts`, `trade-pain-headlines.ts`, `trade-before-after.ts`, `trade-symptoms.ts` → `Partial<Record<TradeSlug, …>>` (F17). This deletes the `electricals` keys (B5): the live slugs are `electricals-finish` and `electricals-rough`.
- `scopes-grid.tsx:7-13` → `Record<PricingUnit, string>`, fallback at `:50` removed.

**C. F9 sites**

| Site | Edit |
|---|---|
| `meeting-flow/lib/build-persona-profile.ts` + `trpc/routers/meeting-flow.router.ts:67` | input gains `tradesById`; router passes it |
| `meeting-flow/lib/select-trade-benefits.ts` | keyed by slug |
| `meeting-flow/lib/index-showcase-projects.ts` + `hooks/use-showcase-projects.ts` | take `scopesById` — **Delivered early** by the portfolio step plan (`b17f7ae3`, `docs/superpowers/plans/2026-09-23-portfolio-step-project-story.md` Task 5). |
| `project-management/hooks/use-portfolio-filters.ts` + `lib/filter-projects.ts` | `FilterCriteria.scopeToTradeMap` → `scopesById: ReadonlyMap<string, Scope>` |
| `project-management/lib/group-scopes-by-trade.ts` | `resolveScopes` then group by `tradeId`; `TradeRow` output unchanged |
| `trpc/routers/customers.router/business.router.ts:186` | moves into `ingestLead` (D) |
| `funnels/ui/blocks/portfolio-block.tsx:27`, `funnels/ui/blocks/funnel-project-carousel.tsx:57` | `useConstructionCatalog()` replaces the bare `scopes.getAll` query; `index.scopesById.get(id)?.tradeId`. Memo body only, no JSX. These two stack on the visual pass that never ran — V6 covers them. |
| `project-management/ui/components/project-detail-sheet.tsx:39`, `ui/components/portfolio-project-card.tsx:23`, `ui/views/project-story-view.tsx:28` | `buildCatalogIndex` + `resolveTrades`; memo body only, no JSX |
| `meeting-flow/contexts/trade-selection-provider.tsx:132`, `project-row.tsx:45` | **P4** (A9): they fall back to a persisted label snapshot. Cite `#catalog-identity`, no change. |
| `sow-field.tsx:95` (B8), `profile-benefits.ts:24` (B10), `getTradeBySlug` (B11), `landing/ui/components/services/portfolio-proof.tsx:13` (new B19) | **P3** |

**D. Funnel and lead names (F18, B6)**

- `TradeFacts.name` and its doc comment are deleted; `TRADE_FACTS` keeps `notionTradeId` and `meta`.
- `src/shared/domains/funnels/lib/resolve-funnel-trade.ts`: `resolveFunnelTrade(slug, index): Trade` — `resolveTrades([getTradeFacts(slug).notionTradeId], index)`, throws `FunnelTradeMissingError` on an orphan. A config error, not a runtime state: V5 asserts every funnel id is live.
- `src/app/(frontend)/funnels/[trade]/page.tsx` reads `constructionService.getCatalog()`, builds the index, resolves, and passes `tradeName` to `FunnelEngine`. `FunnelContext` gains `tradeName: string`; the engine sets it from the prop. `zip-step.tsx:55` and `funnel-footer.tsx:19` read `ctx.tradeName`. `generateMetadata` is unchanged.
- `build-lead-input.ts:32` stops writing `interestedTradesRaw`.
- `customerIntakeService.ingestLead` input gains `funnelSlugs?: FunnelSlug[]` (the Bina path). It becomes the one place a lead's trade names are resolved. Funnel slugs come from two places, unioned: `leadMeta.source.funnelSlug` when `source.kind === 'funnel'` (the funnel path, already there), and `input.funnelSlugs` (Bina). Then `interestedTradesRaw = dedupe([...leadMeta.interestedTradesRaw (GHL free text, first), ...resolveTrades(requestedTrades ids).found.map(name), ...resolveTrades(funnel slugs → notionTradeId).found.map(name)])`, orphans logged with the customer's name. `createFromIntake`'s inline block at `business.router.ts:186-190` is deleted; it passes nothing new.
- `normalize-bina-lead.ts:45-52` keeps its field-presence rule but emits `funnelSlugs: FunnelSlug[]` (`kitchens`, `bathrooms`) instead of names; `NormalizedBinaLead` gains the field; `webhooks/bina/route.ts:35` passes it through. `baseTrades` stays raw. If GHL is later configured to send an explicit `funnelSlug` field, the normalizer prefers it; that is an owner config step, not P2's. Known non-compliance unchanged: this file is a translator living in a provider (tracker K1).

**E. Primary-trade cites** (comment only, no code change): `features/customer-pipelines/dal/server/get-customer-profile.ts:99`, `features/agent-dashboard/dal/server/get-action-queue.ts:126`, `features/proposal-flow/ui/components/proposal/heading.tsx:63`, `features/agent-dashboard/lib/map-proposal-row-to-card-data.ts:39`, `services/providers/zoho-sign/lib/documents/assemble-envelope.ts:251`, `services/voip/campaigns/lib/pick-primary-trade.ts` (stays: it picks from free text, not the catalog).

**F. Stays, keyed by the module's types:** `meeting-flow/constants/trade-categories.ts` `TRADE_CATEGORY_LABELS` (display copy already typed by `TradeCategory`); landing's four page-copy maps (F17); persona and benefit copy bodies; pillar copy; both photo maps (feature-local until #243/#244 per design §6).

### 4.8 Taxonomy DDL (plan 1)

Code first, then push: remove `constructionTypeEnum` from `src/shared/db/schema/meta.ts` and its import; remove `constructionType` from `src/shared/db/schema/scopes.ts`; remove the field from the 52 rows in `src/shared/db/seeds/data/scopes.ts` and the `EXCLUDED.construction_type` line in `src/shared/db/seeds/scopes.ts:39`; delete `constructionTypes` from `core/constants/enums.ts`. Then `pnpm db:push:dev` (drops the column and the `construction_type` type) and `pnpm db:seed:dev` to prove the seed. **Prod push is its own explicit go, later.** If `drizzle-kit push` will not drop the enum type after the column, the plan records the one-line `DROP TYPE` and the owner runs it.

## 5. Verification

| Gate | Proves |
|---|---|
| **V1** | `pnpm tsc` and `CI=1 pnpm lint` clean after every commit. Never `pnpm build`. |
| **V2** | Grep gates after the last commit, all zero outside `src/shared/modules/construction/`: `TRADE_PAIRINGS`, `tradePairings`, `TRADE_OUTCOMES`, `tradeOutcomeStatements` (definitions), `PILLAR_CATEGORY_MAP`, `isEnergyEfficientTrade` definitions, `slugifyTradeName` under `src/`, `constructionTypes` / `ConstructionType` / `construction_type` under `src/` and `scripts/` (migrations folder excluded), `getTradeFacts(…).name`, the literals `'Kitchen Renovation'` and `'Bathroom Renovation'`, and `scopeToTrade` / `new Map(scopes.map` / `new Map(allScopes` anywhere. |
| **V3** | Sitemap byte-identical before and after the adapter reads the stored slug. The backfill dry-run table shows `same` or `write` with derived == stored for every row and zero `conflict`. |
| **V4** | `scripts/verify-catalog-seam.ts` extended: every trade has a non-empty slug; slugs are unique; the Trades `Type` select option list equals `tradeCategories`; the Scopes `Unit of Pricing` option list equals `pricingUnits` (via `dataSources.retrieve`). |
| **V5** | New `scripts/verify-catalog-keys.ts` (reads `catalogSource`): snapshot ⊆ live, warn on live − snapshot; every `SCOPE_PHOTOS` key is a live scope id; every `TRADE_FACTS[*].notionTradeId` is a live trade id; every `featuredPairings` pair has a registry entry. |
| **V6** | Browser, on dev: a funnel page shows the catalog name in the zip step and footer; one test submission's lead row carries the live Notion name in `interestedTradesRaw`; a landing trade page and both pillar pages render pairings with catalog names; the specialties often-together card and showcase outcome render; the funnel portfolio block and project carousel render (the pass that never ran after P1). |
| **Cache proof** | unchanged from P1. |

## 6. Files

> `core/lib/resolve-catalog-ids.ts` (created), `scopesById` in `core/lib/build-catalog-index.ts`, and the meeting-flow `index-showcase-projects.ts` / `use-showcase-projects.ts` edits below are already done — **Delivered early** by the portfolio step plan (`b17f7ae3`, `docs/superpowers/plans/2026-09-23-portfolio-step-project-story.md` Task 5).

**Created**
- Module: `core/constants/{trade-slugs.generated,trade-pairings,trade-outcomes,energy-efficient-categories}.ts`; `core/lib/{resolve-catalog-ids,is-energy-efficient-trade,pick-primary-trade,primary-pairing,register-copy}.ts`.
- Scripts: `scripts/backfill-trade-slugs.ts`, `scripts/generate-trade-slugs.ts`, `scripts/verify-catalog-keys.ts`, `scripts/lib/slugify-trade-name.ts` (moved).
- Features: `src/features/landing/lib/pillar-for-trade.ts`, `src/features/landing/lib/resolve-trade-pairings.ts`, `src/shared/domains/funnels/lib/resolve-funnel-trade.ts`.

**Edited** — module: `core/constants/enums.ts`, `core/schemas/index.ts`, `core/lib/build-catalog-index.ts`, `sources/notion/trades/{adapter,properties-map}.ts`, `sources/notion/scopes/adapter.ts`, `DOCS.md`. DB: `schema/{scopes,meta}.ts`, `seeds/data/scopes.ts`, `seeds/scopes.ts`. Scripts: `verify-catalog-seam.ts`. Meeting-flow: `constants/{programs,persona-profile-maps,trade-photos,trade-benefit-exclusions}.ts`, `lib/{select-trade-benefits,build-persona-profile,index-showcase-projects,select-stage-media,select-scope-media,resolve-stage-trade}.ts`, `hooks/use-showcase-projects.ts`, `types/index.ts`, `ui/components/steps/specialties/{often-together,showcase-text}.tsx`, `ui/components/project-section/{project-row,project-section}.tsx`; `src/trpc/routers/meeting-flow.router.ts`. Landing: `lib/notion-trade-helpers.ts`, `constants/{pillar-config,trade-benefits,trade-pain-headlines,trade-before-after,trade-symptoms}.ts`, `ui/views/{trade-view,pillar-view}.tsx`, `ui/components/services/{trade-card,scopes-grid}.tsx`. Funnels: `constants/trade-facts.ts`, `types.ts`, `ui/funnel-engine.tsx`, `ui/steps/zip-step.tsx`, `ui/footer/funnel-footer.tsx`, `lib/build-lead-input.ts`, `ui/blocks/{portfolio-block,funnel-project-carousel}.tsx`; `src/app/(frontend)/funnels/[trade]/page.tsx`. Ingest: `src/shared/services/customer-intake.service.ts`, `src/trpc/routers/customers.router/business.router.ts`, `src/shared/services/providers/gohighlevel/lib/normalize-bina-lead.ts`, `src/app/api/webhooks/bina/route.ts`. Project-management: `hooks/use-portfolio-filters.ts`, `lib/{filter-projects,group-scopes-by-trade}.ts`, `ui/components/{project-detail-sheet,portfolio-project-card}.tsx`, `ui/views/project-story-view.tsx`. Cites only: the six files in §4.7-E.

**Deleted**: `src/features/meeting-flow/constants/{trade-pairings,trade-outcomes,energy-trades}.ts`, `src/features/landing/constants/{trade-pairings,trade-outcome-statements}.ts`, `src/shared/lib/slugify-trade-name.ts`.

**Docs**: `docs/plans/2026-09-15-construction-data-standardization-epic.md`, `docs/plans/2026-09-20-feature-layering-epic.md`, `src/shared/modules/construction/DOCS.md`, memory `project-construction-catalog-centralization`. The 2026-09-14 design doc is **not** edited: it carries another session's uncommitted hunks and staging by path would sweep them in. The tracker carries everything.

## 7. The two plans

**Plan 1 — external writes.** Every task ends at a gate the owner runs.

| # | Task | Gate |
|---|---|---|
| 1 | `Slug` rich_text property created on the Trades data source | **owner, Notion UI** |
| 2 | Backfill script; dry-run table reviewed | **owner runs `--apply`** |
| 3 | Adapter requires the slug; property map + `TradePropertySource`; `slugifyTradeName` moved to `scripts/lib/`; seam script slug asserts | V3, V4 |
| 4 | Snapshot generator + `trade-slugs.generated.ts` | V5 (snapshot ⊆ live) |
| 5 | `pricingUnits` enum; scopes adapter cast removed; seam script select-option asserts | V4 |
| 6 | Taxonomy DDL (§4.8) | **owner runs `db:push:dev` + `db:seed:dev`**; prod = separate go |

**Plan 2 — pure code.** Starts after plan 1 step 4 (every registry is typed by the snapshot). Step 6 may trail.

1. Module registries (from Appendix A), constants, lib functions. `scopesById` and `core/lib/resolve-catalog-ids.ts` already exist — **Delivered early** by the portfolio step plan (`b17f7ae3`, `docs/superpowers/plans/2026-09-23-portfolio-step-project-story.md` Task 5). Build on them; do not rebuild.
2. DOCS anchors.
3. Meeting-flow repoints and deletions.
4. Landing repoints and deletions.
5. F9 sites (§4.7-C).
6. Funnel and ingest resolution (§4.7-D).
7. Primary-trade cites.
8. `scripts/verify-catalog-keys.ts`.
9. Tracker, feature-layering and memory amendments (§8).
10. V2 grep gates; V6 browser pass.

Checkpoints at execution follow the owner's format: a markdown table of clickable relative file links with a few-word change column, no diffs. Every edit stays inside this spec's file list; anything else — `package.json`, configs, barrels, shared files — is a question first.

## 8. Tracker amendments

**Landed with this spec's commit** (`docs/plans/2026-09-15-construction-data-standardization-epic.md`): §0 P2 row → spec link, "two plans"; §1 → D4 closed + the eight remaining rows in §2 of this spec as **D-f…D-m**; §2 → D4 row removed, D8 gains the extract-then-delete note; §3 → F10 `[x]` (delivered P0+P1, anchor P2), F9 note (tenth site at `business.router.ts:186`; snapshot-fallback sites → P4), A5 note (`pricingUnits`); §4 → **B19** landing `portfolio-proof.tsx:13` substring project matcher, P3; **B20** landing keys `solar`, which is not in the live catalog — links 404 today, P2 (owner call in §9); §6 K4 anchor list → the eight above, `#stored-references` P4, `#catalog-read-and-cache` = existing anchors; escalation 2 → pointer to Appendix C.

`docs/plans/2026-09-20-feature-layering-epic.md`: F14 → its `isEnergyEfficientTrade` item delivered by construction P2 (the rest stays); B4, B5 → delivered by construction P2 (F18 / F12), link to this spec; D7 → partial, `TradePairing` leaves `types/index.ts` at P2.

**Landed when plan 2 ships:** §0 P2 status; §3 ticks; §5 "Enums" pointer (no more `constructionTypes` drift) and the duplication list; K4 `[x]`; K9; memory.

## 9. Open items for the owner

1. **`solar`.** Not in the live catalog (the one dropped row is almost certainly the disabled Solar trade; the backfill dry-run, which lists disabled rows, will confirm). Today landing keys pairings, an outcome and the energy pillar's featured roof↔solar pair on it, and the trade page links to a 404. Options: **(a)** re-enable Solar in Notion, regenerate the snapshot, keep the copy; **(b)** keep Solar disabled, drop every `solar` entry (kept in Appendix A for later), and the energy pillar features roof↔attic instead of roof↔solar. The spec assumes **(b)** until told otherwise.
2. **Bina funnel slug.** The spec has the normalizer derive it from field presence. If GHL should send an explicit field, say so; the plan adds it as a config step and the normalizer prefers it.
3. **Escalation 2** — Appendix C is now evidence, not inference. Your call remains yours.
4. Still surfaced, still yours: `docs/codebase-conventions/enum-standardization.md:11` names the deleted `src/shared/domains/construction/constants/enums.ts` inside another session's uncommitted paragraph; escalation 3 (`program-step.tsx` loading gate).

---

## Appendix A — Registry copy (D4, verbatim)

Sources: **playbook** = `docs/sales/in-home-meeting-playbook.md` (`:180-189` outcomes, `:191-196` pairings). **landing** = the shipped landing constants, which were written from `docs/proposal/scope-presentation.md:34-52` (outcomes) and `:56-69` (pairings); where landing and the doc differ by a word, landing wins because it is the landing-copy register as shipped. **meeting** = the shipped meeting-flow constants, which were written from the playbook.

### A.1 `TRADE_OUTCOMES`

| slug | `landingCopy` (landing `trade-outcome-statements.ts`) | `presentationCopy` (playbook / meeting `trade-outcomes.ts`) |
|---|---|---|
| `hvac` | Your system will use roughly half the energy of your current unit — and you'll be able to control it from your phone. | Your system will be efficient enough that most customers cut their cooling bill nearly in half. |
| `roof-and-gutters` | Your home will be fully protected from weather damage for the next 30 years — no more worrying about the next storm. | Your home will be fully protected from weather damage for the next 30 years, and the cool-roof system will reduce attic heat by up to 30%. |
| `windows-and-doors` | No more drafts, no more noise from outside, and your home stays at a consistent temperature without your HVAC working overtime. | No more drafts, no more noise from outside, and your home will hold temperature much more consistently. |
| `attic-and-basement` | You'll notice the comfort difference almost immediately — and most customers see their heating and cooling bills drop by 20–40%. | You'll notice the difference in comfort within the first month, and most customers see their energy bill drop by 20-40%. |
| `bathroom-remodel` | A bathroom you'll love using every day — like moving into a new house, without moving. | You'll have a completely updated bathroom that feels brand new — and it adds significantly to your home's resale value. |
| `exterior-paint-stucco-and-siding` | A refreshed exterior that protects your home from the elements and dramatically improves curb appeal. | — |
| `water-heating` | Endless hot water on demand, with a unit that takes up a fraction of the space and uses significantly less energy. | — |
| `dryscaping` | A beautiful, low-maintenance landscape that conserves water and enhances your outdoor living space. | — |
| `kitchen-remodel` | A completely updated kitchen — dramatically improved functionality and the highest ROI of any home improvement. | — |
| `flooring` | Updated aesthetics throughout your home with improved durability and ease of maintenance. | — |
| `addition` | More space for your family without the cost and disruption of moving to a new home. | — |
| `exterior-upgrades-and-lot-layout` | Expanded outdoor living space that increases your home value and daily enjoyment. | — |
| `interior-upgrades-and-home-layout` | A modernized interior that transforms how your home looks and feels. | — |
| `patch-and-interior-paint` | A refreshed, modernized appearance — high perceived value for relatively low investment. | — |
| `tile` | Beautiful, durable tile work that elevates any space in your home. | — |
| `pool-remodel` | A restored pool that becomes the centerpiece of your backyard again. | — |
| `adu` | A complete accessory dwelling unit — from permits to finished space, handled by one team. | — |
| `fencing-and-gates` | Enhanced privacy, security, and curb appeal for your property. | — |
| `garage` | A functional, well-built garage that protects your vehicles and adds usable space. | — |
| `plumbing` | Reliable plumbing that eliminates leaks, low pressure, and aging pipe concerns. | — |
| `foundation-and-crawl-space` | Your home will be structurally stable, and when you go to sell it, it will pass inspection without any issues. | — |
| `hazardous-materials` | A safe, clean home free from hidden health hazards — documented and certified. | — |
| `framing` | Solid structural framing that forms the backbone of any construction project. | — |
| `engineering-plans-and-blueprints` | Professional plans and blueprints that ensure your project is built to code from day one. | — |

**Dropped, not live:** `electricals` (landing `:22` — the live slugs are `electricals-finish` / `electricals-rough`, which have no copy; V5 warns) and `solar` (§9 option b: landingCopy "You're locking in your energy rate for 25 years while your neighbors keep paying whatever the utility charges."; presentationCopy "You're essentially locking in your energy rate for 25 years — while your neighbors keep seeing their bills go up."). **No copy yet:** `demo-and-hauling`, `electricals-finish`, `electricals-rough`.

### A.2 `TRADE_PAIRINGS` (directed; first entry = meeting card)

| from | to | `landingCopy` (landing `trade-pairings.ts`, homeowner-facing story) | `presentationCopy` (playbook / meeting, agent-only cue) |
|---|---|---|---|
| `roof-and-gutters` | `attic-and-basement` | While the attic is open, we can upgrade insulation — one crew visit, compounding energy savings. | attic is already accessible |
| `attic-and-basement` | `hvac` | Seal the envelope, upgrade the system. Your bills drop from both sides. | energy savings compound |
| `attic-and-basement` | `windows-and-doors` | Complete envelope sealing — the most cost-effective energy upgrade you can do. | — |
| `hvac` | `attic-and-basement` | Sealing the envelope and upgrading the system — your energy bills drop dramatically both ways. | energy savings compound |
| `hvac` | `windows-and-doors` | Your new system won't have to fight through drafty windows — both upgrades work together. | — |
| `windows-and-doors` | `attic-and-basement` | Complete envelope sealing — the most cost-effective energy upgrade you can do. | envelope sealing — complete comfort story |
| `windows-and-doors` | `hvac` | Your new system won't have to fight through drafty windows — both upgrades work together. | — |
| `bathroom-remodel` | `flooring` | Updating the bathroom? The transition to new flooring in the hallway is natural and seamless. | natural extension room-by-room |
| `kitchen-remodel` | `patch-and-interior-paint` | A remodeled kitchen paired with fresh paint transforms how the whole home feels. | — |
| `kitchen-remodel` | `flooring` | New kitchen floors flow naturally into the rest of your home. | — |
| `adu` | `engineering-plans-and-blueprints` | From blueprints to finished unit — one team, one process. | — |
| `flooring` | `bathroom-remodel` | As long as we're updating the bathroom, the transition to new flooring is natural and seamless. | — |

Order within a trade is the landing order, which already puts the meeting card's pick first for every trade that has a presentation-copy entry. `bathroom-remodel → flooring` is new to meeting-flow (the playbook has it, meeting-flow did not — the D4 gap the tracker noted).

**Dropped, not live (§9):** `roof-and-gutters → solar` (landingCopy "A new roof is the ideal foundation for solar — one installation sequence, better ROI.") and `solar → roof-and-gutters` (landingCopy "A new roof is the ideal foundation for solar — one install, better ROI.").

### A.3 `featuredPairings` (landing `pillar-config.ts`, presentation choice)

- `energy-efficient-construction`: `[attic-and-basement, hvac]`, `[roof-and-gutters, attic-and-basement]` (was roof↔solar, §9), `[windows-and-doors, attic-and-basement]`.
- `luxury-renovations`: `[bathroom-remodel, flooring]`, `[kitchen-remodel, patch-and-interior-paint]`, `[adu, engineering-plans-and-blueprints]`.

## Appendix B — Live catalog, 2026-09-22 (read-only, `catalogSource`)

27 trades (one disabled row dropped), 120 scopes of which 25 add-ons. Slugs: `addition`, `adu`, `attic-and-basement`, `bathroom-remodel`, `demo-and-hauling`, `dryscaping`, `electricals-finish`, `electricals-rough`, `engineering-plans-and-blueprints`, `exterior-paint-stucco-and-siding`, `exterior-upgrades-and-lot-layout`, `fencing-and-gates`, `flooring`, `foundation-and-crawl-space`, `framing`, `garage`, `hazardous-materials`, `hvac`, `interior-upgrades-and-home-layout`, `kitchen-remodel`, `patch-and-interior-paint`, `plumbing`, `pool-remodel`, `roof-and-gutters`, `tile`, `water-heating`, `windows-and-doors`. This is the expected first snapshot; the generator, not this list, is the source.

## Appendix C — Escalation 2 evidence (25C next to roofing)

- `qualifyEnergySaver` (`meeting-flow/constants/programs.ts:14-33`) qualifies when any selected trade satisfies `isEnergyEfficientTrade`, i.e. `category === 'Energy Efficiency'`.
- Live categories (Appendix B read): **Roof & Gutters, Dryscaping, Exterior Paint Stucco & Siding and Water heating all carry `Energy Efficiency`**, alongside Attic & Basement, HVAC, Windows & doors.
- `program-card.tsx:88-92` renders every incentive of a qualified program unconditionally, so the `ira-25c-credit` line (`programs.ts:110-117`, "qualifying insulation installation or window/sliding door replacement", `$1,200`) shows next to a roofing-only or dryscaping-only selection.
- Figure drift: `programs.ts` says `$1,200` in three places; `docs/programs/energy-saver-incentive.md:79` and landing `pillar-config.ts:40` say `$3,200`.
- P2 changes none of this: it repoints the predicate import only. The fix is either a per-incentive qualifier or a narrower gate, and it is the owner's.

## Appendix D — Why F9 lists what it lists

The 2026-09-22 feature-local audit found these id→label / scope→trade re-implementations outside the module: `build-persona-profile.ts:74`, `trade-selection-provider.tsx:132`, `project-row.tsx:45`, `index-showcase-projects.ts:7`, `select-trade-benefits.ts:6`, `profile-benefits.ts:24`, `notion-trade-helpers.ts:44`, `portfolio-proof.tsx:13`, `group-scopes-by-trade.ts:8`, `use-portfolio-filters.ts:38`, `filter-projects.ts:3`, `project-detail-sheet.tsx:39`, `portfolio-project-card.tsx:23`, `project-story-view.tsx:28`, `sow-field.tsx:95`, plus the two funnel blocks and `business.router.ts:186` found in the brainstorm. §4.7-C assigns each to P2, P3 or P4.
