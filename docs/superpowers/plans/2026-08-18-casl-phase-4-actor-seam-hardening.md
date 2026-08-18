# CASL Phase 4 — Actor-Seam Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four §8 SYSTEM_CONTEXT/token vulnerabilities plus three stable-file IDORs by giving the `system`/`token` actors concrete shape and centralizing scope deny-safety — all on the EXISTING engine surface (`resolveActorScope`/`canAccess`), with no CRUD-contract change.

**Architecture:** Boundary-only. Each §8 site proves one reusable convention (point-probe, tokenActor, named-system write, deny-safe `requireResolvedScope`), then the three stable-file IDORs apply those conventions. No `ctx.actor` additive (that is Phase 5); no `agentProcedure→staffProcedure` rename (Phase 7).

**Tech Stack:** TypeScript, tRPC, Drizzle (Postgres/Neon), CASL (`@casl/ability@6.8.0`), `@ucast`. Package manager pnpm; path alias `@/`→`src/`.

**Spec:** `docs/superpowers/specs/2026-08-10-casl-scope-compiler-design.md` (§3 actor union, §6 point-probe, §8 four vuln closures, §9 phone signature). **Epic + locked conventions:** `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (§"Actor-seam conventions", §"IDOR findings ledger").

## Global Constraints

- **NO test runner.** This repo has no vitest/jest. Verify EVERY task with `pnpm tsc && pnpm lint` (both green). Where a compiled/scoped predicate changes, additionally build a **scratch `tsx`** under the scratchpad (uncommitted) to print/`EXPLAIN` the SQL, and record the evidence in the task's verification note. **Never** add or commit `.test.ts` files.
- **NEVER `pnpm build`.** Only `pnpm tsc` (`tsc --noEmit`) + `pnpm lint`.
- **Stage by path, never `git add -A`.** Never commit `CLAUDE.local.md` (untracked dispatch file).
- **Boundary-only:** do NOT add `ctx.actor` to `ScopedContext`; do NOT touch `create-crud-dal`/`create-crud-router` signatures; do NOT rename `agentProcedure`. Those are Phases 5/7.
- **Sentinel semantics:** `resolveActorScope`/`canAccess` → `null` = allow-all (omni/system); `sql\`false\`` = deny; non-null SQL = predicate. The entire risk surface is **false-ALLOW**.
- **Actor construction at tRPC boundaries:** build `userActor(ctx.session.user.id, ctx.ability)` inline (agentProcedure guarantees both non-null). `canAccess` is `async`.
- **Commit after each task** (conventional commits, `refactor(permissions):`/`fix(permissions):`), ending every message body with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer.

## Current signatures (from the codebase, do not redefine)

- `actor.ts`: `Actor = { kind:'user', userId, ability } | { kind:'token', scope: SQL, subject: AppSubject } | { kind:'system', reason: string }`; `userActor(userId, ability)`, `tokenActor(scope, subject)` (**scope-first**), `systemActor(reason)`.
- `resolve-actor-scope.ts`: `resolveActorScope(spec, actor): SQL | null`; `verbOnly(actor, action, subject): SQL | null`; `canAccess(spec, actor, id, action='read'): Promise<boolean>`.
- `types.ts`: `ScopedContext { session: BetterAuthSession|null, ability: AppAbility|null, scope: SQL|null }`; `SYSTEM_CONTEXT: ScopedContext = { session:null, ability:null, scope:null }`.
- Entity specs (Phase-1 wired, CASL-backed): `customerServerSpec`, `meetingServerSpec`, `proposalServerSpec`, `projectServerSpec` at `@/shared/entities/<entity>/lib/server-spec`.

## File Structure

- **Create:** none (all edits land in existing files + one new helper module `src/shared/domains/permissions/scope/system-reasons.ts`).
- **Modify (foundational):** `scope/system-reasons.ts` (new), `scope/actor.ts`, `dal/server/types.ts` (add `systemContext`), `dal/server/lib/helpers.ts` (add `requireResolvedScope`) + 11 DAL/entity files (apply `requireResolvedScope`), `permissions/lib/share-token-actor.ts` (new).
- **Modify (fix sites):** `meeting-flow.router.ts`, `proposals.router/contracts.router.ts`, `api/proposals/[proposalId]/pdf/route.ts`, `api/proposals/[proposalId]/summary/route.ts`, `proposals.router/views.router.ts`, `customer-pipelines.router.ts`, `schedule.router/activities.router.ts`, `customers/lib/phone-gating-sql.ts` (+ 11 phone call sites).

