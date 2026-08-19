# CASL Phase 5 — Customer-Pipelines Actor Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the `ctx.actor` seam end-to-end on the customer-pipelines feature (list + profile) — actor rides the shared `ScopedContext` into the DAL, pipelines derive from meeting outcomes (not stored columns), and phone-gating reads the actor.

**Architecture:** Add `actor: Actor` to the shared `ScopedContext` (built once in `protectedProcedure` / context builders), so every DAL callee already knows *who is invoking* without rebuilding it. Rewrite the customer pipeline classifier to derive purely from `meetings.meetingOutcome` + project existence (dropping the write-orphaned `customers.pipeline` and the redundant `meetings.pipeline` read at customer grain). Cut the customer-pipelines list + profile DALs over to `resolveActorScope(spec, ctx.actor)` (customer-grain selection + per-entity enrichment scope), collapse the three leads predicates into one, and re-type phone-gating onto the actor.

**Tech Stack:** TypeScript, tRPC, Drizzle (Postgres/Neon), `@casl/ability` 6.8.0 + `@casl/ability/extra` (`rulesToAST`) → ucast AST → Drizzle scope interpreter.

**Spec:** `docs/superpowers/specs/2026-08-10-casl-scope-compiler-design.md` (§3 Actor, §4 sentinels/compile, §5 spec/verbOnly, §6 point-probe, §9 phone). Epic tracker: `docs/plans/2026-08-10-casl-scope-compiler-epic.md`. Design checkpoint: `memory/project-casl-phase-5-customer-pipelines.md`; canonical classification: `memory/project-pipelines-domain-rethink.md`.

## Global Constraints

- **No test runner.** NEVER add `.test.ts`, NEVER `pnpm build`. Verify EVERY task with `pnpm tsc && pnpm lint` (both green) plus, where behavior changes, an `EXPLAIN`/`EXPLAIN ANALYZE` parity check or an **uncommitted** scratch `tsx` probe under `scripts/tmp-phase5-*.ts` (repo convention; each such script starts with `import './lib/load-env'`, NOT `'dotenv/config'`). Delete scratch scripts before the step's commit (they stay uncommitted).
- **Commit only on explicit user approval.** Each task ends with a *prepared* commit command, but do NOT run it until the user says so. Stage by explicit path — NEVER `git add -A`. Never stage `CLAUDE.local.md`.
- **DB writes:** dev only (`pnpm db:push:dev`). No schema columns are added or dropped in this plan — physical `customers.pipeline` / `meetings.pipeline` drops are DEFERRED (see `project-pipelines-domain-rethink`). This plan changes *reads*, not DDL.
- **The generic CRUD factory stays permission-agnostic.** `src/shared/dal/server/lib/create-crud-dal.ts` MUST NOT be edited and MUST NOT read `ctx.actor` — it reads `ctx.scope` only (sub-plan A rebase seam is byte-stable). Only bespoke feature/entity DALs read `ctx.actor`.
- **Merge policy:** this is one step of the in-worktree permissions overhaul; do NOT merge to main at the end of this plan. Integration/merge happens once, after the whole overhaul + a full E2E pass.
- **Ubiquitous language:** use canonical pipeline names exactly — `projects | fresh | leads | rehash | dead` (`docs/ubiquitous-language.md`).

---

## File Structure

**Step 0 — Actor on ScopedContext (foundation):**
- Modify: `src/shared/domains/permissions/scope/system-reasons.ts` — add a `legacy:system-context` reason.
- Modify: `src/shared/dal/server/types.ts` — add `actor: Actor` to `ScopedContext`; wire `SYSTEM_CONTEXT` + `systemContext()`.
- Modify: `src/trpc/types.ts` — add `actor` to `BaseTRPCContext` (`Actor | null`) + `AuthedContext` (`Actor`).
- Modify: `src/trpc/lib/create-http-context.ts` — `actor: null` at base.
- Modify: `src/trpc/init.ts` — `protectedProcedure` builds `userActor`.
- Modify: `src/shared/dal/server/lib/helpers.ts` — `buildUserContext` sets `actor`.
- Modify (type-forced literal fixes): `src/trpc/lib/middleware/shareable-middleware.ts`, `src/app/api/proposals/[proposalId]/pdf/route.ts`, `src/app/api/proposals/[proposalId]/summary/route.ts`, `src/trpc/routers/proposals.router/views.router.ts`, `src/trpc/routers/customer-pipelines.router.ts`, `src/trpc/routers/meeting-flow.router.ts`.

**Step 1 — Outcome-derived pipeline canonicalization:**
- Modify: `src/shared/constants/enums/meetings.ts` — add the orthogonal `RECALLABLE_OUTCOMES` / `TERMINAL_OUTCOMES` split + exhaustiveness assert.
- Modify: `src/shared/domains/pipelines/lib/outcome-pipeline-map.ts` — derive `OUTCOME_PIPELINE_MAP` from the canonical split (corrects `not_good`/`ftd` → `dead`).
- Modify: `src/shared/entities/customers/lib/derived-pipeline-sql.ts` — rewrite `derivedPipelineSql()` to classify from outcomes + project existence.
- Modify (docs): `src/shared/entities/customers/DOCS.md`, `src/shared/entities/meetings/DOCS.md`.

**Step 2 — Leads collapse:**
- Modify: `src/shared/entities/customers/dal/server/visibility.ts` — delete `leadsPoolVisibility()`.

**Step 3 — customer-pipelines cutover:**
- Modify: `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` — actor-scope selection + per-entity enrichment scope; single-bucket via `derivedPipelineWhere([tab])`.
- Modify: `src/features/customer-pipelines/dal/server/get-customer-profile.ts` — actor-grain by-id gate + entity-grain enrichment.
- Modify: `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts` — actor cutover.
- Modify: `src/trpc/routers/customer-pipelines.router.ts` — pipeline-access guard + pass `ctx` (actor) to DALs; handlers → `ctx.actor`.

**Step 4 — Phone cutover:**
- Modify: `src/shared/entities/customers/lib/phone-gating-sql.ts` — `canSeeUngatedPhone(actor: Actor)`.
- Modify all callers: `src/shared/entities/meetings/dal/server/queries.ts`, `src/shared/entities/customers/dal/server/queries.ts`, `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts`, `src/trpc/routers/dashboard.router.ts`, `src/trpc/routers/customers.router/business.router.ts`, `src/trpc/routers/customer-pipelines.router.ts`.

---

## Task 0: Actor on ScopedContext (the seam)

