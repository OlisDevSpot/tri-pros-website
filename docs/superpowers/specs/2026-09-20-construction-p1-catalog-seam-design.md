# P1 — Construction Catalog Seam & Read Model

> **Epic:** `docs/plans/2026-09-15-construction-data-standardization-epic.md` (the live index — update it, not this file).
> **Phase:** P1 of six. **Blocked by:** P0 (shipped 2026-09-20, `12cd3ab3..7aadc735`).
> **Owns:** C1, C6 · F1, F2, F6, F7, F8, F16 · A1, A2, A3, A4, A7 · B18 · K3, K4.
> **Baseline:** `main` at `7aadc735`.
> **Date:** 2026-09-20.
>
> **⚠️ The implementation plan supersedes this spec on five points.**
> `docs/superpowers/plans/2026-09-20-construction-p1-catalog-seam.md` is the
> operative document — build from it, not from this file. Where they differ:
>
> | This spec says | The plan does | Why |
> |---|---|---|
> | flat `modules/construction/*` | a **`core/` unit** | `service-architecture.md#modules` — a module owns units |
> | `source/` (singular) | **`sources/`** | `provider-boundaries.md` names `sources/notion/` in two ratified places |
> | `construction.service.ts` | **`service.ts`** | all seven module services in the repo are `service.ts` |
> | delete `portfolio-scraper/fetch-scopes.ts` | **reduce** it — see §5 | it also owns `fuzzyMatchScopes`; deleting breaks `pnpm scrape-project` |
> | (silent) | module owns `tradeCategories`; the duplicate in `trade-categories.ts` is deleted | owner directive, 2026-09-20 |

---

## 1. Goal

Trades, scopes/add-ons, SOW templates and pain points get one home —
`src/shared/modules/construction/` — behind one `ConstructionCatalogSource`
interface with exactly one binding. After P1:

- No code above the seam knows Notion exists. `providers/notion/` is a
  three-file leaf.
- One server cache covers every catalog read. No public request reaches Notion.
- `constructionRouter` replaces `notionRouter`; no tRPC input carries a Notion
  property name.
- One client hook and one index builder replace the per-feature catalog reads.

Swapping to Postgres at P5 becomes a one-line change to `source/index.ts`.

## 2. Non-goals

P1 does **not** do these. Each is named here so an implementer does not drift
into it.

1. **Collapse the duplicated consumers.** Nine `groupScopesByTrade`-shaped
   call sites, three picker rows, the per-trade-row scope query pattern —
   all P3, after the specialties build lands (C4).
2. **Consolidate the three scope-vs-add-on classifiers.** P1 sets `kind` at
   the translator; F10 reconciles the feature-side classifiers at P2.
3. **Touch the taxonomy.** `Trade.category` keeps the live Notion values
   verbatim. Reconciling them with `constructionTypes` is P2's problem — see §3.7.
4. **Stored slug.** `slugifyTradeName` keeps deriving the slug from the name.
   D2's Notion `Slug` property, the backfill and the required-slug adapter are P2.
5. **`TRADE_FACTS`.** Its hardcoded trade names stay wrong until P2 (B6, F18).
6. **Persisted reference types.** No `CatalogRef` / `ScopeRef` — see §3.2.
7. **Behaviour or copy changes.** Two P0 escalations stay open and stay the
   owner's: the IRA 25C claims-accuracy question in `programs.ts`, and
   `program-step.tsx`'s missing loading gate. P1 repoints `program-step.tsx`'s
   import and changes nothing else about it.
8. **A visual change to any surface.** Every UI edit in P1 is an import path,
   a field name, or a hook name.

## 3. The design

### 3.1 Placement