---

### Task 1: `SystemReason` union + `systemActor`/`systemContext` typing

**Files:**
- Create: `src/shared/domains/permissions/scope/system-reasons.ts`
- Modify: `src/shared/domains/permissions/scope/actor.ts:13-16,26-28`
- Modify: `src/shared/dal/server/types.ts` (add `systemContext` factory near `SYSTEM_CONTEXT`)

**Interfaces:**
- Produces: `type SystemReason` (closed namespaced union); `systemActor(reason: SystemReason): Actor`; `systemContext(reason: SystemReason): ScopedContext`.
- Consumed by: Task 5 (`systemContext('derived:contract-age-from-token-proposal')`).

- [ ] **Step 1: Create the `SystemReason` union — the auditable bypass catalog**

`src/shared/domains/permissions/scope/system-reasons.ts`:
```ts
// The closed, namespaced catalog of every place we run an UNRESTRICTED
// (scope-bypassing) actor/context. Adding a variant is a deliberate,
// reviewable act — the union IS the audit surface for the single most
// dangerous actor in the system. Each variant's comment states WHY the
// bypass is safe (trusted signature verified upstream, super-admin gate, a
// server-derived id from an already-authorized read, etc.).
// see docs/plans/2026-08-10-casl-scope-compiler-epic.md (Actor-seam conventions §4)
export type SystemReason
  // A server-derived id from an already scope-authorized read (transitive write).
  = | 'derived:contract-age-from-token-proposal'
```
> Seed the union with ONLY the reason Phase 4 actually classifies (`contracts.age`). Later phases add `webhook:*`/`sync:*`/`intake:*`/`admin:*` variants as each site is classified — do NOT pre-populate speculative variants (YAGNI).

- [ ] **Step 2: Retype `systemActor`'s `reason`**

In `src/shared/domains/permissions/scope/actor.ts`, add the import and change both the union member and the constructor param from `string` to `SystemReason`:
```ts
import type { SystemReason } from './system-reasons'
// ...union member (was `reason: string`):
    | { kind: 'system', reason: SystemReason }
// ...constructor (was `reason: string`):
export function systemActor(reason: SystemReason): Actor {
  return { kind: 'system', reason }
}
```

- [ ] **Step 3: Add the `systemContext` factory (named ScopedContext bypass)**

In `src/shared/dal/server/types.ts`, directly below `SYSTEM_CONTEXT`, add a named factory. It returns the same allow-all `ScopedContext` shape but forces the caller to name the reason (greppable), and marks `SYSTEM_CONTEXT` deprecated in favor of it:
```ts
import type { SystemReason } from '@/shared/domains/permissions/scope/system-reasons'

/**
 * Named, auditable system context — the ScopedContext-layer analogue of
 * `systemActor(reason)`. Same allow-all shape as `SYSTEM_CONTEXT`, but the
 * required `SystemReason` makes each unrestricted call site greppable and
 * forces a conscious "why is this bypass safe?" at review. Prefer this over
 * the bare `SYSTEM_CONTEXT` for any NEW privileged write.
 * see ../../../plans/2026-08-10-casl-scope-compiler-epic.md (Retiring-Seams Register)
 */
export function systemContext(reason: SystemReason): ScopedContext {
  void reason // reason is documentation-at-call-site; captured for greppability
  return { session: null, ability: null, scope: null }
}
```
> Do NOT delete `SYSTEM_CONTEXT` — its many non-§8 call sites (webhooks/jobs) stay until their phases; it is in the Retiring-Seams Register for Phase 8.

- [ ] **Step 4: Verify + commit**

Run: `pnpm tsc && pnpm lint` — Expected: both green (no call site passes a non-`SystemReason` string to `systemActor` yet; it is unwired scaffolding).
```bash
git add src/shared/domains/permissions/scope/system-reasons.ts src/shared/domains/permissions/scope/actor.ts src/shared/dal/server/types.ts
git commit -m "refactor(permissions): SystemReason union + systemContext factory"
```

---

### Task 2: `requireResolvedScope` deny-safety helper + migrate the 18 `?? undefined` sites

