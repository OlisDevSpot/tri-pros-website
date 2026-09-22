# Construction Module — Business Rules

`src/shared/modules/construction/` owns the **construction catalog**: trades, scopes and add-ons, SOW templates, and pain points. It owns no table. The rows live in a vendor system today (Notion, edited daily by the marketing/ops side) and are expected to move to Postgres at P5, so everything above this module depends on one neutral interface rather than on whoever supplies the rows.

This directory holds the cached read surface (`service.ts`), the neutral shapes (`core/schemas/index.ts`), the property-profile enums (`core/constants/enums.ts`), the pure read model (`core/lib/build-catalog-index.ts`), the client hook (`core/hooks/use-construction-catalog.ts`), the source contract and its single binding (`sources/{types,index}.ts`), the Notion implementation (`sources/notion/**`) and this file.

```
consumer → trpc/routers/construction.router  →  service.ts (unstable_cache)
                                                    ↓
                                            sources/index.ts  ← the one binding
                                                    ↓
                                            sources/notion/**  ← replaceable
```

## Rules

### neutral-schemas

`core/schemas/index.ts` holds the four shapes the app reasons about — `Trade`, `Scope`, `SowTemplate`, `PainPoint` — and **no field names a vendor**. Notion's column titles stay behind the adapters, in `sources/notion/<entity>/properties-map.ts`:

| Notion column | App field | Note |
|---|---|---|
| `Trade` (title) | `Trade.name` | |
| `Type` (select) | `Trade.category` | values in `tradeCategories` |
| `Scopes` (relation) | `Trade.scopeIds` | |
| `Disabled` (checkbox) | — | extraction gate, never a field — see `#disabled-checkbox-is-extraction-time-gate` |
| `Scope or Addon` (title) | `Scope.name` | |
| `Entry Type` (select) | `Scope.kind` | `Scope`/`Addon` → `'scope'`/`'addon'` |
| `Unit of Pricing` (select) | `Scope.unitOfPricing` | still a bare string — P2 (A5) |
| `Trade` (relation) | `Scope.tradeId` | first relation id only |
| `Scopes of Work` (relation) | `Scope.sowIds` | |
| `SOW` (title) | `SowTemplate.name` | |
| `Scope` (relation) | `SowTemplate.scopeIds` | |

`SowTemplate` is not called `SOW`: `modules/proposals/core/types.ts` already owns `SOW`, a proposal's own written scope. A catalog SOW is a reusable template.

`Trade.slug` and `coverImageUrl` are derived at the adapter (`slugifyTradeName`, the page cover), so they have no column and the property maps `Omit` them.

**Why**: the app's vocabulary must survive the vendor. Renaming `Entry Type` in Notion is a one-line change in one property map, not a sweep through features.
**Reference impl**: `core/schemas/index.ts`; `sources/notion/scopes/properties-map.ts`
**Enforced by**: convention + a grep gate — no Notion column title (`'Entry Type'`, `'Unit of Pricing'`, `'Scope or Addon'`, `'Disabled'`) appears anywhere in `src/` or `scripts/` outside `sources/notion/`.

### the-seam

`ConstructionCatalogSource` (`sources/types.ts`) is the contract: `getTrades`, `getScopes`, `getSowTemplatesByScope`, `getSowContent`, `getPainPoints`. `sources/index.ts` names the live implementation in exactly one line:

```ts
export const catalogSource: ConstructionCatalogSource = notionCatalogSource
```

Consumers import `catalogSource` from `sources/`, never `sources/notion/*`. Swapping to Postgres at P5 is that one line plus deleting `sources/notion/`.

There is deliberately **no `getCatalog()` on the source**. Composition (trades + scopes in parallel) and caching belong to `service.ts`, so a second implementation is a method-for-method port rather than a re-derivation of the app's read shapes.

**Why**: P0 found the catalog read through four different paths, each with its own client, cap and shape. One interface with one binding is what makes the vendor swappable — and what makes "does anything else talk to Notion?" a grep with one legitimate answer.
**Reference impl**: `sources/index.ts`; `sources/notion/index.ts` (`notionCatalogSource`)
**Enforced by**: convention + a grep gate — the only `new Client(` from `@notionhq/client` in the repo is the provider's.

### one-cache-tag

`service.ts` wraps four reads in `unstable_cache`, each with its own key, all under **one** tag, `CONSTRUCTION_CATALOG_TAG` (`'construction-catalog'`), with a 600s TTL:

| Function | Key | Why separate |
|---|---|---|
| `getCatalog()` | `construction-catalog` | trades + scopes in parallel; the one read a landing render needs |
| `getPainPoints()` | `construction-pain-points` | kept out of `getCatalog` so a landing render never fetches them — only meeting-flow reads pain points |
| `getSowTemplatesByScope(scopeId)` | `construction-sow-templates` | per-argument; `unstable_cache` includes the arguments in the key |
| `getSowContent(sowId)` | `construction-sow-content` | per-argument |