```
src/shared/services/providers/notion/        3 files — a true leaf
  client.ts                                  Notion SDK, lazily constructed
  types.ts                                   NotionColumnType · NotionPropDef
                                             RawPropertyMap · PropertyFilter
  lib/config.ts                              env fragment

src/shared/modules/construction/
  DOCS.md
  schemas/index.ts                           Trade · Scope · SowTemplate · PainPoint
  constants/enums.ts                         moved from domains/construction/
  lib/build-catalog-index.ts                 buildCatalogIndex(trades, scopes)
  hooks/use-construction-catalog.ts
  construction.service.ts                    cached reads + composition
  source/
    types.ts                                 ConstructionCatalogSource
    index.ts                                 the ONE binding
    notion/
      databases.ts  query.ts  property-filter.ts  extractors.ts
      normalize-id.ts  blocks-to-tiptap.ts  page-to-tiptap.ts
      trades/{adapter,properties-map}.ts
      scopes/{adapter,properties-map}.ts
      sows/{adapter,properties-map}.ts
      pain-points/{adapter,properties-map}.ts
      index.ts                               notionCatalogSource
```

Everything in `providers/notion/{constants,dal,lib/*}` except `lib/config.ts`
moves into `source/notion/`. `src/shared/domains/construction/` is deleted.

Three files shed a now-redundant prefix as they move, since the directory
already says Notion: `normalize-notion-id.ts` → `normalize-id.ts`,
`blocks-to-tiptap-json.ts` → `blocks-to-tiptap.ts`, `page-to-tiptap-json.ts` →
`page-to-tiptap.ts`. `query-notion-database.ts` → `query.ts` for the same
reason. No other file is renamed.

**Why `lib/config.ts` stays in the provider.** `provider-boundaries.md`
`#provider-lib-is-provider-internal` names it the one sanctioned outward
dependency, and all ten providers follow that shape via
`shared/config/server-env.ts`. The epic's C6 says the provider keeps
"`client.ts` + `types.ts`"; that wording is incomplete and §6 amends it.

**Why `source/` is singular.** A non-defensive migration never runs two
bindings at once ([[feedback-non-defensive-migrations]], D6). At P5,
`source/notion/` is replaced by `source/postgres/` in the same change that
repoints `source/index.ts` — the two never coexist.

**Why the Notion source is in the module, not the provider.** D3 and the
translator-home spec (`2026-08-20-provider-boundary-translator-home-design.md`
§2): domain translation never lives in a provider's `lib/`. The provider keeps
only what is true of Notion-the-product; everything that knows what a *trade*
is belongs to the module.

### 3.2 Neutral schemas

`modules/construction/schemas/index.ts` holds one Zod schema per entity. These
replace the Notion schemas entirely — there is no second parse step and no
Notion-shaped intermediate type. Each adapter builds the neutral shape directly
and validates it with the neutral schema.

| Notion today | Neutral | Note |
|---|---|---|
| `Trade.type` | `Trade.category` | values unchanged at P1 |
| `Trade.relatedScopes` | `Trade.scopeIds` | |
| `Trade.homeOrLot` | **deleted** | written by `trades/adapter.ts:43`, read by nothing |
| `Trade.disabled` | **deleted** | see below |
| `ScopeOrAddon` | `Scope` | |
| `ScopeOrAddon.entryType: string` | `Scope.kind: 'scope' \| 'addon'` | translator maps `'Addon'` → `'addon'`, everything else → `'scope'` |
| `ScopeOrAddon.relatedTrade` | `Scope.tradeId` | 21 call sites |
| `ScopeOrAddon.relatedScopesOfWork?` | `Scope.sowIds` | drops a redundant `.default([]).optional()` |
| `SOW` | `SowTemplate` | resolves the name clash with `modules/proposals`' `SOW` |
| `SOW.relatedScope` | `SowTemplate.scopeIds` | |
| `NotionPainPoint` | `PainPoint` | already neutral (it imports `constants/enums/pain-points`) — rename and move |

`Scope.unitOfPricing` keeps its name: it is domain vocabulary, not a Notion-ism,
and F1's ban lists only `entryType`, `relatedTrade`, `homeOrLot` and `type`.