**Files:**
- Modify: `src/shared/dal/server/lib/helpers.ts` (add `requireResolvedScope`)
- Modify (replace `X ?? undefined` → `requireResolvedScope(X)`): `create-crud-dal.ts:117,213,264`; `resolve-actor-scope.ts:68`; `projects/dal/server/queries.ts:202`; `meetings/dal/server/queries.ts:151,294`; `media-files/dal/server/media-ops.ts:34,55`; `applications/dal/server/mutations.ts:34,74,163`; `applications/dal/server/queries.ts:31,57`; `proposals/dal/server/mutations.ts:70`; `proposals/dal/server/queries.ts:122,226,323`; `proposal-incentives/dal/server/mutations.ts:45`; `voip-messages/dal/server/queries.ts:40`; `customers/dal/server/queries.ts:81,187`

**Interfaces:**
- Produces: `requireResolvedScope(scope: SQL | null | undefined): SQL | undefined` — `undefined`→throw, `null`→`undefined` (allow-all), SQL→SQL.
- Consumed by: every migrated DAL site (drop-in for `?? undefined`).

> Deliberately SKIP `scope.ts:94` (`isInScope`, `@deprecated`) — it is deleted in Phase 8; do not churn dead code.

- [ ] **Step 1: Add `requireResolvedScope` to `helpers.ts`**

Add to `src/shared/dal/server/lib/helpers.ts` (add `import type { SQL } from 'drizzle-orm'` if absent):
```ts
/**
 * Asserts a visibility scope was CONSCIOUSLY resolved, then converts it to a
 * Drizzle WHERE fragment. The whole point is to tell two states apart that
 * `?? undefined` silently collapses together:
 *   `null`      = the resolver ran and DELIBERATELY chose allow-all (omni /
 *                 system) → undefined, so and()/where() drops it (unrestricted).
 *   `undefined` = the scope was NEVER resolved — a ctx that skipped scope
 *                 resolution, an untyped JS path, a forgotten wiring → THROW.
 *                 An unresolved scope must DENY loudly, never silently allow-all.
 * The name is the guard: a query may only run once its scope has been REQUIRED
 * to exist. This is the engine's core false-ALLOW guard, centralized.
 * see docs/plans/2026-08-10-casl-scope-compiler-epic.md (Actor-seam conventions §5)
 */
export function requireResolvedScope(scope: SQL | null | undefined): SQL | undefined {
  if (scope === undefined) {
    throw new Error(
      '[scope] visibility scope was never resolved (undefined) — refusing to run an unscoped query (deny-safe)',
    )
  }
  return scope ?? undefined
}
```

- [ ] **Step 2: Migrate every site (drop-in replacement)**

At each site listed above, replace the literal `ctx.scope ?? undefined` with `requireResolvedScope(ctx.scope)` (and at `resolve-actor-scope.ts:68` replace the local `scope ?? undefined` with `requireResolvedScope(scope)`), preserving each site's surrounding `and(...)`/`.where(...)` shape. Add `import { requireResolvedScope } from '@/shared/dal/server/lib/helpers'` to each file (or the local relative path within `dal/server/lib`). Examples of the two dominant shapes:
```ts
// id + scope (create-crud-dal.ts:117 etc.):
const where = and(eq(pkColumn, input.id), requireResolvedScope(ctx.scope))
// scope-leading in a multi-arg and() (meetings/queries.ts:151 etc.):
const where = and(requireResolvedScope(ctx.scope), searchWhere, filterWhere)
// sole where (customers/queries.ts:187):
.where(requireResolvedScope(ctx.scope))
// filters-array spread (applications/queries.ts:31):
const filters = [requireResolvedScope(ctx.scope), input.meetingId ? eq(applications.meetingId, input.meetingId) : undefined, /* ... */]
```

- [ ] **Step 3: Verify — tsc/lint + a deny-safe probe**

Run: `pnpm tsc && pnpm lint` — Expected: green. Then a scratch probe under the scratchpad (uncommitted) proving the throw fires:
```ts
// scratchpad/probe-apply-scope.ts — run with: pnpm tsx <path>
import { requireResolvedScope } from '@/shared/dal/server/lib/helpers'
console.log('null →', requireResolvedScope(null))            // expect: undefined
try { requireResolvedScope(undefined as any); console.log('FAIL: no throw') }
catch (e) { console.log('undefined → threw ✓', (e as Error).message) }
```
Expected: `null → undefined` then `undefined → threw ✓`. Delete the scratch file after.