**Files:**
- Modify: `src/shared/domains/permissions/scope/system-reasons.ts`
- Modify: `src/shared/dal/server/types.ts:32-59`
- Modify: `src/trpc/types.ts:43-60`
- Modify: `src/trpc/lib/create-http-context.ts:19-26`
- Modify: `src/trpc/init.ts:45-61`
- Modify: `src/shared/dal/server/lib/helpers.ts:64-76`
- Modify: `src/trpc/lib/middleware/shareable-middleware.ts:44`
- Modify: `src/app/api/proposals/[proposalId]/pdf/route.ts:27`, `.../summary/route.ts:31`
- Modify: `src/trpc/routers/proposals.router/views.router.ts:50`
- Modify: `src/trpc/routers/customer-pipelines.router.ts:147`, `src/trpc/routers/meeting-flow.router.ts:52`

**Interfaces:**
- Consumes: `Actor`, `userActor`, `systemActor` from `@/shared/domains/permissions/scope/actor`; `SystemReason` from `.../scope/system-reasons`.
- Produces:
  - `ScopedContext.actor: Actor` (required, non-null — every DAL entry has a resolved actor).
  - `BaseTRPCContext.actor: Actor | null`; `AuthedContext.actor: Actor` (non-null after `protectedProcedure`).
  - `SYSTEM_CONTEXT.actor === systemActor('legacy:system-context')`; `systemContext(reason).actor === systemActor(reason)`; `buildUserContext(...).actor === userActor(userId, ability)`.

- [ ] **Step 1: Add the legacy SystemReason variant**

In `src/shared/domains/permissions/scope/system-reasons.ts`, extend the union:

```ts
export type SystemReason
  // A server-derived id from an already scope-authorized read (transitive write).
  = | 'derived:contract-age-from-token-proposal'
    // The bare SYSTEM_CONTEXT default — unclassified legacy privileged access.
    // Every NEW privileged call site should use systemContext(<specific reason>);
    // this variant exists only so SYSTEM_CONTEXT carries a real systemActor.
    // Retired in Phase 8 (see epic Retiring-Seams Register).
    | 'legacy:system-context'
```

- [ ] **Step 2: Add `actor` to `ScopedContext` and wire the system contexts**

In `src/shared/dal/server/types.ts`, add the import and the field. At the top with the other type imports:

```ts
import type { Actor } from '@/shared/domains/permissions/scope/actor'
```

Add a value import (near the other value imports; `systemActor` is a runtime constructor):

```ts
import { systemActor } from '@/shared/domains/permissions/scope/actor'
```

Extend the interface (append `actor` after `scope`):

```ts
export interface ScopedContext {
  session: BetterAuthSession | null
  ability: AppAbility | null
  scope: SQL | null
  /**
   * WHO is invoking this — the source of truth from which `scope` is derived
   * (spec §3). Always non-null at a DAL entry: every construction site stamps a
   * real actor (userActor / tokenActor / systemActor). `scope` remains the
   * pre-resolved cache the permission-agnostic CRUD factory consumes; bespoke
   * DALs may read `actor` directly (resolveActorScope / canAccess / phone gate).
   */
  actor: Actor
}
```

Set `actor` on both system contexts:

```ts
export const SYSTEM_CONTEXT: ScopedContext = {
  session: null,
  ability: null,
  scope: null,
  actor: systemActor('legacy:system-context'),
}
```

```ts
export function systemContext(reason: SystemReason): ScopedContext {
  return { session: null, ability: null, scope: null, actor: systemActor(reason) }
}
```

(Delete the now-unnecessary `void reason` line — `reason` is consumed by `systemActor`.)

- [ ] **Step 3: Run tsc to enumerate the type-forced construction sites**

Run: `pnpm tsc`
Expected: FAIL — one error per `ScopedContext`/context literal missing `actor`. Use this list as the worklist for Steps 4–9. Expected sites: `trpc/init.ts` (protectedProcedure), `dal/server/lib/helpers.ts` (buildUserContext), `trpc/lib/create-http-context.ts` + `trpc/types.ts` (base nullable), `shareable-middleware.ts`, the two proposal PDF/summary routes, `views.router.ts`, `customer-pipelines.router.ts:147`, `meeting-flow.router.ts:52`.

- [ ] **Step 4: Add `actor` to the tRPC context types**

In `src/trpc/types.ts`, import the type and extend both interfaces:

```ts
import type { Actor } from '@/shared/domains/permissions/scope/actor'
```

`BaseTRPCContext` — nullable at the public boundary:

```ts
export interface BaseTRPCContext {
  session: BetterAuthSession | null
  ability: AppAbility | null
  scope: SQL | null
  actor: Actor | null
}
```

`AuthedContext` — non-null after protection:

```ts
export type AuthedContext = BaseTRPCContext & {
  session: BetterAuthSession
  ability: AppAbility
  scope: SQL | null
  actor: Actor
}
```

- [ ] **Step 5: Set `actor: null` at the HTTP context base**

In `src/trpc/lib/create-http-context.ts`, add `actor: null` to the returned object:

```ts
  return {
    session,
    ability: null,
    scope: null,
    actor: null,
    req: ctx.req,
    resHeaders: ctx.resHeaders,
  }
```

- [ ] **Step 6: Build the user actor in `protectedProcedure`**

In `src/trpc/init.ts`, add the import:

```ts
import { userActor } from '@/shared/domains/permissions/scope/actor'
```

Change the `protectedProcedure` `next` call to stamp the actor (ability is already computed just above):

```ts
  return await next({
    ctx: { ...ctx, session: ctx.session, ability, scope: null, actor: userActor(ctx.session.user.id, ability) },
  })
```

(`agentProcedure` / `superAdminProcedure` inherit it via `...ctx` — no change.)

- [ ] **Step 7: Set `actor` in `buildUserContext`**

In `src/shared/dal/server/lib/helpers.ts`, add the import:

```ts
import { userActor } from '@/shared/domains/permissions/scope/actor'
```

Set `actor` on the returned context:

```ts
  return {
    session: { user: { id: userId, role: userRole } } as ScopedContext['session'],
    ability,
    scope: isOmni ? null : resolveEffectiveScope(spec, { userId, ability }),
    actor: userActor(userId, ability),
  }
```

- [ ] **Step 8: Fix the base-nullable middleware literal**

In `src/trpc/lib/middleware/shareable-middleware.ts`, the object at line ~44 constructs a base context with `ability: null`. Add `actor: null` alongside it (this is a pre-narrow public-token base; the token actor is born at its own seam in Phase 6):

```ts
      ability: null,
      actor: null,
```

