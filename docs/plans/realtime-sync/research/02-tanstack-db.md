# TanStack DB — primary-source findings

**Read date:** 2026-09-07. **Sources:** tanstack.com/db docs, github.com/TanStack/db (README, `packages/*`, CHANGELOGs, issues, examples), npm registry API. No blog posts except the official TanStack release post (linked from the README). Anything not confirmed by one of these is marked **UNVERIFIED**.

**Versions (npm `latest`, all published 2026-08-31 unless noted):**

| Package | Version | Notes |
|---|---|---|
| `@tanstack/db` | 0.8.7 | core; deps: `@standard-schema/spec`, `@tanstack/pacer-lite`, `@tanstack/db-ivm@0.1.19` — **no** `@tanstack/query-core` |
| `@tanstack/react-db` | 0.3.7 | deps `@tanstack/db@0.8.7` (exact pin), `use-sync-external-store`; peer `react >=16.8.0` |
| `@tanstack/electric-db-collection` | 0.4.7 | deps `@electric-sql/client ^1.5.15`, `@tanstack/store`, `@tanstack/db@0.8.7` |
| `@tanstack/query-db-collection` | 1.2.12 | peer `@tanstack/query-core ^5.0.0`; dep `@tanstack/db@0.8.7` |
| `@tanstack/trailbase-db-collection` | 0.1.106 | dep `trailbase ^0.10.0` |
| `@tanstack/rxdb-db-collection` | 0.1.94 | peers `rxdb >=16.17.2`, `rxjs >=7.8.2` |
| `@tanstack/powersync-db-collection` | 0.1.66 | peer `@powersync/common ^1.41.0` |
| `@tanstack/db-ivm` | 0.1.19 (2026-08-20) | the differential-dataflow engine |
| `@tanstack/offline-transactions` | 1.0.53 | RN peers |

Source: npm registry JSON (`https://registry.npmjs.org/<pkg>`), read 2026-09-07.

---

## 1. What TanStack DB is

