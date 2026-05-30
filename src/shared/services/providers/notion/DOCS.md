# Notion Provider — Business Rules

The Notion provider wraps the official `@notionhq/client` and exposes typed reads from the company's content databases (trades, scopes, SOWs, projects, meetings, contacts, pain-points). Notion is **owned by the marketing/ops side** — they rename select options, add columns, and create draft rows as part of their normal workflow. The provider's job is to absorb that volatility without taking the app down.

This directory holds: low-level client (`client.ts`), database registry (`constants/databases.ts`), generic query DAL (`dal/query-notion-database.ts`), per-entity adapters and schemas (`lib/<entity>/`), and shared property extractors (`lib/extractors.ts`).

## Rules

### adapter-returns-entity-or-null

`pageTo<Entity>` adapter functions return `Entity | null`, never throw. The full extraction + validation pipeline runs inside a `try/catch`. On any failure (missing column, type mismatch, Zod `safeParse` failure) the adapter logs a `console.warn` with the page id, entity name, and Zod issues, then returns `null`. Service-layer callers use `flatMap` (or equivalent) to drop the nulls before returning to consumers.

**Why**: a single corrupt row in a Notion database would otherwise propagate as a 500 across every downstream consumer — pickers, landing pages, cached server fetches. We learned this the hard way: one trade with a renamed select option broke `notion.trades.getAll` everywhere it was consumed (8+ surfaces) until the codebase enum caught up. Adapters must absorb per-row failures so the rest of the list still flows.
**Reference impl**: `lib/trades/adapter.ts:pageToTrade`; service uses `flatMap` in `src/shared/services/construction-data.service.ts:getTrades`
**Enforced by**: convention. Other entity adapters (`pageToScope`, `pageToSOW`, etc.) still throw — they should be migrated as they're touched.

### disabled-checkbox-is-extraction-time-gate

When a Notion database has a `Disabled` checkbox column, the adapter checks it **first** — before extracting any other property — and short-circuits `return null` when `true`. The row is silently skipped (no warn log) because skipping is intentional, not exceptional.

The `disabled` field is also on the Zod schema (`z.boolean().default(false)`) so the property map type-checks. The schema's only consumer never sees `disabled: true` rows because they were dropped upstream.

**Why**: marketing uses the checkbox to hide rows that are mid-edit — incomplete name, experimental Type value not yet promoted to the enum, scope reshuffles. Short-circuiting before validation means these draft rows can hold *any* data without polluting `console.warn` (which is reserved for unintended drift). One source of truth — disabled rows are invisible to pickers, landing pages, and cached server fetches alike.
**Reference impl**: `lib/trades/adapter.ts:pageToTrade` (the `if (checkbox(...)) return null` at the top); `lib/trades/properties-map.ts:disabled`; `lib/trades/schema.ts:disabled`
**Enforced by**: convention. Currently only on trades — add to other entities when needed.

### notion-select-is-source-of-truth-for-zod-enums

When a Notion `select` or `multi_select` property's *option set* is mirrored as a Zod `z.enum([...])`, the Notion side owns the canonical spelling. If marketing renames an option in Notion, **every Zod enum in the codebase that mirrors it must be updated in the same PR**, or `notion.<entity>.getAll` will start failing `invalid_value` on every row that carries the renamed option.

For trades specifically, the option set lives in three places that must move together:

1. `lib/trades/schema.ts` — the source-of-truth `tradeSchema` Zod enum
2. `src/features/meeting-flow/constants/trade-categories.ts` — `TRADE_CATEGORY_ORDER` const + `TRADE_CATEGORY_LABELS` display map
3. `src/features/landing/lib/notion-trade-helpers.ts` — `PILLAR_TYPE_MAP` per-pillar filter

**Why**: TypeScript can't enforce alignment between an external system's string values and an in-code enum. The rename happens in Notion's UI, ships the next time the data is queried, and explodes at the Zod boundary. The `adapter-returns-entity-or-null` rule contains the blast radius (no 500s), but until the codebase enum catches up the affected rows are invisible. Grep for the old string before merging a Notion rename.
**Reference impl**: commit `47814c10` (`Structural / Functional` → `Structural / Rough` rename) — the three-file pattern
**Enforced by**: convention + grep. There is no automated check.

### extractors-throw-by-design-adapters-recover

The helpers in `lib/extractors.ts` (`titleText`, `selectName`, `checkbox`, `relationIds`, etc.) call `must()` and throw on missing or type-mismatched properties. This is deliberate: when a Notion column is renamed or its type changed, we want to *know* — not silently substitute a default. The resilience layer is one level up, in the adapter's `try/catch`.

**Do not** add defensive defaults inside extractors ("if missing, return false"). That would hide schema drift and cause silently wrong reads.

**Why**: extractors are pure shape-converters; semantic decisions ("a missing Disabled column means not disabled") belong at the adapter level where the entity's invariants are known. Centralizing recovery in one place per entity makes drift observable (one warn log per affected row) without proliferating fallback logic across helpers.
**Reference impl**: `lib/extractors.ts:must`
**Enforced by**: convention

### cache-invalidation-after-notion-edits

`unstable_cache` keys (`notion-trades`, `notion-scopes`, `notion-pain-points`) wrap server-side reads on landing pages with a 180s TTL. Client-side reads go through the tRPC `notionRouter` and are subject to React Query's normal caching.

After editing Notion (renaming a select option, toggling Disabled, adding a row), either:
- Call the `notionRouter.revalidateNotionCache` mutation (agent-only), which `revalidateTag`s all three cache keys, **or**
- Wait the 180s TTL for self-healing.

**Why**: marketing edits are routine and shouldn't require a code deploy or a server restart to surface. The mutation gives ops a manual lever; the TTL is the safety net.
**Reference impl**: `src/trpc/routers/notion.router/index.ts:revalidateNotionCache`; `src/features/landing/lib/notion-trade-helpers.ts:getCachedTrades`
**Enforced by**: convention

## Anti-patterns

- **Throwing from an adapter.** One bad row must not 500 the whole list. Wrap extraction in `try/catch`, warn, return `null`.
- **Defaulting inside extractors.** Extractors are pure shape-converters. Semantic defaults belong in the adapter (and ideally on the Zod schema via `.default(...)`).
- **Renaming a Notion select option without updating mirroring Zod enums.** Grep the old string across `src/` before merging the rename — there is no automated check.
- **Filtering disabled rows at the service layer instead of the adapter.** Filtering at the adapter is one source of truth: pickers, landing pages, and cached fetches all get the same treatment automatically.
- **Adding business logic to `lib/extractors.ts`.** Keep them dumb. Per-entity rules live in `lib/<entity>/adapter.ts`.

## See also

- `lib/trades/adapter.ts` — canonical example of the resilient-adapter + disabled-gate pattern
- `dal/query-notion-database.ts` — the generic query layer; one filter property at a time, no compound filter support yet
- `constants/databases.ts` — database id registry + propertiesMap wiring
- `src/shared/services/construction-data.service.ts` — service-layer wrapper that consumes the adapters and drops nulls
- `src/trpc/routers/notion.router/` — public read surface + cache-invalidation mutation