- [ ] **Step 9: Fix the actor-bearing literals (token + inline user contexts)**

Each of these already builds an `actor` local (a `tokenActor` or `userActor`) to compute `scope` — just thread it into the literal.

`src/app/api/proposals/[proposalId]/pdf/route.ts:27` and `.../summary/route.ts:31`:

```ts
    { session: null, ability: null, scope: resolveActorScope(proposalServerSpec, actor), actor },
```

`src/trpc/routers/proposals.router/views.router.ts:50`:

```ts
        { session: null, ability: null, scope: resolveActorScope(proposalServerSpec, actor), actor },
```

`src/trpc/routers/customer-pipelines.router.ts:147` (assignToProject — `actor` local already exists):

```ts
        { session: ctx.session, ability: ctx.ability, scope: resolveActorScope(meetingServerSpec, actor), actor },
```

`src/trpc/routers/meeting-flow.router.ts:52`:

```ts
        { session: ctx.session, ability: ctx.ability, scope: resolveActorScope(customerServerSpec, actor), actor },
```

- [ ] **Step 10: Verify green**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. `git grep -n "create-crud-dal" -- src/shared/dal/server/lib/create-crud-dal.ts` unchanged (factory untouched). Confirm the factory never reads actor:

Run: `git grep -n "ctx.actor" -- src/shared/dal/server/lib/create-crud-dal.ts`
Expected: no output (agnostic factory preserved).

- [ ] **Step 11: Commit (await user approval before running)**

```bash
git add src/shared/domains/permissions/scope/system-reasons.ts \
  src/shared/dal/server/types.ts src/trpc/types.ts \
  src/trpc/lib/create-http-context.ts src/trpc/init.ts \
  src/shared/dal/server/lib/helpers.ts \
  src/trpc/lib/middleware/shareable-middleware.ts \
  src/app/api/proposals/\[proposalId\]/pdf/route.ts \
  src/app/api/proposals/\[proposalId\]/summary/route.ts \
  src/trpc/routers/proposals.router/views.router.ts \
  src/trpc/routers/customer-pipelines.router.ts \
  src/trpc/routers/meeting-flow.router.ts
git commit -m "refactor(permissions): add actor to ScopedContext (Phase 5 seam)"
```

---

## Task 1: Outcome-derived pipeline canonicalization

Pipeline becomes a pure function of `meetings.meetingOutcome` + project existence — no stored `.pipeline` column is read at customer grain. This corrects `OUTCOME_PIPELINE_MAP` (`not_good`/`ftd` are terminal → `dead`, not `rehash`) and co-localizes the outcome taxonomy.

**Files:**
- Modify: `src/shared/constants/enums/meetings.ts:98-121`
- Modify: `src/shared/domains/pipelines/lib/outcome-pipeline-map.ts`
- Modify: `src/shared/entities/customers/lib/derived-pipeline-sql.ts:26-42`
- Modify: `src/shared/entities/customers/DOCS.md`, `src/shared/entities/meetings/DOCS.md`

**Interfaces:**
- Consumes: `MEETING_OUTCOME_SENTIMENT`, `MeetingOutcome` (existing).
- Produces:
  - `RECALLABLE_OUTCOMES: readonly MeetingOutcome[]` = `['cancelled','no_show','pns','npns','nra']`
  - `TERMINAL_OUTCOMES: readonly MeetingOutcome[]` = `['lost_to_competitor','not_good','ftd']`
  - `POSITIVE_OUTCOMES: readonly MeetingOutcome[]` = `['converted_to_project','additional_work']`
  - `OUTCOME_PIPELINE_MAP` unchanged shape (`Record<string, MeetingPipeline | null>`) but recallable→`rehash`, terminal→`dead`, else `null`.
  - `derivedPipelineSql(): SQL<Pipeline>` — same signature, new body (classifies from outcomes); `derivedPipelineWhere(values)` unchanged signature.

- [ ] **Step 1: Add the orthogonal negative split + exhaustiveness guard**

In `src/shared/constants/enums/meetings.ts`, directly after `MEETING_OUTCOME_SENTIMENT` (and its `isNegativeOutcome`), add:

```ts
/**
 * Orthogonal sub-classification of the NEGATIVE outcomes (kept SEPARATE from
 * sentiment on purpose — sentiment stays the 4-value canonical classifier that
 * `isNegativeOutcome`/`outcomeRequiresReason` depend on). Splits "lost" into:
 *
 * - RECALLABLE — hope remains; re-engage later → the customer's pipeline is `rehash`.
 * - TERMINAL   — dead for good; no re-engage → the customer's pipeline is `dead`.
 *
 * Pipeline derivation (customer + meeting grain) reads THESE sets — see
 * domains/pipelines/lib/outcome-pipeline-map.ts and
 * entities/customers/lib/derived-pipeline-sql.ts. Abbrev meanings live in
 * memory/reference-meeting-outcome-abbreviations.md.
 */
export const RECALLABLE_OUTCOMES = ['cancelled', 'no_show', 'pns', 'npns', 'nra'] as const satisfies readonly MeetingOutcome[]
export const TERMINAL_OUTCOMES = ['lost_to_competitor', 'not_good', 'ftd'] as const satisfies readonly MeetingOutcome[]

/** Revenue outcomes — pull a customer into the `projects` pipeline. */
export const POSITIVE_OUTCOMES = ['converted_to_project', 'additional_work'] as const satisfies readonly MeetingOutcome[]

// Compile-time guard: RECALLABLE ∪ TERMINAL must EQUAL the negatives, with no
// overlap. If a negative outcome is added/removed and not classified here, this
// line becomes a type error (the check evaluates to `false`, unassignable to `true`).
const _negativesFullyPartitioned: true = (
  RECALLABLE_OUTCOMES.length + TERMINAL_OUTCOMES.length
  === meetingOutcomes.filter(isNegativeOutcome).length
) as true
void _negativesFullyPartitioned
```

> Note: `meetingOutcomes` and `isNegativeOutcome` are already declared above this point in the file, so they're in scope. The runtime guard (`length` equality) plus the `satisfies readonly MeetingOutcome[]` on each array together catch both a miscategorized outcome and a new unclassified negative.

- [ ] **Step 2: Verify the guard actually holds for today's outcomes**

Run: `pnpm tsc`
Expected: PASS (5 recallable + 3 terminal = 8 negatives). If it FAILS on `_negativesFullyPartitioned`, an outcome is miscategorized — fix the arrays, do not weaken the guard.

- [ ] **Step 3: Rebuild `OUTCOME_PIPELINE_MAP` from the canonical split**