**Deleting `Trade.disabled` (B18).** P0 made `pageToTrade` return `null` for a
disabled row (`trades/adapter.ts:32`) and then set `disabled: false`
unconditionally at `:46`. The field is therefore `false` on every trade the
catalog can produce, and `use-trade-catalog.ts:16`'s
`.filter(trade => !trade.disabled)` can never remove anything. The domain type
drops the field; the filter goes with it. The Notion source still reads the
checkbox — that is an extraction-time gate, not a domain property.

Because of that, `TRADE_PROPERTIES_MAP` needs a key the domain type does not
have. Type it explicitly as a source-only property rather than widening the
domain type:

```ts
type TradePropertySource = Omit<Trade, 'slug' | 'coverImageUrl'> & { disabled: boolean }
```

**Not created: `CatalogRef` and `ScopeRef`.** F1 lists them. They have zero
call sites today, and they exist to describe *persisted* references — which is
P4's subject (F14, A9). Creating them at P1 would be a speculative type with
no consumer.

### 3.3 The seam

Mirrors `src/shared/services/voip/dialer/{types,index}.ts`, the one seam in the
codebase with a proven binding swap behind it.

```ts
// modules/construction/source/types.ts
export interface ConstructionCatalogSource {
  getTrades: () => Promise<Trade[]>
  getScopes: () => Promise<Scope[]>
  getSowTemplatesByScope: (scopeId: string) => Promise<SowTemplate[]>
  getSowContent: (sowId: string) => Promise<string>
  getPainPoints: () => Promise<PainPoint[]>
}

// modules/construction/source/index.ts — the SINGLE binding
export const catalogSource: ConstructionCatalogSource = notionCatalogSource
export * from './types'
```

The source exposes fine-grained methods and **no** `getCatalog()`. Composition
and caching belong to the service (§3.4). This answers the tracker's open
spec-time question ("whether `getCatalog` splits trades/scopes") and keeps the
P5 Postgres binding a direct method-for-method implementation rather than a
re-derivation of a composite shape.

`source/notion/index.ts` is the only file that assembles the implementation;
nothing outside `source/` imports `source/notion/*`.

### 3.4 Service and cache

`modules/construction/construction.service.ts` replaces
`src/shared/services/construction-data.service.ts`.

```ts
export const CONSTRUCTION_CATALOG_TAG = 'construction-catalog'
const REVALIDATE_SECONDS = 600
```

Four cached reads, all on that one tag:

| Function | Returns | Why separate |
|---|---|---|
| `getCatalog()` | `{ trades, scopes }` | one `Promise.all`; the read every catalog surface needs |
| `getPainPoints()` | `PainPoint[]` | only meeting-flow reads them — keeping them out of `getCatalog` stops a landing render fetching them |
| `getSowTemplatesByScope(scopeId)` | `SowTemplate[]` | cached per scope id |
| `getSowContent(sowId)` | `string` | cached per SOW id; TipTap JSON, large |

One tag means one `revalidateTag(CONSTRUCTION_CATALOG_TAG)` clears everything,
so the existing refresh button keeps its single-click behaviour.

This deletes both current `unstable_cache` sites:
`features/landing/lib/notion-trade-helpers.ts:20-34` (180s, tags
`notion-trades` / `notion-scopes`) and
`features/meeting-flow/lib/get-cached-pain-points.ts` (600s, tag
`notion-pain-points`). The uniform 600s TTL is a deliberate change from
landing's 180s: catalog edits are manual and followed by the refresh button, so
a longer TTL costs nothing and removes a second number to reason about.

**F6's real target.** Today `notionRouter.trades.getAll` and
`scopes.getAll` are public `baseProcedure`s with no server cache, and
`shared/domains/funnels/ui/blocks/{portfolio-block,funnel-project-carousel}.tsx`
call them on public funnel pages. Every visitor triggers a live Notion request,
and P0 made that two serial requests. Routing the router through the cached
service closes this — it is the fix for the first P0 escalation.

**Scripts do not call the service.** `unstable_cache` requires a Next request
context. Scripts import `catalogSource` from `modules/construction/source`
directly. That is how `scripts/portfolio-scraper/fetch-scopes.ts` loses its
second `new Client({ auth: notionApiKey })` without gaining a Next dependency
(F16).

