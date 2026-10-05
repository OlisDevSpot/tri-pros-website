# Realtime Sync — PRD (Electric SQL vs. Ably kernel)

**Status:** DRAFT v1 — research complete (5 primary-source reports in `research/`), decision proposed in §7, awaiting owner sign-off
**Date:** 2026-09-07
**Owner:** Oliver P
**Supersedes / relates to:** Epic #178 (Ably Realtime Kernel — approved 2026-04-19, implementation deferred). Spec restored from git `4820b043d`.

> Working principle for this document: every technical claim is either verified against code
> (`file:line`) or against a primary source (URL in `research/*.md`). Anything else is marked
> **UNVERIFIED** or **OPEN**.

---

## 1. Problem statement

Two staff members open the same record (meeting, its proposal, its customer) in two browsers.
Today only the `meetings` row has any liveness, and only via a hand-wired Ably ping:

| Piece | Today (`file:line`) |
|---|---|
| Server publish | `src/shared/entities/meetings/dal/server/crud.ts:144` and `src/trpc/routers/meeting-flow.router.ts:51` → `ably.channels.get('meeting:{id}').publish('meeting.updated', …)` |
| Client subscribe | `src/features/meeting-flow/hooks/use-meeting-sync.ts` → `useChannel('meeting:{id}', invalidateMeeting)` |
| Provider | `src/shared/components/providers/realtime-provider.tsx` (Ably Realtime with **`NEXT_PUBLIC_ABLY_API_KEY`** in the browser — `src/shared/services/providers/upstash/realtime-client.ts`) |
| Fan-out | `src/shared/dal/client/hooks/use-invalidation.ts` (router-level `pathFilter()` invalidation) |
| Customer publish | commented out — `src/shared/entities/customers/dal/server/crud.ts:66` |

Everything else (customer profile, proposal, pipeline board, dashboard counts) goes stale until a
manual refresh or `refetchOnWindowFocus`. Writes from background jobs (QStash), webhooks (Twilio,
Zoho Sign), and GCal sync produce **no** client update at all because they never pass through a
client that could publish.

## 2. Goal

Any committed change to a row the dashboard is showing — regardless of *who* wrote it (another
agent, a job, a webhook) — reaches every open client automatically, within a few seconds, without
us building or operating a bespoke sync engine.

### Use cases (carried over from Epic #178 §1, unchanged)

| # | Use case | In scope for this PRD |
|---|---|---|
| A | Multi-device sync (one user, laptop + phone) | ✅ |
| B | Multi-user collaboration on one meeting/customer/proposal | ✅ **primary** |
| C | Dashboard / pipeline liveness (cards move, counts update) | ✅ |
| D | Customer-facing realtime (homeowner in proposal-flow sees agent edits) | ✅ (share-token principal) |
| E | Presence ("Oliver is viewing this meeting") | ⏸ nice-to-have; does not drive the engine choice |
| F | Notification fan-out (push, activity feed) | ⏸ separate bus; already have web-push |

Non-goals: CRDT/OT text collaboration; offline-first writes; persisting every event.

## 3. Hard constraints (verified 2026-09-07)

