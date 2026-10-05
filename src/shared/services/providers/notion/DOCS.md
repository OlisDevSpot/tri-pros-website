# Notion Provider — Business Rules

This is a **leaf provider**: an SDK client, its env fragment, and the generic types a caller needs to describe a Notion property. It knows nothing about trades, scopes, SOWs or pain points.

Everything construction-specific — database ids, property maps, adapters, extractors, pagination, caching — moved to `src/shared/modules/construction/sources/notion/` in P1 of the construction epic. **The catalog's rules live in `src/shared/modules/construction/DOCS.md`.**

This directory holds:

| File | What it is |
|---|---|
| `client.ts` | `notionClient` — the `@notionhq/client` `Client`, lazy-constructed through `lazyProxy` |
| `lib/config.ts` | the `NOTION_API_KEY` env fragment, runtime config and `isNotionConfigured` |
| `types.ts` | `NotionPropDef`, `RawPropertyMap<T>`, `NotionColumnType`, `PropertyFilter` |

## Rules

### client-is-lazy-so-a-missing-key-never-breaks-boot

`notionClient` is built through `lazyProxy`, so an unset `NOTION_API_KEY` does not crash app boot. The first call to any `notionClient.<resource>.<method>(...)` throws `NotConfiguredError` instead.

**Why**: Notion is optional infrastructure — a dev environment, a preview deploy or a CI run without the key must still start. Failure belongs at the call, where it names the provider.
**Reference impl**: `client.ts`; `lib/config.ts` via `createProviderConfig`
**Enforced by**: `docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional`

### the-provider-holds-no-business-shape

`types.ts` describes Notion's *column* vocabulary, not the company's. A type here may name a Notion concept (`select`, `relation`, `title`); it may not name a trade, a scope, a SOW, a pain point, or any database of ours. `RawPropertyMap<T>` stays generic over the caller's `T`, so the mapping from column titles to app fields lives with the app's shapes.

`NotionDatabaseName` used to live here; it moved to `modules/construction/sources/notion/databases.ts` with the registry it names.

**Why**: this provider is the thin edge of a vendor SDK. If a business shape leaks in, swapping the vendor means editing the provider — which is exactly what P1 undid.
**Reference impl**: `types.ts`
**Enforced by**: `docs/codebase-conventions/provider-boundaries.md`

### one-client-per-process

`notionClient` is the only `new Client(...)` in the repo. Anything needing Notion rows goes through `modules/construction/sources/`, not through its own client.

**Why**: a second client is a second auth path, a second set of retry semantics and — every time it has happened here — a second pagination bug. The portfolio scraper carried one until P1; before that it silently capped at 100 scopes.
**Enforced by**: grep gate — one `@notionhq/client` `Client` import outside `node_modules`.

## See also

- `src/shared/modules/construction/DOCS.md` — the catalog: the seam, cache tag, adapters, extraction gates, pagination
- `docs/codebase-conventions/provider-boundaries.md` — what a provider may and may not own
- `docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional` — the optional-provider config pattern