### 3.5 Router

`src/trpc/routers/notion.router/` becomes `src/trpc/routers/construction.router/`,
registered in `app.ts` as `constructionRouter`. Vendor names leave the API
surface (A4).

| Today | P1 |
|---|---|
| `notionRouter.trades.getAll` | `constructionRouter.trades.getAll` |
| `notionRouter.scopes.getAll` | `constructionRouter.scopes.getAll` |
| `notionRouter.scopes.getScopesByQuery` | `constructionRouter.scopes.byTrade({ tradeId })` |
| `notionRouter.scopes.getAllSOW` | `constructionRouter.sow.byScope({ scopeId })` |
| `notionRouter.scopes.getSOWContent` | `constructionRouter.sow.content({ sowId })` |
| — | `constructionRouter.painPoints.getAll` |
| `notionRouter.revalidateNotionCache` | `constructionRouter.revalidateCatalog` |

**`getScopesByQuery` → `scopes.byTrade`.** F7 correctly says the procedure
cannot be *deleted* until P3, when the shared index replaces per-trade-row
queries. But its current input is a literal Notion property key, which F1
forbids above the seam:

```
sow-field.tsx:53              { query: tradeId, filterProperty: 'relatedTrade' }
trade-scope-row.tsx:34        { query: tradeId, filterProperty: 'relatedTrade' }
meeting-scopes-picker.tsx:37  { query: entry.tradeId, filterProperty: 'relatedTrade' }
```

All three callers want the same thing and none passes `sortBy`. Reshaping to
`byTrade({ tradeId })` is three one-line edits, closes the leak, and lets the
`filterProperty` and `sortBy` `z.enum`s be deleted — which retires the fourth
P0 escalation (`sortBy` admitting relation properties Notion cannot sort on).
The per-trade query *pattern* survives to P3 as F7 requires.

**`painPoints.getAll` is new.** `src/trpc/routers/meeting-flow.router.ts:10`
currently imports `getCachedPainPoints` from
`features/meeting-flow/lib/` — a tRPC router reaching into a feature, which
inverts the dependency direction. The router calls
`constructionService.getPainPoints()` instead, and the feature file is deleted.

### 3.6 Client read model

`modules/construction/lib/build-catalog-index.ts`:

```ts
export interface TradeScopeGroup { scopes: Scope[], addons: Scope[] }
export interface CatalogIndex {
  trades: Trade[]
  tradesById: ReadonlyMap<string, Trade>
  tradesBySlug: ReadonlyMap<string, Trade>
  scopesByTrade: ReadonlyMap<string, TradeScopeGroup>
}
export function buildCatalogIndex(trades: Trade[], scopes: Scope[]): CatalogIndex
```

A pure function, used by both the client hook and the RSC path.

`modules/construction/hooks/use-construction-catalog.ts` replaces
`features/meeting-flow/hooks/use-trade-catalog.ts`. It runs `trades.getAll` and
`scopes.getAll`, memoises `buildCatalogIndex`, and returns
`CatalogIndex & { isLoading, error, refetch }`.

Deleted in the same change:

- `features/meeting-flow/lib/group-scopes-by-trade.ts` — its entire body is
  `buildCatalogIndex`'s scope loop. Keeping both is the duplication P1 exists to
  remove.
- `features/meeting-flow/types/index.ts`'s `TradeScopeGroup` and `TradeCatalog`
  — they move to the module.
- `providers/notion/dal/trades/hooks/queries/use-get-trades.ts` and
  `.../scopes/hooks/queries/use-get-scopes.ts` (F16). Their four consumers call
  `trpc.constructionRouter.*` directly.
- `types.ts`'s `getDatabaseMeta` (zero callers) and `databases.ts`'s
  `properties: ZodRawShape` field (never read) — both dead. Dropping
  `properties` also removes the Zod-schema imports from `databases.ts`.