One `revalidateTag(CONSTRUCTION_CATALOG_TAG)` clears all four. That is what the refresh button (`constructionRouter.revalidateCatalog`, agent-only) fires after someone edits Notion; the TTL is the self-healing net.

**Why**: the pre-P1 shape had three vendor-named `notion-*` tags with two TTLs, so a refresh could leave one surface stale against another. Ops shouldn't have to reason about which button clears which read.
**Reference impl**: `service.ts`; `src/trpc/routers/construction.router/index.ts:revalidateCatalog`
**Enforced by**: convention + a grep gate — no vendor-named `notion-*` cache tag remains anywhere in `src/`.

### scripts-bypass-the-cache

Scripts import `catalogSource` from `sources/`, **never** `service.ts`. `unstable_cache` requires a Next request context; called from a plain `tsx` process it throws.

**Why**: `scripts/verify-catalog-seam.ts` and `scripts/portfolio-scraper/` need the same rows the app reads, and the seam gives them that without a second client, a second shape or a second pagination bug. The cache is a server-runtime concern, not part of the contract.
**Reference impl**: `scripts/verify-catalog-seam.ts`; `scripts/portfolio-scraper/index.ts`
**Enforced by**: convention — `service.ts`'s header says so; nothing under `scripts/` imports it.

### one-read-model

`buildCatalogIndex(trades, scopes)` (`core/lib/build-catalog-index.ts`) is pure and returns `{ trades, tradesById, tradesBySlug, scopesByTrade }`, where `scopesByTrade` splits each trade's entries into `{ scopes, addons }` by `Scope.kind`. The client hook `useConstructionCatalog()` fetches both lists once and calls it; an RSC path calls it on service data. Neither re-derives the maps.

**Why**: nine call sites each grouped scopes by trade their own way, and the picker issued a query per trade row on hover. One index, built once, is also what makes `kind` a data question rather than a per-surface string test.
**Reference impl**: `core/lib/build-catalog-index.ts`; `core/hooks/use-construction-catalog.ts`
**Enforced by**: convention. Collapsing the remaining duplicated consumers is **P3** (C4).

### reads-paginate

Every list read loops on `has_more` / `next_cursor` at `page_size: 100`. Notion's default page size is 100 and that is also its maximum, so a single request silently truncates — `dataSources.query` in `sources/notion/query.ts` (via `queryAllPages`) and `blocks.children.list` in `sources/notion/page-to-tiptap.ts` (via `listAllBlockChildren`). Both cap at 100 pages (10,000 rows) and throw rather than loop forever on a stuck cursor.

**Why**: reads used to stop at 100 rows with no error. The scope list feeds 8+ surfaces, so missing scopes showed up as missing UI, not as a failure. P0 fixed the app's reads; P1 removed the last capped copy, in the portfolio scraper.
**Enforced by**: convention — never call `dataSources.query` or `blocks.children.list` directly; go through the two helpers.

### adapter-returns-entity-or-null

`pageTo<Entity>` adapters return `Entity | null` and never throw. The whole extraction + validation pipeline runs inside a `try/catch`. On any failure (missing column, type mismatch, Zod `safeParse` failure) the adapter logs a `console.warn` with the page id and the Zod issues, then returns `null`. `readAll` in `sources/notion/index.ts` drops the nulls and warns once with a count.

**Why**: a single corrupt row would otherwise propagate as a 500 across every downstream consumer. One trade with a renamed select option once broke the trades read on 8+ surfaces until the codebase enum caught up. Per-row failures must not stop the list.
**Reference impl**: `sources/notion/trades/adapter.ts:pageToTrade`; `sources/notion/index.ts:readAll`
**Enforced by**: convention. All four adapters (`pageToTrade`, `pageToScope`, `pageToSowTemplate`, `pageToPainPoint`) return `Entity | null`.

### disabled-checkbox-is-extraction-time-gate

The trades database has a `Disabled` checkbox. `pageToTrade` checks it **first** — before extracting anything else — and returns `null` when it is `true`. The row is skipped silently (no warn) because skipping is intentional, not exceptional.

`Trade` has **no `disabled` field**. The checkbox appears only in `TRADE_PROPERTIES_MAP`, typed through `TradePropertySource = Omit<Trade, 'slug' | 'coverImageUrl'> & { disabled: boolean }`. Nothing downstream can filter on it because nothing downstream ever receives a disabled row.