- [ ] **Step 4: Commit**
```bash
git add src/shared/dal/server/lib/helpers.ts src/shared/dal src/shared/entities
git commit -m "refactor(permissions): deny-safe requireResolvedScope helper, replace ?? undefined at 18 DAL sites"
```
> Stage precisely — confirm `git status` shows only the helper + the migrated DAL/entity files (no stray edits).

---

### Task 3: Canonical `share-token → tokenActor` path (§8-3), migrate 3 proposal-view sites

**Files:**
- Create: `src/shared/domains/permissions/lib/share-token-actor.ts`
- Modify: `src/app/api/proposals/[proposalId]/pdf/route.ts:18-25`
- Modify: `src/app/api/proposals/[proposalId]/summary/route.ts:23-34`
- Modify: `src/trpc/routers/proposals.router/views.router.ts:38-45`

**Interfaces:**
- Consumes: `validateShareToken(token, 'proposal'): Promise<{valid, resourceId}>` (existing); `tokenActor(scope, subject)`; `resolveActorScope(spec, actor)`; `proposalServerSpec`.
- Produces: `resolveShareTokenActor(token: string, resourceType: 'proposal'): Promise<Actor | null>` — validates the bearer and returns a `tokenActor` scoped to the resolved row (or `null` if invalid).

- [ ] **Step 1: Build the canonical helper (validate → tokenActor)**

`src/shared/domains/permissions/lib/share-token-actor.ts`:
```ts
import type { Actor } from '@/shared/domains/permissions/scope/actor'

import { eq } from 'drizzle-orm'

import { proposals } from '@/shared/db/schema'
import { tokenActor } from '@/shared/domains/permissions/scope/actor'
import { validateShareToken } from '@/shared/domains/permissions/lib/validate-share-token'

/**
 * The ONE canonical bearer-token → Actor path. Validates the share token and,
 * on success, returns a `tokenActor` whose scope is narrowed to the resolved
 * row (row-boundary is the scope; the verb-boundary is which endpoint accepts
 * the token — a tokenActor carries no ability). Replaces the hand-rolled
 * `proposal.token !== token` compares scattered across the view routes.
 * see docs/plans/2026-08-10-casl-scope-compiler-epic.md (Actor-seam conventions §3)
 */
export async function resolveShareTokenActor(
  token: string,
  resourceType: 'proposal',
): Promise<Actor | null> {
  const result = await validateShareToken(token, resourceType)
  if (!result.valid)
    return null
  return tokenActor(eq(proposals.id, result.resourceId), 'Proposal')
}
```

- [ ] **Step 2: Migrate the tRPC view route (`views.router.ts:38-45`)**

Replace the `getFullView(SYSTEM_CONTEXT, …)` + manual `proposal.token !== input.token` block with token-actor validation, scoping the read through the resolved actor. New body of `recordView` around the read:
```ts
import { resolveShareTokenActor } from '@/shared/domains/permissions/lib/share-token-actor'
import { resolveActorScope } from '@/shared/dal/server/lib/resolve-actor-scope'
import { proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'
// ...
const actor = await resolveShareTokenActor(input.token, 'proposal')
if (!actor) {
  throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid token' })
}
const proposal = dalToTrpc(await getFullView(
  { session: null, ability: null, scope: resolveActorScope(proposalServerSpec, actor) },
  { id: input.proposalId },
))
if (!proposal) {
  throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
}
```
> `resolveActorScope(proposalServerSpec, tokenActor)` returns the token's scope verbatim (`eq(proposals.id, resourceId)`), so the read is engine-scoped to exactly the token's proposal — the manual `.token !==` compare is now redundant and removed. Delete the old `SYSTEM_CONTEXT` import from this file if unused after the change.

- [ ] **Step 3: Migrate the two route handlers (`pdf/route.ts`, `summary/route.ts`)**