`features/landing/lib/notion-trade-helpers.ts` drops its hand-rolled
`scopesByTrade` map at `:42-47` and calls `buildCatalogIndex`.

**What stays in meeting-flow.** `TradeCatalogContext` bundles `catalog` *and*
`projects`; `projects` is meeting-flow's own showcase data, so the context and
its eleven consumers stay. Only the hook underneath it changes.

**What is not a duplicate.** `features/project-management/lib/group-scopes-by-trade.ts`
has a different signature and a different job — `(selectedScopeIds, allScopes)
→ TradeRow[]`, a projection of a *selection*, not a catalog index. It is not
merged at P1; P3 decides whether it should be derived from `CatalogIndex`.

### 3.7 Enums

`src/shared/domains/construction/constants/enums.ts` moves to
`modules/construction/constants/enums.ts` and `domains/construction/` is
deleted. Its five consumers are repointed:
`db/schema/{scopes,meta,customer-profiles}.ts`,
`entities/customers/constants/property-profile-fields.ts`,
`modules/proposals/core/schemas/index.ts`.

`db/schema/*` importing from `modules/*` is the established pattern —
`db/schema/proposals.ts:2,10` and `db/schema/projects.ts:2` already do it.

**A note the move makes visible, for P2.** The file's
`constructionTypes = ['energy-efficient', 'rough-construction', 'finish-construction']`
and the live Notion `Trade.category` enum
`['Energy Efficiency', 'General Construction', 'Structural / Rough']` are two
value sets for one concept, and they have drifted. Nothing reads
`constructionTypes` against a trade today, so this is not a live bug. Record it
in `DOCS.md#category-taxonomy` as P2's problem; do not reconcile it at P1.

## 4. Verification

- **V1** `pnpm tsc` and `pnpm lint` clean after every commit. Never `pnpm build`.
- **V2** grep gates, after the final commit:
  - `trpc.notionRouter` — zero hits
  - `providers/notion` imported outside `modules/construction/source/notion/`
    — zero hits, except `shared/config/server-env.ts` importing `lib/config`
  - `domains/construction` — zero hits
  - `entryType`, `relatedTrade`, `homeOrLot`, `relatedScopesOfWork`,
    `relatedScopes`, `relatedScope` in `src/` **and** `scripts/` — zero hits,
    with no exception. The property maps are keyed by the *domain* field name
    (`RawPropertyMap<T>` is `Omit<Record<keyof T, NotionPropDef>, 'id'>`), so
    they rename with the schema; only the `.label` values keep Notion's column
    titles. `homeOrLot` disappears from the property map too, since nothing
    reads it.
  - `notion-trades`, `notion-scopes`, `notion-pain-points` — zero hits
- **V5** A catalog read still clears the old 100-row cap: `getCatalog()`
  returns **more than 100 scopes** against production Notion. P0 measured 120
  scopes and 27 trades; treat those as the expected order of magnitude, not as
  exact assertions — the owner edits Notion.
- **New for P1** — one script, `scripts/verify-catalog-seam.ts`, asserting
  against production Notion that: every `Scope.kind` is `'scope'` or `'addon'`;
  every `Scope.tradeId` resolves to a trade in the same read; every id is a
  dashed lowercase UUID; and no returned trade came from a disabled row.
- **Cache proof** — two successive `getCatalog()` calls in one Next request
  context issue one set of Notion requests, not two.
- **Browser** — the funnel portfolio block and a landing pillar page render
  with the catalog after the change. Full P3-surface sweep stays at V6.

## 5. Files

**Created**

```
src/shared/modules/construction/DOCS.md
src/shared/modules/construction/schemas/index.ts
src/shared/modules/construction/constants/enums.ts
src/shared/modules/construction/lib/build-catalog-index.ts
src/shared/modules/construction/hooks/use-construction-catalog.ts
src/shared/modules/construction/construction.service.ts
src/shared/modules/construction/source/{types,index}.ts
src/shared/modules/construction/source/notion/**            (moved)
src/trpc/routers/construction.router/{index,trades,scopes,sow,pain-points}.router.ts
scripts/verify-catalog-seam.ts
```

