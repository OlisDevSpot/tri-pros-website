# Prefetch + Hydration Fault Audit — Rollout Gate

## Addendum 2026-07-26 — C1 verdict superseded: canonical void prefetch restored

C1's "keep `await` + add `loading.tsx`" verdict and guardrail 3's blocking/streaming export split are SUPERSEDED. The awaited tier + loading.tsx caused the soft-nav regression: Next 15 re-runs dynamic pages every soft nav (`staleTimes.dynamic=0`), so every revisit blocked on the DB behind the spinner despite a warm client cache.

Superseding design (code commit `c6ba5670`; docs truth-pass is the commit carrying this addendum): single fire-and-forget `prefetch()`; no route-level `loading.tsx` on prefetch routes (old page holds until payload commit; cached rows paint instantly; streamed prefetch revalidates in background via pending-query dehydration/promise adoption). Verified canonical against Code with Antonio's tRPC v11 repos (29 void prefetch sites, 0 awaits, 0 loading.tsx) + tRPC server-components docs + TanStack Advanced SSR/Paginated Queries guides.

Known accepted trade-offs: cold hard-loads show the in-chrome table skeleton for the DB-query duration (rows no longer in first HTML paint for useQuery tables); stale (>30s) revisits fire one redundant background client refetch (TanStack #9610 race discards the streamed copy) — cosmetic, server cost unchanged.

Wave-3 conversion recipes: the "each Tier-2 route gets a loading.tsx" step is REVERSED — conversions must NOT add loading.tsx, and any `await prefetchBlocking` in a recipe now reads `prefetch(...)`. Smoke-checklist items that assumed loading.tsx (items 1 and 4) need re-scoping: item 1 becomes "old page holds during soft-nav, no spinner flash, cached rows at commit"; item 4's cold-start freeze note now applies to click→commit with no feedback (mitigation candidate: `useLinkStatus` sidebar indicator, optional).

> Adversarial audit (2026-07-26) of the server-prefetch + hydration system (shipped 2026-07-24,
> plan: `2026-07-24-trpc-prefetch-hydration.md`) before codebase-wide rollout. Four parallel
> adversarial reviews: Auth/Identity, Hostile URLs, Navigation/Streaming, Rollout Misuse.
> Verdicts are evidence-backed (file:line, library source, and empirical dev-DB probes).
> **This document gates the rollout: Wave 1 + Wave 2 patches land before any further conversion.**

## Headline

The isomorphic design held under attack: **no server/client query-key divergence exists anywhere**
(nuqs loader and client agree on duplicates, decoding, defaults; both paths run byte-identical
`derivePaginatedQueryState`). Hydration is provably monotonic (older payloads cannot clobber newer —
traced in @tanstack/query-core hydration.ts). Scope/auth parity, per-request isolation, invalidation
parity, boundary nesting, and back/forward semantics all verified SAFE.

All real faults are at the EDGES: the shared parser pipeline is looser than the procedures' Zod
(invalid values → 400) or tighter than Postgres (validated values PG rejects → 500); the sign-out
flow leaves caches warm; and Tier-2's awaited prefetch freezes soft navigations without a
`loading.tsx` commit point.

## Confirmed bugs

| ID | Bug | Severity | Repro | Patch |
|---|---|---|---|---|
| BUG-1 | Enum-violating filter / overflow page values pass the parsers, procedure Zod rejects → prefetch swallowed + client retries 400 **4×** (~7s) → table renders the FALSE message "No customers match your filter", no recovery affordance | **Medium** | `/dashboard/customers?pc_pipeline=projects,NOT_A_REAL_VALUE` (also `?pc_p=999999999999999999999`) | P1 isomorphic option validation (`parseAsStringLiteral` from `def.options` in `makePaginatedParsers` — invalid members DROP identically on both sides) + P5 error UI + retry policy |
| BUG-2 | Values that pass Zod but Postgres rejects → **500, empirically reproduced on dev DB**: (a) zod 4 `.datetime()` accepts year `0000`, PG doesn't; (b) NUL byte `%00` in search reaches `ilike` | Low-Med | `?pc_createdAt={"from":"0000-01-02T00:00:00Z"}` · `?pc_q=%00` | P3 strip `\u0000` at the isomorphic search chokepoint + P4 pg-safe datetime bound in `dateRangeSchema` (shared by parser AND procedure) |
| BUG-3 | Post-logout data residue: `signOut()` + soft `router.push('/')` leaves the singleton query cache AND Next Router Cache warm → **Back button re-renders the full customers table with a dead cookie** (shared-machine exposure; pre-existing, but prefetch makes the warm cache universal) | **Medium** | Sign in → customers → logout → browser Back | `queryClient.clear()` + `window.location.assign('/')` in both logout paths; defense-in-depth: clear cache when `useSession().data?.user.id` changes |

## Degraded (patch-worthy)

| ID | Finding | Severity | Patch |
|---|---|---|---|
| C1 | **Soft-nav freeze**: awaited Tier-2 prefetch blocks the first RSC flush; no `loading.tsx` exists → sidebar click shows the OLD page frozen (no URL change, no feedback) until session+DB complete; repeat visits regress too (`staleTimes.dynamic=0`). Hard loads currently show a BLANK content area (layout Suspense has no fallback) | **Med-High** | **Keep `await` + add `loading.tsx` per Tier-2 route** (records skeleton as fallback). Verified: unlocks Link partial-prefetch to the loading boundary in prod, fixes the blank hard-load area, does NOT reintroduce data skeletons. `prefetch={true}` on sidebar links evaluated and REJECTED (N×DB per viewport + stale payloads). Optional: `useLinkStatus` indicator in sidebar |
| B1d | Beyond-total page (`?pc_p=999999`): awaited prefetch runs `OFFSET 19999960` full ordered scan, dehydrates empty, client clamp then refetches real last page (double fetch + TTFB paid) | Low-Med | P2 `MAX_PAGE = 100_000` clamp at the shared page-floor line (also closes BUG-1's overflow variant) |
| A1 | Session dies while page open → background refetch 401s ×3, both view tiers keep rendering stale data with zero signal (suspense boundaries only throw when `data === undefined`) | Low-Med | `QueryCache.onError`: UNAUTHORIZED → `router.refresh()` (layout gate swaps to sign-in); `retry` predicate skipping auth errors |
| B5e | LIKE wildcard leak (pre-existing): `?pc_q=%` matches all rows, `_` any-char (`buildSearchWhere` doesn't escape) | Minor | Escape `[\\%_]` in the term |
| A8 | `shouldRedactErrors: () => false` missing from query-client dehydrate config — inert today, landmine if a prefetched procedure ever throws `redirect()`/`notFound()` | Low | One-line add |
| C3 | Tier-1 stream interrupted by nav-away → query stuck in error state for gcTime → return visit shows error boundary instead of auto-refetch (one-click retry recovers) | Low | Accept (retry wired) |
| A2 | better-auth cookieCache 5-min revocation window — prefetch path is byte-identical to the HTTP path; no NEW exposure | Low | Accept (documented trade-off) |

## Guardrails to build BEFORE mass rollout (from the misuse review, ranked)

1. **Dev-mode hydration-miss detector** (~40 lines, dev-only, zero prod bytes): `HydrateClient` records dehydrated keys on `window.__hydratedKeys` (SSR-gated); `usePaginatedQuery` + a `useHydrationCheck` helper compare on first mount and `console.error('[prefetch drift] …')` on same-path/different-hash. Converts D1 (config drift), D2 (extra mismatch), D4a/D4c (prefetch without/below dehydrate), D5 (client-only inputs) — all currently SILENT — into loud dev errors. Highest leverage per line.
2. **ESLint `no-inline-table-config`**: `no-restricted-syntax` selector (precedent: the existing `project/no-raw-nav-paths` block) flagging inline key-relevant fields (`paramPrefix|pageSize|pageSizeOptions|defaultSort|filters`) in `usePaginatedQuery`/`loadPaginatedQueryInput` calls. NOTE (corrected during Wave 2-C implementation, verified via `pnpm lint`): all 7 remaining tables inline their config today (`activities-table.tsx`, `lead-source-customers-section.tsx`, `all-customers-section.tsx`, meeting/project/proposal `table/index.tsx`, `campaigns-leads-view.tsx`) — the rule forces migration as each converts. Implemented as an aliased custom rule id (`project/no-inline-table-config`, wrapping the core `no-restricted-syntax` rule via `builtinRules.get`), NOT a second `no-restricted-syntax` config block — ESLint flat config resolves a rule name once across the whole config array, so a second block targeting the same files would have silently replaced `project/no-raw-nav-paths`'s entries instead of adding to them.
3. **`prefetchBlocking` / `prefetchStreaming` export split** in `src/trpc/lib/prefetch.ts` — streaming variant returns `void` (awaiting it becomes impossible-by-type); names shout the tier. 2 call-site renames today; expensive after 20.
4. **Dev assert in `prefetch()`** pinning the key-shape assumption (`queryKey[1]` meta object — breaks silently if tRPC's `keyPrefix` flag is ever enabled) + comment.
5. **Quantize `resolveTimeRange`** (floor rolling `to` to hour start) — hard precondition for the lead-sources conversion; rolling `new Date()` ranges are a guaranteed cache-miss. ⚠️ Changes stats freshness at window edges — needs explicit sign-off on granularity.

Accepted as convention (detector backs them at runtime): type brand on config; per-entity `server/prefetch.ts` wrappers (adopt at first extra-bearing conversion = lead-sources); "prefetch in page body before JSX"; "prefetchable inputs = searchParams + shared constants only".

## Doc fixes

- ⚠️ Stale ref: `query-toolkit.md#always-use-usepaginatedquery` reference impl points at `lead-source-customers-section.tsx` — an INLINE-CONFIG offender under the newer `shared-table-config` rule. Move pointer to `customers-table.tsx`.
- Add to `query-toolkit.md#shared-table-config`: dynamic `FilterDefinition.options` are key-IRRELEVANT (normalize keys off `def.type` only) — split configs static-ids/types vs runtime options (campaigns-leads pattern).
- Add to `frontend-stack.md#server-prefetch-two-tiers`: the D4c and D5 convention sentences.

## Conversion recipes (verified, for the rollout)

Recorded in the misuse review (full text in `.superpowers/sdd/` task outputs and reproducible from this doc's rules):
- **lead-sources** (trickiest): precondition = resolveTimeRange quantization; two table configs (`src`/`all` prefixes); server loader mirrors the view's `id`/`range`/`tab` nuqs params from ONE shared parser module; prefetch branch mirrors the view's exactly-one-table-mounts logic; year-chip first-render fallback should parse `year-\d+` without waiting for `getYearsWithActivity`; range-keyed stat queries stay `useQuery` (keepPreviousData — never suspense).
- **schedule**: move the two inline `{pagination:{limit:500,offset:0}}` literals to `constants/schedule-query-inputs.ts` (two separate constants), `void` prefetch both, view → single `useSuspenseQueries`.
- **settings / action-center**: single no-input query each → `void` prefetch + `useSuspenseQuery`; settings' `IntegrationsSection` fetches inside a component (standing convention violation) — prefetch `getSyncStatus` too or accept one waterfall; do NOT lift it into suspense.
- **campaigns leads tab**: split config (static ids/types in constants; runtime options merged in view).

## Prod/preview smoke list (dev lies about these)

1. Link prefetch is production-only — the C1 `loading.tsx` instant-commit behavior is only observable in `next build`/Vercel Preview.
2. Tier-1 zero-roundtrip: hard-load `/dashboard/campaigns?tab=overview`, network tab must show NO `/api/trpc` calls for the two overview queries.
3. Redacted error path: force a campaigns procedure failure in preview; assert tab boundary + working retry.
4. Cold-start budget: click→paint on customers from cold Vercel fn + cold Neon (worst case the loading.tsx must cover).
5. Interrupted-stream recovery (C3 repro) in preview.

## Patch waves

- **Wave 1 — correctness bugs**: P1 (isomorphic option validation), P2 (MAX_PAGE), P3 (NUL strip), P4 (pg-safe datetime), P5 (DataTable error state + retry policy), BUG-3 logout fix (+ session-change cache clear), A1 QueryCache onError, A8 shouldRedactErrors, B5e LIKE escape. — **LANDED** `ddab6bca` (harden paginated URL pipeline: P1/P2/P3/P4), `ad5c9760` (retries, unredacted stream errors, table error state, hard-nav logout)

### Necessity review verdicts (2026-07-26, second-pass scrutiny of P5/BUG-3/A1/A8)

Source-verified against node_modules + this app's config; net ~18 lines instead of ~80:

- **Retry policy — IMPLEMENT with `isServer` guard**: without the guard, defining `retry` overrides the server default of 0 and streamed prefetches would retry 500s with backoff (~3s SSR regression). `error.data.httpStatus` confirmed real on TRPCClientError v11; matches the tRPC retryLink doc's "don't retry non-500s" idiom.
- **Table error row — SLIMMED (~8 lines)**: `usePaginatedQuery` already returns `isError`; only the adapter field + an `ErrorState` render in DataTable's empty-state branch were missing. No retry button — remaining triggers are 500s/network-down, where refocus/reconnect refetch already retries; richer UX rides the pre-existing "surface isError in RecordsPageShell" backlog item.
- **Logout residue — SLIMMED (3 lines, 3 call sites)**: hard `window.location.assign('/')` in signOut's `onSuccess` alone fixes the whole bug — the dashboard layout is fully dynamic (`no-store` → not bfcache-eligible), so Back re-requests and hits the server gate; fresh document = fresh query-client + Router Cache. `queryClient.clear()` protects nothing in the pre-unload window (worst case causes a flash) — dropped. Session-watch effect dropped as YAGNI (sign-in is exclusively full-page OAuth redirect). Third call site found: `site-navbar.tsx` logout had no navigation at all.
- **A1 UNAUTHORIZED auto-refresh — DROPPED**: rolling 7d/1d better-auth sessions make mid-use expiry a revocation-only event (further delayed by the 5-min cookieCache); with 401 retries stopped and mutations surfacing via toasts, "idle tab shows stale data until next interaction" is acceptable for an internal CRM. If ever needed: ~6-line `QueryCache onError` + `window.location.reload()`, no registry.
- **A8 shouldRedactErrors — IMPLEMENT (security framing was inverted)**: redaction applies only to streamed pending-promise rejections and defaults to ON even in dev; TanStack's Next.js recipe ships `() => false` because Next's flight digests already redact prod errors — no leak. Keeping default redaction is the deviation, and it swallows Next control-flow errors.
- **Wave 2 — UX + guardrails**: C1 loading.tsx for Tier-2 routes, hydration-miss detector, eslint rule, prefetch export split, D9 assert, doc fixes.
  - **Wave 2-A — LANDED** `7f637758` (feat(prefetch): tier-named exports (blocking/streaming), key-shape assert, customers loading boundary): prefetch export split, D9 dev key-shape assert, C1 `loading.tsx` for Tier-2 (`customers`).
  - **Wave 2-B — LANDED** `e228351a` (feat(prefetch): dev-mode hydration-drift detector): hydration-miss detector (`src/shared/lib/hydration-drift.ts` + `use-hydration-parity-check.ts`).
  - **Wave 2-C — LANDED** (this patch): ESLint `no-inline-table-config` (warn) + doc truth-pass (query-toolkit.md, frontend-stack.md, `src/trpc/DOCS.md`, this file).
- **Wave 3 — rollout**: conversions per recipes (lead-sources last, after quantization sign-off), preview smoke list per batch.