- **Positioning:** "The reactive client store for your API" (GitHub repo description / README). Overview: "load data into normalized collections", "sub-millisecond live queries", "instant optimistic writes". [overview] [gh-repo]
- **Package families** (25 dirs under `packages/`): core `db`; adapters `react-db`, `vue-db`, `solid-db`, `svelte-db`, `angular-db`; collections `query-db-collection`, `electric-db-collection`, `trailbase-db-collection`, `rxdb-db-collection`, `powersync-db-collection`; engine `db-ivm`; `offline-transactions`; SQLite-persistence family (`db-sqlite-persistence-core`, `browser-`, `capacitor-`, `cloudflare-durable-objects-`, `electron-`, `expo-`, `node-`, `react-native-`, `tauri-db-sqlite-persistence`); `react-router-with-db`; `db-collections`; `db-collection-e2e`. [gh-packages]
- **`@tanstack/react-db` re-exports all of `@tanstack/db`** plus `useLiveQuery`, `useLiveSuspenseQuery`, `useLiveInfiniteQuery`, `useLiveQueryEffect`, `usePacedMutations`, `DbProvider`, `HydrationBoundary`. [react-db-index]
- **Stability:** README badge `status-beta`; README line 52: "Tanstack DB is currently in BETA. See the release post". Release post (2025-07-30, Kyle Mathews & Sam Willis): "TanStack DB 0.1 (first beta) is available now." Core is still 0.x (0.8.7). CHANGELOG 0.8.0 says deprecated patterns "keep working with development warnings until 1.0" → 1.0 is planned; **no date published** (UNVERIFIED). [readme] [blog-0.1] [db-changelog]
- **Release cadence:** 30 `@tanstack/db` releases between 2026-03-07 and 2026-08-31 (~1.2/week); minor bumps 0.6.0 (03-25), 0.7.0 (08-12), 0.8.0 (08-18). Every satellite package pins the exact `@tanstack/db` version (e.g. `react-db@0.3.7 → db@0.8.7`) — you upgrade the whole set together. [npm]
- **Breaking-change history, last 6 months** (from CHANGELOGs):
  - `db@0.6.0` (2026-03-25, PR #1353) — **Breaking:** `autoIndex` default `eager`→`off`; `BTreeIndex` removed from main entry (now `@tanstack/db/indexing`); `defaultIndexType` must be set to use `createIndex()`/`autoIndex:'eager'`. Adds `BasicIndex` (Map + sorted array) vs `BTreeIndex` ("large collections (10k+ items)"). [db-changelog]
  - `electric@0.3.0` (2026-04-03, PR #1270) — new Electric server wire protocol (DNF / `active_conditions`, `/`-delimited tags; electric-sql/electric#3791). Implies a minimum Electric server version — exact version UNVERIFIED from TanStack sources. [electric-changelog]
  - `db@0.7.0` (2026-08-12, PR #1642) — internal shared `createLiveQueryObserver`; all five adapters migrated; explicitly "an internal, unstable contract … may change in any release". Fixes several live-query lifecycle defects. [db-changelog]
  - `db@0.8.0` / `react-db@0.3.0` / `electric@0.4.0` (2026-08-18, PR #1564) — SSR via request-scoped `DbClient`, collection **descriptors** (`collectionOptions`), hydration, live-query snapshots; React live queries derive identity from structured query IR; "legacy dependency arrays and unkeyed opaque queries keep working with development warnings until 1.0". [db-changelog] [react-db-changelog]
  - `query-db-collection@1.1.0` (07-16) observer options passthrough; `1.2.0` (07-22, PR #1683) `initialData` support (eager only); "QueryClient-default `placeholderData` no longer materializes as collection rows". [query-changelog]
- **Relationship to TanStack Query:** `@tanstack/db` does **not** depend on `@tanstack/query-core`; only `@tanstack/query-db-collection` peer-depends on it (`^5.0.0`). Release post: "TanStack Query still owns 'how do I fetch?'; TanStack DB owns 'how do I keep everything coherent and lightning-fast once it's here?'". React docs: "No QueryClientProvider is needed — this is a distinct data layer." [npm] [blog-0.1] [react-overview]
- **Adoption signal:** weekly downloads 2026-08-31→09-06: `db` 749,862; `react-db` 679,324; `query-db-collection` 369,959; `electric-db-collection` 198,756. [npm-dl]

## 2. Collections

Official taxonomy from the Overview: **Fetch** = QueryCollection; **Sync** = Electric, TrailBase, RxDB, PowerSync; **Local** = LocalStorage, LocalOnly. Collection-options-creator guide: "You should create a custom collection when you have a dedicated sync engine (like ElectricSQL, Trailbase, Firebase, RxDB or a custom WebSocket solution)… If you're just hitting an API and returning data, use the query collection instead." [overview] [creator-guide]

| Collection | Package / version | Backed by | Key config | Mutation handler contract |
|---|---|---|---|---|
| **Electric** | `@tanstack/electric-db-collection` 0.4.7 | Electric shape stream (HTTP long-poll) over Postgres | `id?`, `getKey`, `schema?`, `shapeOptions: { url, params: { table, where?, columns? }, headers? }`, `syncMode?: 'eager' \| 'on-demand' \| 'progressive'`, `startSync?` | `onInsert/onUpdate/onDelete` return `{ txid: number \| number[], timeout? }` or void; utils `awaitTxId(txid, timeout?)`, `awaitMatch(fn, timeout?)` (docs example: default 3000 ms) |
| **Query** | `@tanstack/query-db-collection` 1.2.12 | TanStack Query observer in a `QueryClient` | `queryKey`, `queryFn(ctx)`, `queryClient`, `getKey`, `schema?`, `id?`, `syncMode: 'eager'(default) \| 'on-demand'`, passthrough `enabled/staleTime/gcTime/refetchInterval/refetchOnWindowFocus(false)/refetchOnReconnect(true)/refetchOnMount(false)/retry/select/meta/initialData` | handlers auto-refetch after success unless they return `{ refetch: false }`; utils `refetch()`, `writeInsert/writeUpdate/writeDelete/writeUpsert/writeBatch` |
| **TrailBase** | `@tanstack/trailbase-db-collection` 0.1.106 | TrailBase (SQLite backend) record API + subscriptions | `id`, `recordApi`, `getKey`, `schema?`, `parse?`, `serialize?` | built-in handlers (Pattern B) |
| **RxDB** | `@tanstack/rxdb-db-collection` 0.1.94 | RxDB (owns persistence + replication) | `rxCollection`, `id?`, `schema?`, `startSync?`, `syncBatchSize` (1000) | RxDB writes |
| **PowerSync** | `@tanstack/powersync-db-collection` 0.1.66 | PowerSync SQLite | `database`, `table`, eager/on-demand | PowerSync writes |
| **LocalStorage** | in `@tanstack/db` | `localStorage`/`sessionStorage`; cross-tab via storage events | `storageKey`, `storage?`, `storageEventApi?` | `utils.acceptMutations()` |
| **LocalOnly** | in `@tanstack/db` | in-memory only | `id`, `getKey`, `initialData?` | `utils.acceptMutations()` |

Sources: [electric-docs] [electric-src] [query-docs] [trailbase-docs] [rxdb-docs] [powersync-docs] [localstorage-docs] [localonly-docs] [installation]

**Electric specifics**
- `syncMode` is documented **only in source JSDoc** (`packages/electric-db-collection/src/electric.ts` ~L260), not on the docs page (grep of `docs/collections/electric-collection.md` finds no `syncMode`/`on-demand`): `eager` — "syncs all data immediately on preload… marked as ready once the sync is complete"; `on-demand` — "syncs data in incremental snapshots when the collection is queried… ready immediately after the first snapshot"; `progressive` — full background sync with snapshot fast-path, ready once full sync completes. [electric-src]
- txid: "Query `pg_current_xact_id()` *inside* the same transaction as your mutation": `SELECT pg_current_xact_id()::xid::text as txid` → `parseInt`. Mismatch symptom: "`awaitTxId` stalls indefinitely". Debug: `localStorage.debug = 'ts/db:electric'`. [electric-docs]
- `must-refetch` control message → collection starts a transaction, `truncate()`s and resyncs (source L1902–1922). [electric-src]
- Auth/visibility: "Electric is typically deployed behind a proxy server that handles shape configuration, authentication and authorization"; proxy sets `where` server-side. [electric-docs]

**Query specifics**
- Full-state reconciliation: "Items present in the collection but not in the query result will be deleted"; "Empty arrays delete all items". Partial/incremental fetches must merge inside `queryFn` or use direct writes with `{ refetch: false }`. [query-docs]
- **Does not poll** unless `refetchInterval` is set. `refetchOnWindowFocus` defaults to **false** here (unlike React Query). `queryClient.invalidateQueries({ queryKey })` works as usual. [query-docs]
- `placeholderData` unsupported (won't materialize as rows). `initialData` eager-only. [query-docs] [query-changelog]
- On-demand mode: predicates pushed to `queryFn` via `ctx.meta.loadSubsetOptions` (`where/orderBy/limit/offset`) with helpers `parseLoadSubsetOptions`, `parseWhereExpression`, `parseOrderByExpression`, `extractSimpleComparisons`. [query-docs]
- "No tRPC-specific integration documented" on the docs page, but the official **`examples/react/projects`** uses tRPC v11 + Drizzle 0.45 + drizzle-zod + `queryCollectionOptions` with `queryFn: () => trpc.todos.getAll.query()`, `schema: selectTodoSchema`, handlers calling `trpc.todos.update.mutate(...)`, and `refetchInterval: 5000` ("Poll for updates every 5 seconds"). [example-projects]

## 3. Live queries

- **Builder** (`q`): `from({ alias: collection | subquery })`, `where(expr)` (chainable = AND), `select(...)`, `leftJoin / innerJoin / rightJoin / fullJoin` (**equality conditions only**; result optionality follows join type), `groupBy`, `having`, aggregates `count/sum/avg/min/max`, `orderBy(expr, 'asc'|'desc')` (chain for multi-column), `limit`/`offset` ("`orderBy` is required for `limit` to function correctly"), `findOne()`, `distinct()` (requires `select`), `unionAll`, subqueries in `from`/`join` (auto-deduplicated), **includes** (nested subquery in `select` → hierarchical rows; `toArray()` / `materialize()`), `fn.where / fn.select / fn.having` (arbitrary JS; cannot combine `fn.select` with `groupBy`). Operators: `eq gt gte lt lte like ilike inArray isNull isUndefined and or not`, `upper lower length concat add subtract multiply divide coalesce caseWhen`. Postgres three-valued null logic. Virtual row props `$synced`, `$origin`, `$key`, `$collectionId`. Open issue #593 asks for `and()` in join conditions. [live-queries] [builder-ref]
- **Engine:** Overview: live queries "implemented using d2ts, a TypeScript implementation of differential dataflow". The shipped engine is `@tanstack/db-ivm` — README: "forked from @electric-sql/d2ts, but simplified and without the complexities of multi-dimensional versioning"; queries compile to a D2 graph. Release-post benchmark: "0.7 ms to update one row in a sorted 100k collection on an M1 Pro". [overview] [db-ivm-readme] [blog-0.1]
- **Client-side joins across collections:** yes, that is the design (joins run in the d2 graph over any collections, mixed types allowed). [live-queries]
- **Limits / performance guidance:** no documented hard row cap. Guidance is (a) explicit indexes since 0.6.0 — `BasicIndex` (O(n) writes, "read-heavy") vs `BTreeIndex` ("large collections (10k+ items)", ORDER BY optimization; ~7.8 KB gz); dev-mode "suggestions warn when indexes would help"; (b) `syncMode: 'on-demand'` "for large datasets where most rows won't be accessed". [db-changelog] [index-ref] [powersync-docs]
- **Hooks / entrypoints:** `useLiveQuery({ query, id?, gcTime?, queryKey? })`, `useLiveSuspenseQuery`, `useLiveInfiniteQuery`, `useLiveQueryEffect`, `createLiveQueryCollection`, `liveQueryCollectionOptions` (`gcTime` default 5000 ms), `createEffect` (enter/update/exit deltas), `queryOnce` (one-shot). [live-queries] [react-overview]
- **Return shape:** `{ data, status: 'idle'|'loading'|'success'|'error'|'disabled', isLoading, isReady, isError, isCleanedUp, isEnabled, collection, error }`. [live-queries]
- **`isReady` definition:** collection `CollectionStatus.ready` = "Collection has been explicitly marked ready via `markReady()`" (`packages/db/src/types.ts` L577–588). The shared observer treats a live result as authoritative only when `collection.status === 'ready' && !collection.isLoadingSubset` (`live-query-observer.ts` L291–296). Creator guide: call `markReady()` "after obtaining a usable snapshot"; later refetch failures must not un-ready. **For Electric:** `markReady()` is invoked on the first `up-to-date` control message (source L1546–1570 "first up-to-date"), i.e. eager → after the full initial shape load; on-demand → after the first snapshot; progressive → after full sync. [types-src] [observer-src] [creator-guide] [electric-src]
- **Query identity:** derived from the query IR (values captured in `eq(todo.status, status)` become part of identity); `fn.*` queries need `queryKey`; legacy dep arrays "warn in development and will be removed in 1.0". [ssr-guide]

## 4. Mutations

- `collection.insert(item|items, { optimistic?, metadata? })`, `update(key|keys, opts?, draft => …)` (Immer-style draft; don't reassign), `delete(key|keys, opts?)` — each returns a `Transaction` (`state: 'pending'|'persisting'|'completed'|'failed'`, `isPersisted.promise`). Optimistic by default; `{ optimistic: false }` waits for the server. [mutations]
- `createTransaction({ id?, autoCommit?=true, mutationFn, metadata? })` → `tx.mutate(() => …)`, `tx.commit()`, `tx.rollback()`; `createOptimisticAction({ onMutate, mutationFn })`; `usePacedMutations`/`createPacedMutations` with `debounceStrategy/throttleStrategy/queueStrategy`. [mutations]
- **Lifecycle:** "Optimistic applied → Handler invoked → Backend persisted → Sync back → Optimistic dropped". "If handler throws error, optimistic state automatically rolls back." No auto-retry ("TanStack DB does not auto-retry"). Same-item mutations inside one tx are merged (insert+update→insert, update+delete→delete, etc.). [mutations]
- **Handler contract:** `onInsert/onUpdate/onDelete({ transaction, collection })`; `transaction.mutations[i] = { type, key, original, modified, changes, metadata }`. "**Handlers must not resolve until server changes have synced back** to the collection. Do not call `preload()` or `loadSubset()` inside handlers—risk of deadlock." [mutations]
- **Electric pattern (the one you remembered):** handler calls your API, API runs the write in a Postgres tx that also selects `pg_current_xact_id()`, returns `{ txid }`; the Electric collection wraps the handler and `await awaitTxId(txid)` (creator guide shows exactly this wrapper) — optimistic state is held until the shape stream delivers a message carrying that txid, then dropped in favour of synced rows. Multiple items → `{ txid: [..] }`; per-call `timeout`. If txid never arrives the wait times out and the handler rejects → rollback (timeout→reject path UNVERIFIED in source; rollback-on-throw is documented). [electric-docs] [creator-guide] [mutations]
- **Query pattern:** handler calls API; collection auto-refetches after success (opt-out `{ refetch: false }`); optimistic state dropped when the refetched result arrives. [query-docs]
- IDs: "Use client-generated UUIDs when backend supports" to avoid re-keying/flicker. [mutations]

## 5. Next.js / SSR

- SSR/hydration shipped in **0.8.0 on 2026-08-18** (≈3 weeks old). Guide: "SSR and Hydration". Model: collections are defined as **descriptors** `collectionOptions(id, (client) => options)`; the server creates `new DbClient()` per request, `await dbClient.collection(desc).preload()` or `await dbClient.preloadLiveQuery({ query })`, then `dbClient.dehydrate()`; the browser holds one stable `DbClient` in `useState` inside `<DbProvider>` + `<HydrationBoundary state>`. "`initialData` is a startup seed, not a sync-ready signal." Hydration precedence: initialData < persisted rows < hydrated rows < fresh adapter sync. [ssr-guide] [db-changelog]
- **Official App Router example** `examples/react/next-ssr-e2e` (deps `next ^16.3.1`, `react ^19.2.4`, `@tanstack/db ^0.8.7`, `@tanstack/react-db ^0.3.7`): the RSC `page.tsx` does `const dbClient = new DbClient({ runtime: 'server' }); void dbClient.preloadLiveQuery(q); const state = dbClient.dehydrate({ shouldDehydrateCollection: () => false, shouldDehydrateLiveQuery: () => true })` and renders `<DbHydration state>` (a `'use client'` component = `DbProvider` + `HydrationBoundary`, client created in `useState`) around a `<Suspense>` + `'use client'` component using `useLiveSuspenseQuery`. `export const dynamic = 'force-dynamic'`. The descriptor reads `client.requireDependency('runtime')` to branch server/browser sync. [next-example]
- **Known issues:** #545 "Add SSR & RSC Support for @tanstack/react-db" (66 reactions) is still **open**; last maintainer comment 2026-03-28 (tannerlinsley) on DI/hook ergonomics — predates 0.8.0. #1016 "Missing getServerSnapshot Error in NextJS apps" (9 reactions) still **open**; 2026-07-04 comment: `useLiveQuery` called `useSyncExternalStore` without `getServerSnapshot` → React #407 on server render and #423 forced re-render on hydration. Whether 0.8.x closes #1016 is UNVERIFIED (issue not updated since; the SSR guide now describes "useSyncExternalStore server snapshot support"). [issue-545] [issue-1016] [ssr-guide]
- **React 19:** peer `react >=16.8.0`; official examples run React 19.2 + Next 16.3. No React-19-specific caveats documented. [npm] [next-example]
- Legacy module-level `createCollection(...)` still works client-side (the `projects` example uses it), but the SSR path requires descriptors + `DbProvider`; quick-start now shows `DbProvider` as required. [quick-start] [example-projects]

## 6. Schemas & types

- "TanStack DB supports any StandardSchema compatible library" — Zod, Valibot, ArkType, Effect. Schema validates **client-side mutations only** (insert/update; throws `SchemaValidationError`); "Server data requires explicit validation in integration layer". `TInput` (what `insert/update` accept) vs `TOutput` (stored/queried); "TInput must accept all values that TOutput contains" (use unions for transforms). [schemas]
- `createCollection<T extends StandardSchemaV1, TKey extends string | number, TUtils>(options): Collection<InferSchemaOutput<T>, TKey, TUtils, T, InferSchemaInput<T>>`. Schema is optional — reference shows `queryCollectionOptions<Todo>({...})` / plain-type patterns; "Using schema for type inference (preferred as it also gives you client side validation)". [createCollection-ref]
- **`getKey`**: `(item: T) => TKey`, `TKey extends string | number` (`types.ts` L615; creator guide). UUID strings are fine. [types-src] [creator-guide]
- **Drizzle:** no integration in core — GitHub code search for `drizzle` in `TanStack/db` returns 30 hits, **all under `examples/`**. The official `projects` example bridges Drizzle → collection via `drizzle-zod` select schemas (`schema: selectTodoSchema`). So the type path is: Drizzle table → `createSelectSchema` (Zod = Standard Schema) → `schema` on the collection; or pass the Drizzle `$inferSelect` type as the generic without validation. [code-search] [example-projects]

## 7. Coexistence with our stack

- **Same app, same QueryClient:** `queryCollectionOptions` takes a `queryClient` — pass the existing one; the collection registers a query observer under `queryKey`, so `queryClient.invalidateQueries({ queryKey })` (our `useInvalidation()`) triggers a collection refetch. Docs section "Integrating with Existing TanStack Query" spreads `queryOptions()` into `queryCollectionOptions` (must re-supply `queryFn`). With the 0.8 descriptor API the QueryClient is injected via `new DbClient({ queryClient })` + `client.requireDependency<QueryClient>('queryClient')`; "The `queryClient` parameter is a fallback; explicit `DbClient` dependency takes precedence." [query-docs]
- **Providers:** `DbProvider` is separate from `QueryClientProvider`; both can coexist ("distinct data layer"). Peer `@tanstack/query-core ^5.0.0` is satisfied by `@tanstack/react-query ^5.80`. [react-overview] [npm]
- **Replace vs wrap:** for query collections TanStack DB is a layer on top of Query's cache (release post: "built on top of Query's cache"); React Query still fetches/caches, DB owns normalization, live queries and optimistic txns. For Electric collections React Query is **not involved** — the shape stream is the source. Non-migrated entities keep using `useQuery`/tRPC untouched. [blog-0.1] [query-docs]
- **Incremental path:** every collection type shares `getKey`/`schema`/`onInsert|onUpdate|onDelete` and the same `useLiveQuery` surface; swapping `queryCollectionOptions` → `electricCollectionOptions` changes the options creator + handler return (`{ txid }` instead of auto-refetch) and nothing in query/UI code. This is implied by the collection-options-creator contract (Pattern A "User-Provided Handlers (Query/ElectricSQL Style)") rather than stated as an official migration guide — **UNVERIFIED as documented guidance**. [creator-guide]

## 8. Maturity signals (GitHub API, 2026-09-07)

- Stars **3,900**; forks 262; created 2025-03-11; last push 2026-09-02. Open issues **145** / closed **314**; open PRs 147 (repo `open_issues_count` 292 = issues + PRs). Latest tags 2026-08-31 (per-package changesets). [gh-api]
- **Top open issues by reactions:**
  1. #82 Offline-First Support (117 reactions, 23 comments; 2025-05) — general offline persistence/replay.
  2. #545 Add SSR & RSC Support for `@tanstack/react-db` (66; 2025-09) — still open post-0.8.0.
  3. #865 Persistence of synced data (47; 2025-11) — persist Electric/sync rows locally.
  4. #357 RFC: Simplified Single-Value State Management API (30) — non-collection scalar state.
  5. #19 Stable ViewKeys to prevent re-renders on ID mapping (26) — temp→server id remap flicker.
  6. #21 Stable pagination & deferred update handling for large results (25).
  7. #42 Devtools (11) — no devtools yet.
  8. #35 Serialized transaction queuing utility (10).
  9. #1016 "Missing getServerSnapshot" in Next.js apps (9) — SSR/hydration error.
  10. #593 Allow joins with an `and()` condition (9) — join predicates are equality-only.
  11. #1452 `persistedCollectionOptions` schema type not inferred (8; 2026-04).
  12. #1659 RFC: Hardening the SQLite persistence / Electric sync stack (7; 2026-07-08) — maintainers themselves flag hardening work.
  13. #1456 Electric + browser SQLite persistence doesn't persist (4; 2026-04). [gh-issues]
- **Docs completeness:** `docs/config.json` — Getting Started (3), Guides (Live Queries, SSR & Hydration, Mutations, Schemas, Error Handling, Collection Options Creators), Collections (7 pages), Frameworks (5), Community, typed API reference for core + electric/query/rxdb/powersync + per-framework hooks. Gaps observed: Electric `syncMode`/on-demand only in source JSDoc; no tRPC/Drizzle guide; no performance/limits page. [docs-config]
- **Production users:** README lists **Partners** CodeRabbit, Cloudflare, ElectricSQL, Prisma (sponsors, not stated as users). Release post cites one unnamed "Linear-like application builder" early adopter. No named production users on docs. **UNVERIFIED** beyond that. [readme] [blog-0.1]
- **Maintainers' own status:** "BETA" (README); core 0.x; "internal, unstable contract" wording in 0.7.0; 1.0 referenced but undated. Not called production-ready anywhere found.

## 9. Fit for us (Next 15.5 App Router · tRPC v11 · Drizzle 0.45 · Neon PG17 · Zod · centralized `useInvalidation()`)

**Shared ground:** either route gives the same client model — per-entity collections keyed by our uuid `id`, Zod (or drizzle-zod) `schema`, `useLiveQuery` for reads, `collection.update(id, draft => …)` for optimistic writes with rollback, handlers that call our existing tRPC mutations. Row visibility stays server-enforced in both cases; the client only ever sees what the server hands it.

**(a) Electric collections.** Shapes are per-table (`params.table` + `where` + `columns`), so our tRPC *read models* (joins + derived fields) cannot be synced as-is. We'd sync base tables (`meetings`, `proposals`, `customers`, plus the lookup tables the joins need) as separate Electric collections and rebuild the joins with `leftJoin/innerJoin` + `select` on the client; derived fields either move into `select()` (`caseWhen`, `coalesce`, arithmetic) or stay server-computed via a Postgres view exposed as a shape (view-as-shape: UNVERIFIED from TanStack sources). Visibility is enforced by a Next.js route handler that proxies to Electric and injects the `where` clause per user — i.e. our CASL→scope rules must be expressible as an Electric shape `where` on that table (subquery-dependent shapes exist per the 0.3.0 changelog, but their limits are outside TanStack's docs). Infra: an Electric service (cloud or self-host) attached to Neon via logical replication, plus the proxy route. Two-agents-same-meeting: agent A's `onUpdate` calls `trpc.meetings.update.mutate` → the server runs the Drizzle write in a tx that also `SELECT pg_current_xact_id()::xid::text` → returns `{ txid }` → A's optimistic row is held until the shape delivers that txid; agent B holds the same shape open (long-poll) and receives the change within the stream's latency, and every live query on B re-renders incrementally — **no invalidation code on either side**. `must-refetch` (e.g. after schema changes) is handled by automatic truncate+resync. Cost: single-table shapes force a client-side re-derivation of every read model we point at it, the visibility filter has to be re-expressed as shape SQL, and the stack (Electric protocol bump in 0.3.0, SSR in 0.8.0, open hardening RFC #1659) is moving weekly.

**(b) Query collections over tRPC only.** Wrap an existing tRPC list procedure: `queryFn: () => trpc.meetings.list.query(...)` (the read model with joins/derived fields is fine — rows are opaque to the collection), `getKey: m => m.id`, `queryClient` = our existing one, handlers call our tRPC mutations and auto-refetch. This buys: normalized client store, client-side filtering/sorting/joins across our read models, optimistic UI with rollback, and a swap-ready seam for (a) later. It does **not** by itself make agent B see agent A's edit: query collections "do not poll automatically unless `refetchInterval` is set", `refetchOnWindowFocus` is off by default, and propagation happens only on refetch/invalidate. So (b) needs a trigger — `refetchInterval` (the official example polls every 5 s), or a push channel (Ably/SSE/WS) that calls `collection.utils.refetch()` or applies `writeBatch` direct writes, or our `useInvalidation()` firing on the query key from a server-sent event. Full-state reconciliation also means visibility changes propagate on every refetch (rows the server no longer returns are removed). Server-derived fields are stale in the optimistic window until the refetch lands. Recommendation-relevant: (b) is a near-zero-infra step that keeps tRPC as the sole data boundary and only changes the client read/write layer; (a) is the actual "no-invalidation" realtime and requires per-table shapes, an Electric deployment, and re-expressing visibility as shape `where`.

---

## Sources

- [overview] https://tanstack.com/db/latest/docs/overview
- [quick-start] https://tanstack.com/db/latest/docs/quick-start
- [installation] https://tanstack.com/db/latest/docs/installation
- [live-queries] https://tanstack.com/db/latest/docs/guides/live-queries
- [mutations] https://tanstack.com/db/latest/docs/guides/mutations
- [ssr-guide] https://tanstack.com/db/latest/docs/guides/ssr
- [schemas] https://tanstack.com/db/latest/docs/guides/schemas
- [creator-guide] https://tanstack.com/db/latest/docs/guides/collection-options-creator
- [electric-docs] https://tanstack.com/db/latest/docs/collections/electric-collection
- [query-docs] https://tanstack.com/db/latest/docs/collections/query-collection
- [trailbase-docs] https://tanstack.com/db/latest/docs/collections/trailbase-collection
- [rxdb-docs] https://tanstack.com/db/latest/docs/collections/rxdb-collection
- [powersync-docs] https://tanstack.com/db/latest/docs/collections/powersync-collection
- [localstorage-docs] https://tanstack.com/db/latest/docs/collections/local-storage-collection
- [localonly-docs] https://tanstack.com/db/latest/docs/collections/local-only-collection
- [react-overview] https://tanstack.com/db/latest/docs/framework/react/overview
- [community] https://tanstack.com/db/latest/docs/community/resources
- [createCollection-ref] https://github.com/tanstack/db/blob/main/docs/reference/functions/createCollection.md (via context7 `/tanstack/db`)
- [builder-ref] https://github.com/tanstack/db/blob/main/docs/reference/classes/BaseQueryBuilder.md (via context7)
- [index-ref] https://github.com/tanstack/db/blob/main/docs/reference/classes/CollectionImpl.md, …/BasicIndex.md (via context7)
- [blog-0.1] https://tanstack.com/blog/tanstack-db-0.1-the-embedded-client-database-for-tanstack-query (linked from README as "the release post")
- [gh-repo] https://github.com/TanStack/db
- [readme] https://raw.githubusercontent.com/TanStack/db/main/README.md
- [gh-packages] https://github.com/TanStack/db/tree/main/packages
- [docs-config] https://raw.githubusercontent.com/TanStack/db/main/docs/config.json
- [db-changelog] https://raw.githubusercontent.com/TanStack/db/main/packages/db/CHANGELOG.md
- [electric-changelog] https://raw.githubusercontent.com/TanStack/db/main/packages/electric-db-collection/CHANGELOG.md
- [query-changelog] https://raw.githubusercontent.com/TanStack/db/main/packages/query-db-collection/CHANGELOG.md
- [react-db-changelog] https://raw.githubusercontent.com/TanStack/db/main/packages/react-db/CHANGELOG.md
- [react-db-index] https://raw.githubusercontent.com/TanStack/db/main/packages/react-db/src/index.ts
- [types-src] https://raw.githubusercontent.com/TanStack/db/main/packages/db/src/types.ts
- [observer-src] https://raw.githubusercontent.com/TanStack/db/main/packages/db/src/live-query-observer.ts
- [electric-src] https://raw.githubusercontent.com/TanStack/db/main/packages/electric-db-collection/src/electric.ts
- [db-ivm-readme] https://raw.githubusercontent.com/TanStack/db/main/packages/db-ivm/README.md
- [next-example] https://github.com/TanStack/db/tree/main/examples/react/next-ssr-e2e (`package.json`, `app/page.tsx`, `app/db-hydration.tsx`, `app/ssr-fixture.ts`, `app/streamed-todos.tsx`)
- [example-projects] https://github.com/TanStack/db/tree/main/examples/react/projects (`package.json`, `src/lib/collections.ts`, `src/lib/trpc/todos.ts`)
- [issue-545] https://github.com/TanStack/db/issues/545
- [issue-1016] https://github.com/TanStack/db/issues/1016
- [gh-issues] GitHub search API `repo:TanStack/db type:issue state:open sort:reactions` (2026-09-07); individual issue URLs: https://github.com/TanStack/db/issues/{82,545,865,357,19,21,42,35,1016,593,1452,1659,1456}
- [gh-api] https://api.github.com/repos/TanStack/db (stars/forks/open_issues/pushed_at) and `search/issues` counts
- [code-search] GitHub code search `drizzle repo:TanStack/db` (30 results, all in `examples/`)
- [npm] https://registry.npmjs.org/@tanstack/db, …/react-db, …/electric-db-collection, …/query-db-collection, …/trailbase-db-collection, …/rxdb-db-collection, …/powersync-db-collection, …/db-ivm, …/offline-transactions
- [npm-dl] https://api.npmjs.org/downloads/point/last-week/@tanstack/{db,react-db,electric-db-collection,query-db-collection}