Replace the whole body of `src/shared/domains/pipelines/lib/outcome-pipeline-map.ts`:

```ts
import type { MeetingOutcome, MeetingPipeline } from '@/shared/constants/enums'

import { meetingOutcomes, RECALLABLE_OUTCOMES, TERMINAL_OUTCOMES } from '@/shared/constants/enums/meetings'

/**
 * Outcome → the meeting-grain pipeline bucket it forces (`rehash`/`dead`), or
 * `null` for outcomes that don't move the bucket (unset/neutral/positive).
 * DERIVED from the canonical taxonomy so it can never drift from
 * RECALLABLE/TERMINAL — recallable ⇒ rehash, terminal ⇒ dead, else null.
 *
 * NOTE the corrected mapping vs the pre-Phase-5 hand-written map: `not_good`
 * and `ftd` are TERMINAL → `dead` (previously mis-mapped to `rehash`).
 */
export const OUTCOME_PIPELINE_MAP: Record<string, MeetingPipeline | null> = Object.fromEntries(
  meetingOutcomes.map((o: MeetingOutcome): [MeetingOutcome, MeetingPipeline | null] => {
    if ((RECALLABLE_OUTCOMES as readonly string[]).includes(o))
      return [o, 'rehash']
    if ((TERMINAL_OUTCOMES as readonly string[]).includes(o))
      return [o, 'dead']
    return [o, null]
  }),
)
```

> If `MeetingOutcome`/`MeetingPipeline` are not both re-exported from `@/shared/constants/enums`, import them from `@/shared/constants/enums/meetings` and `.../pipelines` respectively — confirm with `git grep -n "export type MeetingPipeline" src/shared/constants/enums`.

- [ ] **Step 4: Confirm the correction reaches the meeting-grain materializer**

`src/shared/entities/meetings/dal/server/crud.ts:81` writes `meetings.pipeline = OUTCOME_PIPELINE_MAP[outcome]` on update. With the corrected map, a `not_good`/`ftd` meeting now materializes `pipeline='dead'` (was `'rehash'`). This is the intended correction. No code change here — just verify the read still compiles:

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Rewrite `derivedPipelineSql()` to classify from outcomes**

Replace `derivedPipelineSql` in `src/shared/entities/customers/lib/derived-pipeline-sql.ts` (keep `derivedPipelineWhere` as-is). Add the outcome-set import and build the CASE:

```ts
import { POSITIVE_OUTCOMES, RECALLABLE_OUTCOMES } from '@/shared/constants/enums/meetings'
```

```ts
// Outer-customer-correlated EXISTS probes. Literal `"customers"."id"` (not
// ${customers.id}) so drizzle doesn't emit a bare, ambiguous "id" inside the
// subquery — same pattern as phone-gating-sql.ts.
const EXISTS_PROJECT = sql`EXISTS (SELECT 1 FROM projects p WHERE p.customer_id = "customers"."id")`
const EXISTS_MEETING = sql`EXISTS (SELECT 1 FROM meetings m WHERE m.customer_id = "customers"."id")`
const EXISTS_POSITIVE_MEETING = sql`EXISTS (
  SELECT 1 FROM meetings m
  WHERE m.customer_id = "customers"."id"
    AND m.meeting_outcome IN (${sql.join(POSITIVE_OUTCOMES.map(o => sql`${o}`), sql`, `)})
)`
// "≥1 meeting whose outcome is NOT negative" — i.e. any unset/neutral/positive
// outcome. Positive is caught earlier by the projects arm, so at the `fresh`
// arm this effectively means "≥1 unset/neutral meeting".
const EXISTS_NON_NEGATIVE_MEETING = sql`EXISTS (
  SELECT 1 FROM meetings m
  WHERE m.customer_id = "customers"."id"
    AND m.meeting_outcome NOT IN (${sql.join(
      [...RECALLABLE_OUTCOMES, ...TERMINAL_OUTCOMES].map(o => sql`${o}`),
      sql`, `,
    )})
)`
const EXISTS_RECALLABLE_MEETING = sql`EXISTS (
  SELECT 1 FROM meetings m
  WHERE m.customer_id = "customers"."id"
    AND m.meeting_outcome IN (${sql.join(RECALLABLE_OUTCOMES.map(o => sql`${o}`), sql`, `)})
)`

/**
 * Select-column SQL returning the 5-bucket pipeline for the outer `customers`
 * row, derived PURELY from meeting outcomes + project existence (no stored
 * `.pipeline` column). Priority-ordered, first-match, total:
 *   projects — has a project OR ≥1 positive outcome
 *   leads    — no meetings
 *   fresh    — ≥1 non-negative meeting (no positive/no project by prior arms)
 *   rehash   — all meetings negative, ≥1 recallable (mixed recallable+terminal → rehash)
 *   dead     — all meetings negative, all terminal
 * see ../DOCS.md#derived-5-bucket-pipeline
 */
export function derivedPipelineSql() {
  return sql<Pipeline>`CASE
    WHEN ${EXISTS_PROJECT} OR ${EXISTS_POSITIVE_MEETING} THEN 'projects'
    WHEN NOT ${EXISTS_MEETING} THEN 'leads'
    WHEN ${EXISTS_NON_NEGATIVE_MEETING} THEN 'fresh'
    WHEN ${EXISTS_RECALLABLE_MEETING} THEN 'rehash'
    ELSE 'dead'
  END`
}
```