| Constraint | Evidence |
|---|---|
| Next.js 15.5.9 App Router on **Vercel serverless** | `package.json`; no `runtime = 'edge'`, one `maxDuration = 60` (`src/app/api/qstash-jobs/route.ts:27`) |
| Reads are **tRPC read models** (joins + derived fields + SQL masks), not raw tables | `research/03-repo-read-models-and-seams.md` |
| **Row visibility is server-authority**: CASL condition → Drizzle `WHERE`; the atom is `EXISTS(meeting_participants …)` — a subquery, not a single-table predicate | `docs/permissions/visibility-rules-catalog.md` Part 2–3; `src/shared/entities/meetings/dal/server/participants.ts:9` |
| Column masking exists (`gatedPhoneSql`: phone visible only if a sent/approved proposal exists) | `src/shared/entities/customers/lib/phone-gating-sql.ts` |
| Homeowners are a **bearer-token principal** (`ability = null`), not a CASL user | `shareable-middleware.ts`; catalog axis 7 |
| Neon Postgres **17.11**, project `polished-shape-00174668` (us-west-2), autoscaling 0.25–2 CU | Neon API 2026-09-07 |
| **`wal_level = replica`**, `enable_logical_replication = false`, 0 publications | `SHOW wal_level` 2026-09-07 |
| Prod and dev are **two branches of the same Neon project**, both accessed via `-pooler` endpoints (transaction mode) | Neon API: `production` = `br-purple-field-afkq0ups` (default) → `ep-flat-wind-afvc0zla`; `development` = `br-small-sun-afns8axo` → `ep-mute-sunset-afxp3pn5`; plus worktree branches (`wt/issue-285` live). `.env` hosts match. |
| Prod compute is **not** 24/7 today: ~139k s active in the period since 2026-09-01 (~24 % duty cycle) — a permanent replication consumer would change that | Neon API branch metrics 2026-09-07 |
| Scale (prod, 2026-09-07): 50 tables · 257 meetings · 714 customers · 105 proposals · 64 projects · 269 meeting_participants · 833 customer_notes · 112 activities · 8 users | `SELECT count(*)` on default branch |
| Only Neon-internal **physical** slots exist (`wal_proposer_slot`, `wal_retention_slot`); no logical slots, no publications | `pg_replication_slots` 2026-09-07 |
| Mutations route tRPC → service → DAL; the `createCrudDal` after-hooks (`create-crud-dal.ts:118/190/237`) are the closest thing to a central post-write seam — but they run **pre-commit** inside a threaded tx and are **bypassed** by ~12 raw entity writers plus `SYSTEM_CONTEXT` jobs/webhooks | `research/03` §3; `docs/codebase-conventions/dal-conventions.md` |
| Ably 2.21 installed; the browser holds an API key today (to be deleted per #178 decision 3) | `package.json:104`; `realtime-client.ts` |
| Provider boundary rule: one `client.ts` entrypoint per provider; Ably currently mis-homed under `providers/upstash/` (#250) | memory `project-provider-boundaries` |

## 4. Requirements

### Must
- R1 — Cross-client propagation for `meetings`, `customers` (+profile), `proposals`, `projects`, `meeting_participants`, `customer_notes`, `activities` within ≤ 3 s p95 of commit.
- R2 — Propagation for **non-client writers** (QStash jobs, webhooks, GCal sync, `SYSTEM_CONTEXT` writes). A design that only works when the writer is a browser fails R2.
- R3 — **No authorization regression.** A client must never receive a row or column it could not read via tRPC today (axes 2 + 3 + 7 in the catalog). No parallel permission system (Epic #178 decision 4 stands).
- R4 — Realtime is a **latency optimization, never a correctness dependency** (decision 9). If the realtime layer is down, the app is correct, just stale until refetch.
- R5 — No long-lived process required *on Vercel*. Anything long-running is managed SaaS or a container we consciously operate.
- R6 — Fits the entity conventions: single registry/config per entity, one provider `client.ts`, no ad-hoc per-feature wiring (user's stated architecture in #178).
- R7 — `pnpm tsc` / `pnpm lint` green; no `NEXT_PUBLIC_*` secret in the browser.

### Should
- R8 — Optimistic UI for the writing client without hand-rolled cache surgery.
- R9 — Incremental adoption: entity-by-entity, coexisting with the current React Query + tRPC stack.
- R10 — Local dev works without ngrok/extra infra for the *read* path (tunnel is acceptable for webhooks only, per `environment.md`).

### Won't (this round)
- Offline-first / conflict resolution beyond last-write-wins at the DB.
- Replacing tRPC as the write path.

## 5. Candidate approaches

| Option | Paradigm | Summary | Research file |
|---|---|---|---|
| **O1 — Ably kernel (Epic #178)** | Pub-sub *ping* → React Query refetch (patch opt-in) | Already designed; server publishes after each write; clients invalidate | `research/04-…` §1 |
| **O2 — Electric SQL + TanStack DB** | Postgres logical replication → HTTP *shapes* → client collections + live queries | Data sync of raw table rows; writes stay on tRPC | `research/01-…`, `02-…`, `05-…` |
| **O3 — Hybrid: O1 transport, TanStack DB query-collections** | Ping transport + client store | Keeps server read models; adds live-query ergonomics without logical replication | `research/02-…` §2/§7 |
| **O4 — PowerSync / Zero** | Full client-DB sync engines | Evaluated for completeness | `research/04-…` §4–5 |
| **O5 — DIY SSE/LISTEN on Vercel** | Roll-our-own | Bounded by Vercel function limits | `research/04-…` §2–3 |

### 5.1 Verified facts that frame the decision (independently re-checked 2026-09-07)

**Electric SQL** (`research/01-electric-sql.md`; the four starred items were re-fetched by the lead session from the primary URL):
- ★ **Vendor status:** Electric joined **Databricks on 2026-08-11**; the post says *"Electric Cloud is winding down. Cloud users will need to self-host or move to another provider."* No sunset date. OSS stays open source (Postgres Sync, PGlite, TanStack DB, Durable Streams). The Databricks post frames the deal around PGlite for agent sandboxes + Lakebase; no stated roadmap for the standalone Postgres sync service. Open discussion issue #4770 has no maintainer reply. → **Self-hosting is the only path; vendor direction is uncertain.**
- ★ **Shapes are single-table** (*"Shapes sync data from a single table"*). No joins. Row filtering only via the shape's `where`.
- ★ **WHERE subset:** subqueries only as `value IN (SELECT …)`; `EXISTS` is not in the supported list (parser rejects other sublinks); **JSONB operators unsupported**; enums need explicit `::text` casts. Our visibility atom `EXISTS(SELECT 1 FROM meeting_participants …)` would have to be rewritten per table as `id IN (SELECT meeting_id FROM meeting_participants WHERE user_id = $1)`, injected by a proxy route.
- ★ **Shape definitions are immutable**; a column add/rename via `drizzle-kit push` invalidates every shape on that table (409 → full resync).
- **Read-path only.** Writes stay on our tRPC path; to avoid optimistic flicker each mutation must return `pg_current_xact_id()` from inside the same transaction.
- **Transport is HTTP long-poll (20 s holds) or SSE**, CDN-cacheable; not WebSocket.
- **Cannot run on Vercel**: needs a long-running Elixir process with a persistent local disk (NVMe recommended) on Fly/Render/etc.
- **Neon requirements:** enable logical replication (project-level, irreversible, restarts compute, defeats scale-to-zero), direct non-pooled connection, dedicated replication role, `max_slot_wal_keep_size` to bound WAL; inactive slots dropped after ~40 h (see `research/05` for the Neon-side verification).
- **Auth:** public by default; the documented pattern is exactly a Next.js route handler that injects the per-user `where` + `ELECTRIC_SECRET`; on Vercel the route must disable CDN caching (`Vercel-CDN-Cache-Control: no-store`).

**Neon logical replication** (`research/05-neon-logical-replication-ops.md`; ★ = re-checked by the lead session against the Neon API / `neon.com/docs/guides/logical-replication-neon`):
- ★ **We are on the Free plan** (`owner.subscription_type: "free_v3"`, 100 CU-h/project/month included, 10 branches, 6 h history).
- ★ Enabling logical replication is **project-level, irreversible** (*"Once changed, it cannot be reverted"*), applies to every branch, and **restarts all computes**.
- ★ *"While a logical replication subscriber is connected, your Neon compute stays active and will not scale to zero."* Electric holds such a connection permanently → prod compute goes from ~24 % duty cycle to 24/7: ≈ 186 CU-h/month at the 0.25 CU floor vs ≈ 51 today → **exhausts the Free allowance in ~17 days, after which prod is suspended**. A paid plan (Launch ≈ $20/mo per always-on branch at $0.106/CU-h; Scale ≈ $41) becomes a precondition. Dev-branch Electric doubles it.
- ★ Neon **removes replication slots inactive for ~40 h** → Electric recreates the slot and every client does a full resync (409). Any Electric outage or weekend-off dev instance hits this.
- `max_slot_wal_keep_size` is `-1` today; a 2024 Neon changelog says 1 GB applies once logical replication is on — **UNVERIFIED until enabled**; Neon does not allow `ALTER SYSTEM`.
- Electric needs the **direct (non-pooler) host**; our app uses `-pooler` for everything today. Electric also sets `REPLICA IDENTITY FULL` on synced tables (more WAL).
- Both the Neon community guide (pins Electric 1.0.17) and Electric's Neon page (2026-04) omit the always-on and 40-h facts.

**What our clients actually read** (`research/03-repo-read-models-and-seams.md`, 29 procedures inventoried with `file:line`):
- Class split: **A** single-table 24 % (7) · **B** reproducible joins 34 % (10) · **C** server-computed 41 % (12). The procedures the two-agent scenario actually renders (`getByIdWithJoins`, `getPersonaProfile`, `getCustomerProfile`, `getCustomerPipelineItems`, `meetings.list`, `customers.search`) are mostly **C**.
- C-ness has four reusable causes, not bespoke logic: the phone `CASE` mask; `EXISTS`-derived flags (`hasSentProposal`, `derivedPipelineSql`); `now()`-relative bucketing; external calls (Zoho, R2, Notion).
- **Row visibility is a single-table WHERE for none of** `meetings`, `customers`, `proposals` (agent path), `projects`, `customer_notes`, `customer_profiles`, `media_files`. Every one is the correlated `EXISTS(meeting_participants …)` atom (`src/shared/entities/meetings/dal/server/participants.ts:9-18`) through a different FK. Only `activities.owner_id = me`, the proposal **token** path, `is_public`, and "my own participant rows" are single-table.
- **Write seam:** `src/shared/dal/server/lib/create-crud-dal.ts:118` (create) / `:190` (update) / `:237-239` (delete) is the one post-write point for every `createCrudDal` entity — but it runs **inside the transaction (pre-commit)** when a tx is threaded, and it is **bypassed** by raw writers: all `meeting_participants` writes, GCal inbound sync on `meetings`, DNC/measurement on `customers`, `customer_profiles` upserts, proposal rollup / cash-in-deal / AI summary, `proposal_incentives`, `proposal_views`, project stage drag, `activities`, media status — plus ~20 QStash jobs and 5 webhooks writing under `SYSTEM_CONTEXT`.
- Schema: 50 tables, 18 pg enums, 0 views/triggers/generated columns; `updated_at` is a Drizzle `$onUpdate` (raw SQL will not bump it); `proposals` carries three JSONB blobs + a `text[]`; media tables use serial int PKs.
- Runtime: Vercel Node serverless, `httpBatchLink` (no streaming), `node-postgres` Pool. Fluid Compute status not determinable from code.

**TanStack DB** (`research/02-tanstack-db.md`):
- `@tanstack/db` 0.8.7 / `@tanstack/react-db` 0.3.7 (2026-08-31), officially **BETA**; three breaking minor bumps in six months; SSR support is 3 weeks old (0.8.0); Next.js SSR issues #545 / #1016 open.
- The remembered adapter is **`@tanstack/electric-db-collection` 0.4.7** (`electricCollectionOptions` + `awaitTxId`).
- **`@tanstack/query-db-collection` 1.2.12** runs TanStack DB collections over ordinary tRPC queries using our existing `QueryClient` (official example uses tRPC v11 + Drizzle 0.45). It gives live queries + optimistic mutations **without** Electric, but it **does not push**: cross-browser propagation still needs an invalidation trigger (Ably ping) or polling.
- Live queries support client-side joins across collections (differential dataflow); this is what would rebuild our joined read models if we ever went per-table.

## 6. Evaluation matrix

Legend: ✅ meets · ⚠️ partial / with caveats · ❌ fails. Each cell cites the research section that supports it.

| Criterion | O1 Ably kernel (amended, §7.1) | O2 Electric + TanStack DB | O3 Hybrid (O1 transport + TanStack DB query-collections) | O4 PowerSync / Zero | O5 DIY SSE/WS on Vercel |
|---|---|---|---|---|---|
| **R2** non-client writers (jobs, webhooks, GCal) reach clients | ⚠️ only if every writer publishes; CRUD-hook seam is bypassed by ~12 raw writers + jobs/webhooks (03 §3). Mitigation: post-commit seam + writer audit + safety-net `refetchInterval` | ✅ WAL-level — captures every write including manual SQL (01 §1) | ⚠️ same as O1 (transport is still a ping) | ✅ WAL-level (04 §4–5) | ⚠️ same as O1; NOTIFY cannot wake a Function (04 §3) |
| **R3** row visibility without a parallel system | ✅ data still fetched via tRPC + CASL→Drizzle; Ably only carries "something changed" (spec §4) | ❌ visibility must be re-expressed per table as proxy-injected `IN (SELECT …)`; `EXISTS` and JSONB unsupported; phone mask needs denormalisation; homeowner token path needs its own shape (01 §5, 03 §2) | ✅ same as O1 | ❌ PowerSync sync-rules / Zero synced-queries = a second authz language (04 §4–5, 04 §9) | ✅ same as O1 |
| **R5** no long-running process we must host | ✅ SaaS; token endpoint is a normal route (04 §1) | ❌ Elixir service + persistent NVMe disk on Fly/Render; **Electric Cloud is winding down** (01 §4, §9) | ✅ | ⚠️ PowerSync has a cloud (Free/Pro $49); Zero = self-host `zero-cache` (04 §4–5) | ⚠️ WebSockets beta, pinned to instance, die at max duration; needs Redis for fan-out (04 §2) |
| Works with our JOIN/derived read models (41 % class C) | ✅ refetches the existing procedures unchanged | ❌ single-table shapes; derived fields move client-side or into snapshot columns (01 §2, §10; 03 §1) | ✅ (collections wrap tRPC procedures as-is) | ⚠️ PowerSync Sync Streams allow JOINs; Zero ZQL joins client-side; neither carries SQL `CASE` masks or `now()` bucketing (04 §4–5) | ✅ |
| Ops surface / Neon changes | ✅ none on Neon | ❌ irreversible `enable_logical_replication`, computes restart, **compute always-on → exceeds Free plan in ~17 days**, 40-h slot removal, direct (non-pooler) connection, `REPLICA IDENTITY FULL`, 409 resync on every `drizzle-kit push` column change (05 §1–3, §6, §8; 01 §3) | ✅ none on Neon | ❌ same logical-replication footprint (05 §3; 04 §7) | ⚠️ Redis/Upstash + Fluid required |
| Cost at our scale / month | ✅ Free tier covers 200 conns / 6 M msgs; Standard ≈ $31–36 if needed (04 §1) | ❌ Neon Launch ≈ $20 (prod always-on) + Electric host (Render/Fly disk) + dev-branch double; Cloud unavailable (05 §3, 01 §4) | ✅ same as O1 | ⚠️ PowerSync Free may fit; + Neon $20–41 always-on (04 §4, 05 §3) | ✅ ≈ $5–15 + engineering (04 §8) |
| Maturity / vendor risk | ✅ Ably GA; SDK 2.28; hooks unlabeled-stable (04 §1) | ⚠️ sync service 1.8.0 GA, but vendor absorbed into Databricks 2026-08-11, Cloud shut, roadmap for standalone Postgres sync unstated, #4770 unanswered; TanStack DB **beta** with breaking minors (01 §9, 02 §1, §8) | ⚠️ TanStack DB beta, SSR 3 weeks old, Next.js issues #545/#1016 open (02 §5) | ⚠️ PowerSync GA; Zero 1.9 "stable" but hosted pricing unpublished (04 §4–5) | ⚠️ Vercel WebSockets public beta since 2026-06-22 (04 §2) |
| Migration effort | **S** — SDK installed, spec approved, phases #179–#184 written | **L** — read model, auth model, write model (`pg_current_xact_id` per mutation), infra, Neon plan | **M** — adds a client store layer; no infra | **L** | **M** |
| **R8** optimistic UI | ⚠️ React Query optimistic updates per mutation (existing `query-toolkit.md` pattern) | ✅ built into TanStack DB collections + `awaitTxId` (02 §4) | ✅ `queryCollectionOptions` optimistic mutations over tRPC (02 §2, §4) | ✅ | ⚠️ |

## 7. Decision (proposed — needs owner sign-off)

**Do not adopt Electric SQL now. Proceed with the approved Ably kernel (Epic #178), amended as in §7.1, and record explicit re-open triggers (§7.2).**

Why, in order of weight:

1. **It does not solve the problem we actually have.** Electric moves raw single-table rows. Our dashboard renders tRPC read models that are 41 % server-computed and whose row visibility is a correlated `EXISTS` on `meeting_participants` for every core entity. Adopting Electric means re-expressing visibility per table in the proxy's `where` (only `IN (SELECT …)` is allowed), denormalising the phone mask, rebuilding every join client-side in a beta library, and returning `pg_current_xact_id()` from every mutation. That is a rewrite of the read and auth layers, not a transport swap (`research/01` §10, `research/03` Verdict inputs).
2. **The hosted product is gone and the vendor's direction is unstated.** Electric joined Databricks on 2026-08-11; *"Electric Cloud is winding down."* Self-hosting an Elixir service with a persistent disk on a second platform violates R5 and adds an ops surface we do not have today (`research/01` §4, §9).
3. **The Neon side is expensive and irreversible for us.** We are on the Free plan. Logical replication is project-level, cannot be reverted, restarts every compute, and any connected subscriber pins prod always-on (≈ 186 CU-h/month vs ≈ 51 today) — the Free allowance runs out in ~17 days. A paid Neon plan plus an Electric host is the entry price for a feature the Ably free tier already covers (`research/05` §1, §3).
4. **The one thing Electric does better — capturing non-client writes (R2) — has a cheaper answer.** Publish after commit from the write path, audit the raw writers, and keep a coarse `refetchInterval` safety net on the hot views. At 8 users and ~257 meetings this is a solved problem without WAL access.

What Electric *would* have bought us, honestly: a durable, resumable, CDN-cacheable per-table change log that catches every writer including manual SQL, plus TanStack DB's optimistic-mutation ergonomics. None of that is on the critical path for "two agents see each other's edits".

### 7.1 Amendments to the Ably kernel spec (carry into #179/#180 planning)

These come straight from the repo findings and change nothing in the spec's decisions log (§15); they tighten §6 "Server publish API" and §11 "Migration plan".

- **A1 — Publish after commit, not from CRUD after-hooks.** The after-hooks at `create-crud-dal.ts:118/190/237` run inside the threaded transaction; a client that refetches on the ping can read pre-commit state. Collect publish intents on `ctx` during the tx and flush them in the `withTx` helper (`src/shared/dal/server/lib/helpers.ts:65-84`) after commit; non-tx callers flush immediately. Fire-and-forget semantics (spec §6) still apply after the flush.
- **A2 — R2 coverage is a writer audit, not a hook.** The spec's "where callers live" (§6) assumed the CRUD seam is universal. It is not: `research/03` §3 lists the raw writers (`meeting_participants` entirely, GCal inbound sync, DNC/measurement, `customer_profiles` upserts, proposal rollup / cash-in-deal / AI summary, `proposal_incentives`, `proposal_views`, project stage drag, `activities`, media status) and the `SYSTEM_CONTEXT` jobs/webhooks. Phase 1/2 must add publish calls at those DAL mutation sites (entity-owns-mutations) and add an ESLint boundary rule (same mechanism as #255) that forbids `db.update/insert/delete` on registered tables outside the entity DAL.
- **A3 — Safety net for anything the audit misses.** Hot views (`getByIdWithJoins`, `getCustomerProfile`, `getCustomerPipelineItems`, dashboard) get a `refetchInterval` of 60 s while mounted and focused, on top of `refetchOnWindowFocus` and Ably `rewind: 2m` (spec §7). Cost at our scale is negligible; correctness never depends on the ping (decision 9).
- **A4 — Delete `NEXT_PUBLIC_ABLY_API_KEY` in Phase 0** (spec decision 3) — confirmed still in the browser at `src/shared/services/providers/upstash/realtime-client.ts`.
- **A5 — Provider home.** Spec §0 says rename `src/shared/services/upstash/` → `services/ably/`; the code has since moved to `src/shared/services/providers/upstash/`. Phase 0 creates `providers/ably/client.ts` as the sole entrypoint (memory `project-provider-boundaries`, #250) — coordinate, do not duplicate.
- **A6 — Optimistic UI stays on React Query** for now. Re-evaluate `@tanstack/query-db-collection` (O3) only after TanStack DB ships 1.0 and the Next.js SSR issues (#545, #1016) close; it is additive and does not change the transport.

### 7.2 Re-open triggers for a sync engine (any one → revisit this PRD)

- Neon ships **native realtime sync** for Neon Postgres (the Neon↔Electric guide now carries the banner *"Real-time sync is coming to Neon Postgres"*) — this would remove the self-host, always-on and irreversibility costs in one move.
- We move to a paid Neon plan for unrelated reasons **and** a product requirement appears for offline-first or local-first data (field agents without signal).
- The writer audit (A2) proves unmaintainable — more than a handful of R2 misses per quarter.
- TanStack DB reaches 1.0 with stable Next.js SSR.

## 8. Open questions for the owner

- Q1 — Which Vercel plan, and is Fluid Compute on? (Only matters for O5; the decision above does not depend on it.)
- Q2 — Confirm we stay on Neon Free for now. If a paid plan is already planned, the O2 cost row weakens but the R3/R5 arguments stand.
- Q3 — Sign off on §7 and the six amendments, or name which to re-debate. Then #179 (Phase 0) can be planned with `superpowers:writing-plans` against `reference/2026-04-19-ably-realtime-kernel-design.md` + §7.1.
- Q4 — Presence (use case E) and notifications (F): keep in the epic as Phases 4–5, or cut from v1?

## 9. Staleness pings raised during this research (per CLAUDE.md)

- ⚠️ `docs/permissions/visibility-rules-catalog.md` Part 3 "Sub-entities" says `proposal_media_files` / `media_files` have no server spec and an `authz.ts` probe. Code now has both specs with a `parent` bridge (`src/shared/entities/proposal-media-files/lib/server-spec.ts:38-48`, `src/shared/entities/media-files/lib/server-spec.ts:37-47`); `authz.ts` no longer exists. Project-media router still runs unscoped (`projects.router/media.router.ts:16-60`, acknowledged in the spec comment).
- ⚠️ Memory `project-crud-mutation-standardization` ("mutations always route through CRUD (hooks fire)") reads as if the CRUD seam were universal. Code shows the raw writers listed in A2. Either the memory should say "generic CRUD when it covers the mutation; bespoke DAL mutations otherwise", or those writers are drift. Owner call.
- ⚠️ Ably spec §0 paths (`src/shared/services/upstash/`, `meetings.router.ts:211-212`) have moved to `src/shared/services/providers/upstash/` and `meetings/dal/server/crud.ts:144` + `meeting-flow.router.ts:51`. The spec is historical; the PRD §1 table is current.
- ⚠️ `research/03` also notes `getCustomerProfile` returns all child rows unscoped and the pipeline projects branch is wider than canonical (`get-customer-pipeline-items.ts:367`) — both already on the CASL Phase 5 / #285 radar, not new.

## 10. Research index

- `research/01-electric-sql.md` — Electric SQL primary-source findings (architecture, shapes, WHERE subset, Neon requirements, auth proxy, writes, Databricks acquisition)
- `research/02-tanstack-db.md` — TanStack DB + `@tanstack/electric-db-collection` / `@tanstack/query-db-collection`, Next.js SSR status
- `research/03-repo-read-models-and-seams.md` — 29 read models classified; visibility expressibility; write seam + raw writers; Ably footprint; schema/runtime facts
- `research/04-alternatives-and-platform-constraints.md` — Ably pricing, Vercel WebSockets/SSE limits, LISTEN/NOTIFY on Neon, PowerSync, Zero, pub-sub SaaS, comparison table
- `research/05-neon-logical-replication-ops.md` — enabling logical replication on Neon: irreversibility, always-on compute, Free-plan exhaustion, 40-h slots, DDL, branches, failure modes
- `reference/2026-04-19-ably-realtime-kernel-design.md` + `-handoff.md` — the approved Ably kernel spec (restored from git `4820b043d`)