Both currently do `getFullView(SYSTEM_CONTEXT, { id: proposalId })` then `if (proposal.token !== token) return 401`. Replace the manual compare with the actor path (identical shape in both files):
```ts
import { resolveShareTokenActor } from '@/shared/domains/permissions/lib/share-token-actor'
import { resolveActorScope } from '@/shared/dal/server/lib/resolve-actor-scope'
import { proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'
// ...(token already parsed from query string; missing-token → 401 stays)
const actor = await resolveShareTokenActor(token, 'proposal')
if (!actor) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}
const proposal = dalToTrpc(await getFullView(
  { session: null, ability: null, scope: resolveActorScope(proposalServerSpec, actor) },
  { id: proposalId },
))
// ...existing null-proposal handling stays; the `proposal.token !== token` block is DELETED
```
> Keep the existing "missing token → 401" guard (before calling `resolveShareTokenActor`). Remove the now-unused `proposal.token` comparison. Confirm `getFullView` is still imported.

- [ ] **Step 4: Verify + commit**

Run: `pnpm tsc && pnpm lint` — green. Manual smoke (documented, not automated): a valid `?token=` still resolves the proposal; a wrong token → 401/`UNAUTHORIZED`. If a dev DB is available, a scratch `tsx` calling `resolveShareTokenActor('bad', 'proposal')` should return `null`.
```bash
git add src/shared/domains/permissions/lib/share-token-actor.ts "src/app/api/proposals/[proposalId]/pdf/route.ts" "src/app/api/proposals/[proposalId]/summary/route.ts" src/trpc/routers/proposals.router/views.router.ts
git commit -m "fix(permissions): canonical share-token→tokenActor path (§8-3), drop 3 hand-rolled token compares"
```

---

### Task 4: meeting-flow `updateCustomerProfile` — point-probe + scoped write (§8-1)

**Files:**
- Modify: `src/trpc/routers/meeting-flow.router.ts:26-54`

**Interfaces:**
- Consumes: `canAccess`, `resolveActorScope`, `userActor`, `customerServerSpec`, `upsertCustomerProfile`.

- [ ] **Step 1: Add the row point-probe + scope the write**

The current handler verb-checks `update CustomerProfile` then calls `upsertCustomerProfile(SYSTEM_CONTEXT, { customerId, patch })` with the CLIENT `customerId`. Add a `canAccess` read-probe on the customer (throws `NOT_FOUND` — do not leak existence) and replace `SYSTEM_CONTEXT` with a scoped context (defense-in-depth). New body (imports at top):
```ts
import { userActor } from '@/shared/domains/permissions/scope/actor'
import { canAccess, resolveActorScope } from '@/shared/dal/server/lib/resolve-actor-scope'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
// ...inside .mutation(async ({ ctx, input }) => {
if (ctx.ability.cannot('update', 'CustomerProfile')) {
  throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to update the customer profile.' })
}
const { meetingId, customerId, patch } = input

// Row-probe: can this actor reach THIS customer? (read visibility gates the
// profile write — a 'create' probe would deny every legitimate upsert; §6.)
const actor = userActor(ctx.session.user.id, ctx.ability)
if (!(await canAccess(customerServerSpec, actor, customerId, 'read'))) {
  throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' })
}

const updated = dalToTrpc(await upsertCustomerProfile(
  { session: ctx.session, ability: ctx.ability, scope: resolveActorScope(customerServerSpec, actor) },
  { customerId, patch },
))
// ...(ably fan-out unchanged)
```
> Remove the `SYSTEM_CONTEXT` import if unused after this change.

- [ ] **Step 2: Verify + commit**

Run: `pnpm tsc && pnpm lint` — green. Scratch/dev probe (documented): as an agent participating in the meeting, the upsert succeeds; a foreign `customerId` → `NOT_FOUND`.
```bash
git add src/trpc/routers/meeting-flow.router.ts
git commit -m "fix(permissions): meeting-flow updateCustomerProfile row-probe + scoped write (§8-1)"
```

---

### Task 5: contracts.age — named `systemContext` transitive write (§8-2)

**Files:**
- Modify: `src/trpc/routers/proposals.router/contracts.router.ts:213-222`

**Interfaces:**
- Consumes: `systemContext('derived:contract-age-from-token-proposal')` (Task 1).

- [ ] **Step 1: Reclassify `SYSTEM_CONTEXT` → named `systemContext`, assert the invariant**