**Moved** (the origin is deleted in the same commit — no path survives twice)

```
src/shared/services/providers/notion/{constants,dal}/**  →  source/notion/
src/shared/services/providers/notion/lib/**              →  source/notion/
                                              (except lib/config.ts, which stays)
src/shared/domains/construction/constants/enums.ts       →  modules/construction/constants/
src/trpc/routers/notion.router/**                        →  construction.router/
```

**Deleted outright**

```
src/shared/services/construction-data.service.ts        (replaced by the module service)
src/features/meeting-flow/hooks/use-trade-catalog.ts
src/features/meeting-flow/lib/group-scopes-by-trade.ts
src/features/meeting-flow/lib/get-cached-pain-points.ts
src/shared/services/providers/notion/dal/**/hooks/**    (F16 — both hook files)
```

**Reduced, NOT deleted**

`scripts/portfolio-scraper/` is a working, actively-used tool (`pnpm scrape-project`)
and P1 keeps every one of its capabilities. An earlier draft of this section listed
`fetch-scopes.ts` as deleted outright — that was wrong. The file also exports
`fuzzyMatchScopes` and two Levenshtein helpers, which `index.ts:549,556` depend on,
so deleting it would break the scraper.

Only its Notion-fetching half goes — `extractScope`, `fetchAllScopes`, the second
`new Client({ auth: notionApiKey })` and the hardcoded `SCOPES_DATABASE_ID`. The
matcher stays, and the file is renamed `fuzzy-match-scopes.ts` to say what it now
does. The scraper gains the P0 pagination fix in the trade: `fetchAllScopes` issued
a single un-paginated `dataSources.query`, so it silently capped at 100 scopes.

**Renamed**

`features/landing/ui/components/services/notion-refresh-button.tsx` →
`catalog-refresh-button.tsx`, with its exported component and its
`revalidateNotionCache` call renamed to match §3.5.

**Repointed** — 29 files import `Trade` / `ScopeOrAddon` from the provider
schema paths (15 in `features/meeting-flow/`, 6 in
`features/project-management/`, 3 in `features/landing/`, 4 in `src/shared/`,
1 in `scripts/`). 21 sites use `relatedTrade`; 3 app sites use `entryType`;
4 use `relatedScopes`. Plus ~10 `trpc.notionRouter` call sites, 5 enum
consumers, and 3 verify scripts.

`scripts/portfolio-scraper/` is wider than the one deleted file: `types.ts`,
`prompts.ts` and `index.ts` carry a local `{ id, name, entryType }` shape in
several signatures. They take `Scope` from the module instead, so `entryType`
becomes `kind` there too. This is the whole of F16's "no second Notion client".

## 6. Tracker amendments this spec requires

Apply to `docs/plans/2026-09-15-construction-data-standardization-epic.md`
in the final commit:

1. **C6 and F1** — the provider keeps `client.ts`, `types.ts` **and
   `lib/config.ts`**; `types.ts` is split, its construction-bound half moving
   to the module. As written, C6 is unachievable.
2. **F1** — drop `CatalogRef` and `ScopeRef` from P1; they belong to P4.
3. **F7** — add that `getScopesByQuery` is *reshaped* to `scopes.byTrade` at
   P1 and *deleted* at P3.
4. **A5** — the category/kind/pricing-unit const arrays do not exist. Today
   `entryType` and `unitOfPricing` are bare `z.string()`. A5 describes work to
   do at P2, not a rule to follow.
5. **§5 Pointers** — the service has 5 functions, not 7 (P0 deleted two);
   `domains/construction/constants/enums.ts` contains property-profile enums
   about the customer's house, and its drift from `Trade.category` is a P2 item.
6. **B18** — record that the P1 half is satisfied by deleting the field, not
   by moving the filter.
7. **Escalation status** — P0 escalations 1 and 4 close with this phase;
   2 and 3 remain open and owner-owned.