**Why**: marketing uses the checkbox to hide rows that are mid-edit — incomplete name, experimental `Type` value not yet in the enum. Gating before validation lets those drafts hold any data without polluting `console.warn`. Before P1 the filter also ran again in a client hook and in the router, so "is this trade visible?" had three answers; now it has one.
**Reference impl**: `sources/notion/trades/adapter.ts` (the `if (checkbox(...)) return null` at the top)
**Enforced by**: convention. Only trades have the column; add the same gate if another entity gains one.

### ids-are-normalized-at-the-adapter

Adapters return dashed lowercase UUIDs for their own `id` and for every relation id, via `sources/notion/normalize-id.ts`. `buildPropertyFilter` normalizes the `relation` branch's input for the same reason — and **only** that branch; text filters must not be normalized.

**Why**: every id comparison in the app is string equality or a Map key, so a dashed/undashed mismatch returns nothing instead of erroring. An undashed id in a relation filter makes Notion return an empty set with no error.
**Enforced by**: convention + `scripts/verify-normalize-notion-id.ts`.

### extractors-throw-by-design-adapters-recover

The helpers in `sources/notion/extractors.ts` (`titleText`, `selectName`, `checkbox`, `relationIds`) call `must()` and throw on a missing or type-mismatched property. That is deliberate: when a column is renamed or retyped we want to know, not to substitute a default silently. The resilience layer is one level up, in the adapter's `try/catch`.

**Do not** add defensive defaults inside extractors. Semantic decisions ("a missing Disabled column means not disabled") belong at the adapter, where the entity's invariants are known.
**Reference impl**: `sources/notion/extractors.ts:must`
**Enforced by**: convention

### source-select-is-source-of-truth-for-enums

Where a source `select` option set is mirrored as a Zod enum, the source owns the canonical spelling. If marketing renames an option, every mirror must change in the same PR, or every row carrying the renamed value fails validation and disappears (contained, but invisible — see `#adapter-returns-entity-or-null`).

For trade categories the option set lives in two places that move together:

1. `core/schemas/index.ts` — `tradeCategories`, the source-of-truth `z.enum`
2. `src/features/landing/lib/notion-trade-helpers.ts` — `PILLAR_TYPE_MAP`, the per-pillar filter

`src/features/meeting-flow/constants/trade-categories.ts` is display copy only: it is a `Record<TradeCategory, string>`, so a rename breaks the build rather than the data.

**Why**: TypeScript cannot enforce alignment between an external system's strings and an in-code enum. The rename happens in someone else's UI and ships at the next read. Grep the old string before merging.
**Reference impl**: commit `47814c10` (`Structural / Functional` → `Structural / Rough`)
**Enforced by**: convention + grep. There is no automated check.

### category-taxonomy

**Recorded, not fixed.** Two value sets describe one concept and have drifted:

- `core/constants/enums.ts` — `constructionTypes`: `['energy-efficient', 'rough-construction', 'finish-construction']`
- `core/schemas/index.ts` — `tradeCategories`: `['Energy Efficiency', 'General Construction', 'Structural / Rough']`

They are not a live bug: `constructionTypes` describes the *customer's house* in property profiles, and nothing tests it against a trade today. `core/constants/enums.ts` as a whole is property-profile vocabulary (`tradeLocations`, `homeAreas`, `roofTypes`, …) that happens to live in this module.

**Reconciling them is P2 (F11 / A5).** Do not quietly map one onto the other in the meantime — a wrong mapping is worse than two honest lists.

## Anti-patterns

- **Importing `sources/notion/*` from outside `sources/`.** Import `catalogSource` from `sources/`. The point of the seam is that the vendor has exactly one name in the codebase.
- **Importing `service.ts` from a script.** `unstable_cache` needs a Next request context — see `#scripts-bypass-the-cache`.
- **A second Notion client.** The provider's lazily-constructed client is the only one. The portfolio scraper had its own with a hardcoded database id and no pagination; it read through the seam from P1 on.
- **Throwing from an adapter.** One bad row must not 500 the list.
- **Defaulting inside extractors.** Keep them dumb; per-entity rules live in the adapter.
- **Filtering disabled rows downstream.** The gate is the adapter. Nothing else ever sees such a row.
- **Adding a vendor column name to a feature.** Property maps are the only place a Notion title appears.
- **Re-deriving the catalog index.** Call `buildCatalogIndex`.

## See also

- `docs/plans/2026-09-15-construction-data-standardization-epic.md` — the phased epic this module is P1 of
- `src/trpc/routers/construction.router/` — the public read surface (`trades.getAll`, `scopes.getAll`, `scopes.byTrade`, `sow.byScope`, `sow.content`) and `revalidateCatalog`
- `src/shared/services/providers/notion/DOCS.md` — the leaf provider: client, env fragment, generic types
- `docs/codebase-conventions/provider-boundaries.md` — why translators live here and not in the provider
- `scripts/verify-catalog-seam.ts` — asserts ids, kinds and the 100-row cap against production