The `customerCrud.update(SYSTEM_CONTEXT, { id: proposal.customer.id, data:{ age } })` write is a SAFE transitive write — `proposal.customer.id` is server-derived from the `getFullView(ctx, …)` read, which is scope-enforced (token or agent `ctx`). Name the bypass and document/guard the invariant:
```ts
import { systemContext } from '@/shared/dal/server/types'
// ...replace the age-write block:
if (input.age !== undefined) {
  // Transitive write: `proposal.customer.id` is SERVER-DERIVED from the
  // scope-enforced getFullView above (never client input) — the read IS the
  // authorization. Named systemContext makes the bypass auditable.
  // Invariant: this id must come from the authorized read, not `input`.
  dalToTrpc(await customerCrud.update(
    systemContext('derived:contract-age-from-token-proposal'),
    { id: proposal.customer.id, data: { age: input.age } },
  ))
}
```
> Leave the proposal-side write (`proposalCrud.update(ctx, …)`, ~line 250) on the scoped `ctx` — unchanged. Remove the `SYSTEM_CONTEXT` import if now unused in this file.

- [ ] **Step 2: Verify + commit**

Run: `pnpm tsc && pnpm lint` — green (adds the first real `systemContext`/`SystemReason` consumer, exercising Task 1's types).
```bash
git add src/trpc/routers/proposals.router/contracts.router.ts
git commit -m "fix(permissions): contracts.age named systemContext transitive write (§8-2)"
```

---

### Task 6: `assignToProject` — probe both client ids (#4)

> ⚠️ **Non-canonical target — temporary fix (Tasks 6–7).** `customer-pipelines.router.ts` is a LEGACY, not-yet-standardized router: no `procedures.ts`, no CRUD-factory adoption, still on the pre-CASL hand-rolled tRPC+DAL idiom. These probes close the IDOR NOW, but they live in a router slated for standardization. Treat them as a **stopgap, not a reference** for how a canonical router gates access — draw NO system-wide conclusions from this router's shape. When customer-pipelines is migrated onto the standardized tRPC/CRUD structure (its own future issue), fold these inline probes into the canonical path. (The probed *entities* — customer/meeting/project — ARE spec'd, so `canAccess` is the right mechanism; only the router placement is legacy.)

**Files:**
- Modify: `src/trpc/routers/customer-pipelines.router.ts:121-137`

**Interfaces:**
- Consumes: `canAccess`, `userActor`, `meetingServerSpec`, `projectServerSpec`.

- [ ] **Step 1: Replace `scope:null` write with row-probes on meeting AND project**

Current: a verb-only `cannot('update','Meeting')` check then `meetingCrud.update({…, scope:null}, { id: input.meetingId, data:{ projectId }})`. Probe both client-supplied ids, then scope the write:
```ts
import { userActor } from '@/shared/domains/permissions/scope/actor'
import { canAccess, resolveActorScope } from '@/shared/dal/server/lib/resolve-actor-scope'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
import { projectServerSpec } from '@/shared/entities/projects/lib/server-spec'
// ...inside .mutation(async ({ ctx, input }) => {
if (ctx.ability.cannot('update', 'Meeting')) {
  throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to update meetings' })
}
const actor = userActor(ctx.session.user.id, ctx.ability)
if (!(await canAccess(meetingServerSpec, actor, input.meetingId, 'read'))) {
  throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' })
}
if (!(await canAccess(projectServerSpec, actor, input.projectId, 'read'))) {
  throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
}
return dalToTrpc(await meetingCrud.update(
  { session: ctx.session, ability: ctx.ability, scope: resolveActorScope(meetingServerSpec, actor) },
  { id: input.meetingId, data: { projectId: input.projectId, meetingOutcome: 'converted_to_project' } },
))
```

- [ ] **Step 2: Verify + commit**

Run: `pnpm tsc && pnpm lint` — green.
```bash
git add src/trpc/routers/customer-pipelines.router.ts
git commit -m "fix(permissions): assignToProject probes meeting+project, drops scope:null (#4)"
```

---

### Task 7: `getRecordingUrl` — customer read-probe (#6)

> ⚠️ **Non-canonical target — temporary fix.** Same legacy `customer-pipelines.router.ts` as Task 6 (see that caveat): stopgap probe in an unstandardized router, not a canonical reference.

**Files:**
- Modify: `src/trpc/routers/customer-pipelines.router.ts:71-94`