Remove the now-unused `import { customers }` line **only if** nothing else in the file references `customers` (the new body doesn't). Keep `TERMINAL_OUTCOMES` import if referenced; here it's used inline via the spread, so import it too:

```ts
import { POSITIVE_OUTCOMES, RECALLABLE_OUTCOMES, TERMINAL_OUTCOMES } from '@/shared/constants/enums/meetings'
```

- [ ] **Step 6: EXPLAIN + classification parity probe (dev DB)**

Write an uncommitted `scripts/tmp-phase5-classify.ts` that prints, for a spread of seeded customers, the derived bucket and asserts the canonical rules by hand-reconstructing from their meetings' outcomes:

```ts
import './lib/load-env'
import { sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { derivedPipelineSql } from '@/shared/entities/customers/lib/derived-pipeline-sql'

async function main() {
  const rows = await db
    .select({ id: customers.id, name: customers.name, bucket: derivedPipelineSql() })
    .from(customers)
    .orderBy(sql`bucket`)
  const counts = rows.reduce<Record<string, number>>((a, r) => ((a[r.bucket] = (a[r.bucket] ?? 0) + 1), a), {})
  console.log('bucket counts:', counts)
  // Spot-print a few of each bucket for manual outcome cross-check.
  for (const b of ['leads', 'fresh', 'projects', 'rehash', 'dead']) {
    console.log(b, rows.filter(r => r.bucket === b).slice(0, 3).map(r => r.name))
  }
}
main().then(() => process.exit(0))
```

Run: `pnpm tsx scripts/tmp-phase5-classify.ts`
Expected: every customer lands in exactly one bucket; totals equal `SELECT count(*) FROM customers`. Manually confirm a known rehash customer (recallable-only meetings) reads `rehash` and a `not_good`/`ftd`-only customer reads `dead`. If dev data is thin, seed a couple of meetings with those outcomes first (`pnpm db:seed:dev` or a scratch insert), then re-run. Delete the scratch script after.

- [ ] **Step 7: Re-verify the 6 `derivedPipelineSql`/`derivedPipelineWhere` consumers still typecheck and read sanely**

The consumers are: the `inDerivedPipeline` scope operator (`operators/derived-pipeline.ts`), `lead-sources.router.ts`, `customers.router/business.router.ts`, `voip-campaign-contacts/{dal/server/queries.ts, lib/lead-campaign-status.ts}`, `customers/dal/server/queries.ts`, `services/voip/campaigns/lib/eligibility.ts`. No signature changed, so they compile unchanged — but their RESULT now reflects true rehash/dead (previously always leads/fresh/projects because `customers.pipeline` was write-orphaned). That is the intended fix.

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 8: Update the DOCS that describe the (now-retired) stored-column source of truth**

In `src/shared/entities/customers/DOCS.md#derived-5-bucket-pipeline`: rewrite the section so it states the 5 buckets are derived from `meetings.meetingOutcome` + project existence (priority-ordered, first-match), and DELETE the "⚠️ Stale comment on schema" paragraph plus the `rehash | dead → passthrough (stored on customers.pipeline)` line. Note `customers.pipeline` / `meetings.pipeline` are write-orphaned/materialized-only and slated for a deferred physical drop (link `docs/plans/2026-08-10-casl-scope-compiler-epic.md` + the pipelines-domain-rethink deferral).

In `src/shared/entities/meetings/DOCS.md#meeting-pipeline-storage-vs-derived`: note the meeting-grain `meetings.pipeline` is now a *materialized* projection of `meetingOutcome` (via `OUTCOME_PIPELINE_MAP` in crud.ts) kept only for the meeting-list filter (`queries.ts:134`); customer-grain classification no longer reads it.

- [ ] **Step 9: Commit (await user approval)**

```bash
git add src/shared/constants/enums/meetings.ts \
  src/shared/domains/pipelines/lib/outcome-pipeline-map.ts \
  src/shared/entities/customers/lib/derived-pipeline-sql.ts \
  src/shared/entities/customers/DOCS.md \
  src/shared/entities/meetings/DOCS.md
git commit -m "refactor(pipelines): derive 5-bucket pipeline from meeting outcomes; correct terminal split"
```

---

## Task 2: Leads collapse (3 predicates → 1)

The three ways "is this a leads-pool customer?" is asked collapse onto `derivedPipelineWhere(['leads'])` (= "no meetings"). The dispatcher CASL rule already emits `$inDerivedPipeline:['leads']`, which now routes through the corrected `derivedPipelineSql`.

**Files:**
- Modify: `src/shared/entities/customers/dal/server/visibility.ts:21-27`

**Interfaces:**
- Consumes: `derivedPipelineWhere` (from Task 1).
- Produces: `leadsPoolVisibility` is DELETED. `userCanSeeCustomer` unchanged.

- [ ] **Step 1: Confirm `leadsPoolVisibility` has no remaining readers**

Run: `git grep -n "leadsPoolVisibility" -- 'src/**/*.ts'`
Expected: only its declaration in `visibility.ts`. (Phase 0–4 already routed dispatcher visibility through `$inDerivedPipeline`; the operator emits `derivedPipelineWhere`, not this helper.) If any OTHER reader exists, STOP and convert it to `derivedPipelineWhere(['leads'])` in this task before deleting.

- [ ] **Step 2: Delete `leadsPoolVisibility` and prune now-unused imports**

In `src/shared/entities/customers/dal/server/visibility.ts`, remove the `leadsPoolVisibility` function (lines ~21-27). Then prune imports that only it used: `customers` and `sql` are no longer referenced (the remaining `userCanSeeCustomer` uses `db`, `meetings`, `meetingParticipants`, `and`, `eq`, `exists`). Adjust the top imports accordingly.

- [ ] **Step 3: Verify green**

Run: `pnpm tsc && pnpm lint`
Expected: PASS (lint would flag a leftover unused `customers`/`sql` import — remove if so).

- [ ] **Step 4: EXPLAIN parity — dispatcher leads predicate vs the old pool predicate**

Confirm the CASL dispatcher `$inDerivedPipeline:['leads']` emission is a superset-equal of the old `leadsPoolVisibility` (which added a redundant, write-orphaned `pipeline='active'`). Uncommitted `scripts/tmp-phase5-leads.ts`:

```ts
import './lib/load-env'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { derivedPipelineWhere } from '@/shared/entities/customers/lib/derived-pipeline-sql'

async function main() {
  const q = db.select({ id: customers.id }).from(customers).where(derivedPipelineWhere(['leads']))
  console.log(q.toSQL())
  const rows = await q
  console.log('leads count (derived):', rows.length)
}
main().then(() => process.exit(0))
```

Run: `pnpm tsx scripts/tmp-phase5-leads.ts`
Expected: `leads count` equals `SELECT count(*) FROM customers WHERE NOT EXISTS (SELECT 1 FROM meetings m WHERE m.customer_id = customers.id)`. Confirm that count matches the old `pipeline='active' AND NOT EXISTS meeting` count (they should be identical because `pipeline` is always `'active'`). Delete the scratch script.

- [ ] **Step 5: Commit (await user approval)**

```bash
git add src/shared/entities/customers/dal/server/visibility.ts
git commit -m "refactor(customers): drop leadsPoolVisibility; leads = derivedPipelineWhere(['leads'])"
```

---

## Task 3: customer-pipelines cutover (list + profile + router)

The list and profile DALs move off ad-hoc `userParticipatesInMeeting`/`isOmni`/`viewer` gates onto `resolveActorScope(spec, ctx.actor)`, and the router gains the pipeline-access guard.

**Files:**
- Modify: `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts`
- Modify: `src/features/customer-pipelines/dal/server/get-customer-profile.ts`
- Modify: `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts:32-52`
- Modify: `src/trpc/routers/customer-pipelines.router.ts`

**Interfaces:**
- Consumes: `ScopedContext` (with `actor`, Task 0), `resolveActorScope`/`canAccess` (`@/shared/dal/server/lib/resolve-actor-scope`), `requireResolvedScope` (`.../lib/helpers`), `derivedPipelineWhere` (Task 1), `canSeeUngatedPhone` (re-typed in Task 4 — but this task lands FIRST with the old `ability` signature, then Task 4 flips it; see note), `customerServerSpec`/`meetingServerSpec`/`projectServerSpec`, `getAccessiblePipelines` (`@/shared/domains/pipelines/lib/get-accessible-pipelines`).
- Produces:
  - `getCustomerPipelineItems(ctx: ScopedContext, pipeline?: Pipeline): Promise<CustomerPipelineItem[]>`
  - `getCustomerProfile(ctx: ScopedContext, customerId: string): Promise<CustomerProfileData>`
  - `moveCustomerPipelineItem(ctx: ScopedContext, params: { customerId, fromStage, toStage, pipeline }): Promise<void>`

> **Ordering note:** to keep each task green, this task calls `canSeeUngatedPhone(ctx.ability)` (its CURRENT signature) where it needs the phone flag. Task 4 re-types it to `(actor)` and flips these call sites in the same sweep. The two tasks could also be merged; kept separate for reviewability.

- [ ] **Step 1: Change the list DAL signature + customer-selection scope**

In `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts`, change the entry signature and derive actor-scoped predicates once. Add imports:

```ts
import type { ScopedContext } from '@/shared/dal/server/types'
import { requireResolvedScope } from '@/shared/dal/server/lib/helpers'
import { resolveActorScope } from '@/shared/dal/server/lib/resolve-actor-scope'
import { derivedPipelineWhere } from '@/shared/entities/customers/lib/derived-pipeline-sql'
import { canSeeUngatedPhone } from '@/shared/entities/customers/lib/phone-gating-sql'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
import { projectServerSpec } from '@/shared/entities/projects/lib/server-spec'
```

New entry point (replaces the `userId/isOmni/canSeeUngated` params):

```ts
export async function getCustomerPipelineItems(ctx: ScopedContext, pipeline: Pipeline = 'fresh'): Promise<CustomerPipelineItem[]> {
  const actor = ctx.actor
  const canSeeUngated = canSeeUngatedPhone(ctx.ability) // Task 4 flips to (actor)
  // Customer-grain selection: this actor's visible customers AND in this bucket.
  const customerScope = requireResolvedScope(resolveActorScope(customerServerSpec, actor))
  const inBucket = derivedPipelineWhere([pipeline])

  if (pipeline === 'leads')
    return getLeadsPipelineItems(customerScope, inBucket, canSeeUngated)
  if (pipeline === 'projects')
    return getProjectsPipelineItems(actor, customerScope, inBucket, canSeeUngated)
  if (pipeline !== 'fresh')
    return getRehashOrDeadPipelineItems(actor, customerScope, inBucket, canSeeUngated)
  return getFreshPipelineItems(actor, customerScope, inBucket, canSeeUngated)
}
```

> `resolveActorScope(customerServerSpec, actor)` returns `null` for omni (→ `requireResolvedScope` yields `undefined`, i.e. no restriction), the participation predicate for agents, and `$inDerivedPipeline:['leads']` for dispatchers — all from CASL. `requireResolvedScope` throws if the scope was never resolved (deny-safe).

- [ ] **Step 2: Rewrite each sub-builder to use `customerScope` + `inBucket` (customer grain) and per-entity scope (enrichment)**

For EACH sub-builder, apply this uniform transform:

1. **Customer selection** — replace the tab-specific `.where(...)`/join predicate with `and(customerScope, inBucket, <existing non-visibility filters>)` on the `customers` table. Concretely:
   - `getLeadsPipelineItems`: drop the bespoke `NOT EXISTS (SELECT 1 FROM meetings ...)`; use `.where(and(customerScope, inBucket))` (bucket already = "no meetings").
   - `getRehashOrDeadPipelineItems` / `getFreshPipelineItems`: drop the `innerJoin(meetings, and(eq(meetings.customerId, customers.id), eq(meetings.pipeline, tab), isNull(meetings.projectId), isOmni ? undefined : userParticipatesInMeeting(...)))`. Select FROM `customers` with `.where(and(customerScope, inBucket))`, then LEFT JOIN `meetings` for the aggregates (fresh needs meeting aggregates for stage computation — join `meetings` on `customerId` WITHOUT the pipeline filter, since bucket membership is already decided at customer grain).
   - `getProjectsPipelineItems`: select customers `.where(and(customerScope, inBucket))`, then join projects for display.

2. **Enrichment scope (per entity)** — where a secondary query pulls the customer's meetings/proposals/projects, gate it with that entity's actor scope instead of `isOmni ? undefined : userParticipatesInMeeting(...)`:
   - meeting sub-queries → `requireResolvedScope(resolveActorScope(meetingServerSpec, actor))`
   - project sub-queries → `requireResolvedScope(resolveActorScope(projectServerSpec, actor))`
   - proposal sub-queries → keep transitive (filter by the already-scoped meeting ids), OR `resolveActorScope(proposalServerSpec, actor)` if queried directly.

   Example (fresh builder, the rep sub-query at ~line 206-222):

   ```ts
   // BEFORE
   .where(and(
     inArray(meetings.customerId, customerIds),
     isOmni ? undefined : userParticipatesInMeeting(userId, meetings.id),
   ))
   // AFTER
   .where(and(
     inArray(meetings.customerId, customerIds),
     requireResolvedScope(resolveActorScope(meetingServerSpec, actor)),
   ))
   ```

   Apply the identical swap to the fresh `proposalRows`/`proposalDetailRows` participation gates and the projects builder's `meetingRows` gate. For the projects builder's project-selection participation SQL (`projects.ownerId = userId OR EXISTS ...`), replace with `requireResolvedScope(resolveActorScope(projectServerSpec, actor))` on the `projects` table.

3. Remove the now-unused `userParticipatesInMeeting` import and the `userId`/`isOmni` params from each sub-builder signature (they take `actor, customerScope, inBucket, canSeeUngated`).

> Behavior change (blessed): a customer now appears in EXACTLY ONE tab (bucket is total + mutually exclusive at customer grain), and list visibility is customer-grain (CASL) with per-entity-scoped enrichment — replacing the old per-meeting participation join.

- [ ] **Step 3: Typecheck the list rewrite in isolation**

Run: `pnpm tsc`
Expected: PASS. Resolve any `CustomerPipelineItem` shape mismatches by keeping the existing mapping code (only the *source predicates* change, not the returned shape).

- [ ] **Step 4: Cut over the profile DAL**

In `src/features/customer-pipelines/dal/server/get-customer-profile.ts`, replace the `CustomerProfileViewer` param with `ctx: ScopedContext` and switch the by-id gate + enrichment to actor scope. Add imports:

```ts
import type { ScopedContext } from '@/shared/dal/server/types'
import { requireResolvedScope } from '@/shared/dal/server/lib/helpers'
import { resolveActorScope } from '@/shared/dal/server/lib/resolve-actor-scope'
import { canSeeUngatedPhone } from '@/shared/entities/customers/lib/phone-gating-sql'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
import { projectServerSpec } from '@/shared/entities/projects/lib/server-spec'
```

Delete the `CustomerProfileViewer` interface and the `userCanSeeCustomer` import. New signature + gates:

```ts
export async function getCustomerProfile(ctx: ScopedContext, customerId: string): Promise<CustomerProfileData> {
  const actor = ctx.actor
  const canSeeUngated = canSeeUngatedPhone(ctx.ability) // Task 4 flips to (actor)
  const { phone: _phone, ...customerCols } = getTableColumns(customers)

  const [customerRow] = await db
    .select({ /* ...unchanged select... */ phone: gatedPhoneSql(canSeeUngated) /* ... */ })
    .from(customers)
    .leftJoin(customerProfiles, eq(customerProfiles.customerId, customers.id))
    .leftJoin(customerLeadAttribution, eq(customerLeadAttribution.customerId, customers.id))
    .where(and(
      eq(customers.id, customerId),
      // Point-probe folded into the by-id read: a row-miss under the actor's
      // customer scope IS the NOT_FOUND (no separate canAccess needed). null
      // scope (omni) → undefined → unrestricted.
      requireResolvedScope(resolveActorScope(customerServerSpec, actor)),
    ))

  if (!customerRow)
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' })
  // ...rest unchanged...
```

Then scope the enrichment sub-queries **entity-grain**:
- `meetingRows` (`.from(meetings).where(eq(meetings.customerId, customerId))`) → `.where(and(eq(meetings.customerId, customerId), requireResolvedScope(resolveActorScope(meetingServerSpec, actor))))`.
- `projectRows` (`.from(projects).where(eq(projects.customerId, customerId))`) → add `requireResolvedScope(resolveActorScope(projectServerSpec, actor))`.
- `proposalRows` / `proposalViewRows` — leave transitive: they filter by `meetingRows`/`allProposals` ids, which are now the scoped meetings, so proposals inherit the meeting scope automatically.
- `noteRows`, `enrichment`, `attribution` — customer-grain children; unchanged (the customer row itself already passed the actor gate).

- [ ] **Step 5: Cut over `moveCustomerPipelineItem` to the actor context**

In `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts`, change the signature from the `{ userId, userRole, ... }` bag to `(ctx: ScopedContext, params)`, and replace the three `buildUserContext(userId, userRole, <spec>)` constructions with the passed `ctx` — it already carries `actor`, `ability`, and `session`. Where the current code builds a *spec-specific* scoped ctx (e.g. `buildUserContext(userId, userRole, meetingServerSpec)`) to get `ctx.scope` for a raw pre-read, replace that raw-read scope with `requireResolvedScope(resolveActorScope(<spec>, ctx.actor))` inline, and pass `ctx` to the `*Crud.update` calls. It is already circumstance-based (writes `pipelineStage`/`meetingOutcome`/proposal `status`), so only the context source changes.

```ts
export async function moveCustomerPipelineItem(
  ctx: ScopedContext,
  { customerId, fromStage, toStage, pipeline }: { customerId: string, fromStage: string, toStage: string, pipeline: Pipeline },
): Promise<void> {
  if (pipeline === 'leads') {
    dalVerifySuccess(await customerCrud.update(ctx, { id: customerId, data: { pipelineStage: toStage } }))
    return
  }
  // ...rehash/dead throw unchanged...
  // ...projects branch unchanged (raw db.update on projects.pipelineStage)...
  // For the fresh meeting/proposal transitions, replace the ctx.scope pre-read
  // fragment with resolveActorScope(meetingServerSpec|proposalServerSpec, ctx.actor)
  // and pass ctx to *Crud.update.
}
```

- [ ] **Step 6: Add the API pipeline-access guard + pass actor context in the router**

In `src/trpc/routers/customer-pipelines.router.ts`, add the import:

```ts
import { getAccessiblePipelines } from '@/shared/domains/pipelines/lib/get-accessible-pipelines'
```

`getCustomerPipelineItems` procedure — guard the requested pipeline, then pass `ctx`:

```ts
  getCustomerPipelineItems: agentProcedure
    .input(z.object({ pipeline: z.enum(pipelines).default('fresh') }).optional())
    .query(async ({ ctx, input }) => {
      const pipeline = input?.pipeline ?? 'fresh'
      if (!getAccessiblePipelines(ctx.ability).includes(pipeline)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this pipeline' })
      }
      return getCustomerPipelineItems(ctx, pipeline)
    }),
```

`getCustomerProfile` procedure — pass `ctx`:

```ts
  getCustomerProfile: agentProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .query(async ({ input, ctx }) => getCustomerProfile(ctx, input.customerId)),
```

`moveCustomerPipelineItem` procedure — pass `ctx` + the input bag:

```ts
    .mutation(async ({ ctx, input }) => {
      await moveCustomerPipelineItem(ctx, input)
    }),
```

`getRecordingUrl` / `assignToProject` — replace the inline `userActor(ctx.session.user.id, ctx.ability)` with `ctx.actor`:

```ts
      const actor = ctx.actor
```

`getCustomerProjects` — replace `buildUserContext(ctx.session.user.id, ctx.session.user.role, meetingServerSpec)` with `ctx` (it carries the actor; `meetingCrud.getById` reads `ctx.scope` — but a bespoke read needs the meeting scope, so compute it): pass `{ ...ctx, scope: resolveActorScope(meetingServerSpec, ctx.actor) }` to `meetingCrud.getById`, or keep `buildUserContext` if simpler — but prefer the actor path for consistency. Remove now-unused `buildUserContext`/`userActor` imports if fully replaced.

- [ ] **Step 7: Verify green + guard behavior**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

Uncommitted `scripts/tmp-phase5-list.ts` — build an agent actor, a dispatcher actor, an omni actor, and a system actor, then print `getCustomerPipelineItems(ctx, tab)` counts per tab and confirm: agent sees only participation; dispatcher sees `leads`; omni sees all; requesting an out-of-set tab as an agent (`'leads'`) is rejected at the router (call the router caller, or assert `getAccessiblePipelines(agentAbility)` excludes `'leads'`). Also print `.toSQL()` for the agent fresh query and eyeball that the customer-selection predicate is the CASL participation `EXISTS`, and the enrichment joins carry per-entity `EXISTS`. Delete the scratch script.

- [ ] **Step 8: Commit (await user approval)**

```bash
git add src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts \
  src/features/customer-pipelines/dal/server/get-customer-profile.ts \
  src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts \
  src/trpc/routers/customer-pipelines.router.ts
git commit -m "refactor(customer-pipelines): cut list/profile/move onto ctx.actor scope + pipeline-access guard"
```

---

## Task 4: Phone cutover (canSeeUngatedPhone on the actor)

Re-type the phone gate to take an `Actor` and flip every caller to `ctx.actor` — now possible because `actor` rides `ScopedContext` (Task 0).

**Files:**
- Modify: `src/shared/entities/customers/lib/phone-gating-sql.ts:41-45`
- Modify: `src/shared/entities/meetings/dal/server/queries.ts` (2 sites), `src/shared/entities/customers/dal/server/queries.ts` (1), `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts` (1), `src/trpc/routers/dashboard.router.ts` (1), `src/trpc/routers/customers.router/business.router.ts` (1), `src/trpc/routers/customer-pipelines.router.ts` (the 2 sites touched in Task 3), and the two customer-pipelines DALs (Task 3).

**Interfaces:**
- Consumes: `Actor` (`@/shared/domains/permissions/scope/actor`).
- Produces: `canSeeUngatedPhone(actor: Actor): boolean` — `system`/`token` → `true`; `user` → `actor.ability.can('manage','all') || actor.ability.can('read','LeadsPool')`.

- [ ] **Step 1: Re-type `canSeeUngatedPhone`**

In `src/shared/entities/customers/lib/phone-gating-sql.ts`:

```ts
import type { Actor } from '@/shared/domains/permissions/scope/actor'
```

```ts
/**
 * Ungated-phone policy on the ACTOR (spec §9). Trusted non-user actors
 * (system jobs, homeowner tokens) see raw phone; a `user` actor sees it only
 * when omni (super-admin) or a leads-pool worker (dispatcher). Everyone else is
 * gated behind a sent proposal (`gatedPhoneSql`).
 */
export function canSeeUngatedPhone(actor: Actor): boolean {
  if (actor.kind !== 'user')
    return true // system / token — trusted upstream
  return actor.ability.can('manage', 'all') || actor.ability.can('read', 'LeadsPool')
}
```

- [ ] **Step 2: Run tsc to list the callers**

Run: `pnpm tsc`
Expected: FAIL at each `canSeeUngatedPhone(<ability>)` call. Worklist from `git grep -n "canSeeUngatedPhone(" -- 'src/**/*.ts'`.

- [ ] **Step 3: Flip each caller from ability to actor**

For every call site, replace the argument:
- DAL functions with `ctx: ScopedContext` (`meetings/dal/server/queries.ts` ×2, `customers/dal/server/queries.ts`, `voip-campaign-contacts/dal/server/queries.ts`): `canSeeUngatedPhone(ctx.ability)` → `canSeeUngatedPhone(ctx.actor)`.
- tRPC handlers (`dashboard.router.ts`, `business.router.ts`, and `customer-pipelines.router.ts`): `canSeeUngatedPhone(ctx.ability)` → `canSeeUngatedPhone(ctx.actor)`.
- The two customer-pipelines DALs from Task 3: change `canSeeUngatedPhone(ctx.ability)` → `canSeeUngatedPhone(ctx.actor)`.

- [ ] **Step 4: Verify green + parity**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

Parity: `canSeeUngatedPhone` must return identical results to before for all real callers — the only semantic delta is that `system`/`token` actors now explicitly return `true` (previously `ability === null → true`, same outcome). Confirm with an uncommitted `scripts/tmp-phase5-phone.ts` that builds a super-admin userActor (→ true), a plain agent userActor (→ false), a dispatcher userActor with `read:LeadsPool` (→ true), a systemActor (→ true), and a tokenActor (→ true), printing each. Delete the scratch script.

- [ ] **Step 5: Commit (await user approval)**

```bash
git add src/shared/entities/customers/lib/phone-gating-sql.ts \
  src/shared/entities/meetings/dal/server/queries.ts \
  src/shared/entities/customers/dal/server/queries.ts \
  src/shared/entities/voip-campaign-contacts/dal/server/queries.ts \
  src/trpc/routers/dashboard.router.ts \
  src/trpc/routers/customers.router/business.router.ts \
  src/trpc/routers/customer-pipelines.router.ts
git commit -m "refactor(customers): phone gate reads the actor (canSeeUngatedPhone(actor))"
```

---

## Final Verification (whole plan)

- [ ] `pnpm tsc && pnpm lint` green.
- [ ] `git grep -n "leadsPoolVisibility\|customers\.pipeline" -- 'src/shared/entities/customers' 'src/features/customer-pipelines'` — no live *reads* of the retired column in the pipeline paths (schema column + DOCS deferral note may remain).
- [ ] `git grep -n "ctx.actor" -- src/shared/dal/server/lib/create-crud-dal.ts` — empty (factory still agnostic).
- [ ] `git grep -n "canSeeUngatedPhone(" -- 'src/**/*.ts'` — every call passes an `Actor`, none pass an `AppAbility`.
- [ ] Documented manual-smoke matrix (run in dev with `pnpm dev`, three seeded users): (1) dispatcher opens a lead's profile → succeeds (was P4-a leak-adjacent); (2) an agent sees only participation-visible customers on both list AND profile; (3) a given customer appears in exactly ONE tab; (4) phone gating unchanged for a normal agent (locked until a proposal is sent); (5) an agent calling `getCustomerPipelineItems({ pipeline: 'leads' })` is rejected FORBIDDEN by the API guard.
- [ ] All scratch `scripts/tmp-phase5-*.ts` deleted (uncommitted throughout).
- [ ] Update `memory/project-casl-phase-5-customer-pipelines.md` status → IMPLEMENTED (with the corrected file line refs) and tick the epic tracker's Phase 5 row. **Do NOT merge to main** — integration is one pass after the whole overhaul.