**Interfaces:**
- Consumes: `canAccess`, `userActor`, `customerServerSpec`.

- [ ] **Step 1: Add `ctx` + a read-probe before minting the presigned recording URL**

Current `.query(async ({ input }) => …)` never pulls `ctx` and returns a presigned call-recording URL keyed only on client `customerId`. Add the probe:
```ts
import { userActor } from '@/shared/domains/permissions/scope/actor'
import { canAccess } from '@/shared/dal/server/lib/resolve-actor-scope'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
// ...change the handler signature to pull ctx, probe first:
.query(async ({ ctx, input }) => {
  const actor = userActor(ctx.session.user.id, ctx.ability)
  if (!(await canAccess(customerServerSpec, actor, input.customerId, 'read'))) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' })
  }
  // ...existing db.select / r2 presign body unchanged...
})
```

- [ ] **Step 2: Verify + commit**

Run: `pnpm tsc && pnpm lint` — green.
```bash
git add src/trpc/routers/customer-pipelines.router.ts
git commit -m "fix(permissions): getRecordingUrl customer read-probe before presigned URL (#6)"
```

---

### Task 8: `activities.getById` / `activities.complete` — owner check (#7)

> ⚠️ **Non-canonical target — temporary fix (stub entity).** `activities` is a stub feature still stuck in the LEGACY tRPC+entity+DAL pattern: it has NO server-spec and is NOT CASL-modeled. This owner-guard is a **temporary IDOR patch** that mirrors the file's own existing `update`/`delete` idiom — it is explicitly **NOT a canonical pattern** and must NOT be generalized or cited as how the system gates access. Draw NO system-wide conclusions from `activities`' shape (same status as customer-pipelines). When `activities` is fleshed out and given a server-spec, this owner-guard should be REPLACED with the standard `canAccess` actor path. Considering it for this migration is useful precisely because we *do* want it standardized eventually — but that is future work, not this task.

**Files:**
- Modify: `src/trpc/routers/schedule.router/activities.router.ts:92-106,191-205`

**Interfaces:**
- Mirrors the file's own `update`/`delete` sibling guard (`isOmni` + owner probe). Activities is NOT CASL-spec'd — do NOT introduce `canAccess`; replicate the local idiom.

- [ ] **Step 1: Add the sibling owner-guard to `getById`**

Pull `ctx`, and before returning, apply the same `isOmni + ownerId` probe `update`/`delete` use:
```ts
.query(async ({ ctx, input }) => {
  const [row] = await db
    .select({ ...getTableColumns(activities), ownerName: user.name, ownerImage: user.image })
    .from(activities)
    .leftJoin(user, eq(user.id, activities.ownerId))
    .where(eq(activities.id, input.id))

  if (!row)
    return null
  const isOmni = ctx.ability.can('manage', 'all')
  if (!isOmni && row.ownerId !== ctx.session.user.id) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to view this activity' })
  }
  return row
}),
```

- [ ] **Step 2: Add the sibling owner-guard to `complete`**

Mirror `delete`'s pre-write probe before the `db.update`:
```ts
.mutation(async ({ ctx, input }) => {
  const isOmni = ctx.ability.can('manage', 'all')
  if (!isOmni) {
    const [existing] = await db
      .select({ ownerId: activities.ownerId })
      .from(activities)
      .where(eq(activities.id, input.id))
    if (!existing)
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found' })
    if (existing.ownerId !== ctx.session.user.id)
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to complete this activity' })
  }
  const [updated] = await db
    .update(activities)
    .set({ completedAt: new Date().toISOString() })
    .where(eq(activities.id, input.id))
    .returning()
  if (!updated)
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found' })
  return updated
}),
```

- [ ] **Step 3: Verify + commit**

Run: `pnpm tsc && pnpm lint` — green.
```bash
git add src/trpc/routers/schedule.router/activities.router.ts
git commit -m "fix(permissions): activities getById/complete owner-check, mirror update/delete (#7)"
```

---

### Task 9: `canSeeUngatedPhone(Actor)` signature cutover (spec §9) — SEPARABLE

> Fixes no vuln — pure signature refactor so the phone gate reads an `Actor` instead of a raw ability, formalizing the current `null`→trusted short-circuit as "token/system actors are trusted." If Phase 4 is running long, this task can split to its own follow-up commit-set without blocking the §8 closures.

**Files:**
- Modify: `src/shared/entities/customers/lib/phone-gating-sql.ts:41-45`
- Modify (11 call sites): `dashboard.router.ts:10`; `meetings/dal/server/queries.ts:165,279`; `customers/dal/server/queries.ts:51`; `customer-pipelines.router.ts:32,68`; `customers.router/business.router.ts:123`; `voip-campaign-contacts/dal/server/queries.ts:282`

**Interfaces:**
- Produces: `canSeeUngatedPhone(actor: Actor): boolean` (was `(ability: AppAbility | null)`).

- [ ] **Step 1: Retype the predicate to take an `Actor`**

```ts
import type { Actor } from '@/shared/domains/permissions/scope/actor'

// Token/system actors are trusted upstream → ungated. A user actor is checked
// against its CASL ability. Masking (gatedPhoneSql) is unchanged (spec §9).
export function canSeeUngatedPhone(actor: Actor): boolean {
  if (actor.kind !== 'user')
    return true
  return actor.ability.can('manage', 'all') || actor.ability.can('read', 'LeadsPool')
}
```

- [ ] **Step 2: Update the 11 call sites**

Each site currently passes `canSeeUngatedPhone(ctx.ability)`. Where the caller has an authed `ctx` (session + ability non-null), pass `canSeeUngatedPhone(userActor(ctx.session.user.id, ctx.ability))`. Add `import { userActor } from '@/shared/domains/permissions/scope/actor'` per file. Concretely, at each of the 11 sites replace `canSeeUngatedPhone(ctx.ability)` with `canSeeUngatedPhone(userActor(ctx.session.user.id, ctx.ability))`.
> If any site's `ctx.session` can be `null` on a system/token path (verify per site — most are `agentProcedure`/authed DAL calls with non-null session), pass `canSeeUngatedPhone(systemActor('…'))` or a `tokenActor` instead. Verify each site's context guarantees before choosing — do not assume `ctx.session` is non-null without checking the procedure/caller.

- [ ] **Step 3: Verify + commit**

Run: `pnpm tsc && pnpm lint` — green (tsc catches any site that passed a bare ability). Scratch probe: `canSeeUngatedPhone(systemActor('derived:contract-age-from-token-proposal'))` → `true`.
```bash
git add src/shared/entities/customers/lib/phone-gating-sql.ts src/trpc src/shared/entities
git commit -m "refactor(permissions): canSeeUngatedPhone takes an Actor (spec §9, signature only)"
```

---

## Self-Review

**Spec coverage (§8 four sites + §9 + IDOR ledger):** §8-1 meeting-flow → Task 4 ✓; §8-2 contracts.age → Task 5 ✓; §8-3 proposal-views → Task 3 ✓; §8-4 deny-safety → Task 2 ✓; §9 `canSeeUngatedPhone` → Task 9 ✓; #4 assignToProject → Task 6 ✓; #6 getRecordingUrl → Task 7 ✓; #7 activities → Task 8 ✓; `SystemReason`/`systemActor` shape → Task 1 ✓. Deferred correctly (NOT in this plan): #1/#2/#3/#5 projects-churned (Phase 6/7); `ctx.actor` additive (Phase 5); `agentProcedure→staffProcedure` (Phase 7); `isVisible`/`isInScope` deletion (Phase 8).

**Type consistency:** `userActor(userId, ability)`, `tokenActor(scope, subject)`, `systemActor(reason: SystemReason)`, `systemContext(reason: SystemReason)`, `canAccess(spec, actor, id, action)`, `resolveActorScope(spec, actor)`, `requireResolvedScope(scope)` — used identically across all tasks. `canAccess` is awaited everywhere. Scoped contexts always `{ session, ability, scope: resolveActorScope(spec, actor) }`.

**Ordering/dependencies:** Task 1 (SystemReason) precedes Task 5 (first consumer). Task 2 (requireResolvedScope) is independent. Task 3's `resolveShareTokenActor` precedes its 3 migrations. Tasks 4/6/7 each build `userActor` inline (no cross-task dependency). Task 9 depends only on the `Actor` type (Task 1 not required, but harmless after).

**No placeholders:** every step carries the actual before/after code, exact paths+lines, and a concrete verification command.
