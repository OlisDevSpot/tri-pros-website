# Dispatcher Role — Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new internal `dispatcher` user role — a human (e.g. a virtual assistant) who qualifies leads and books appointments — that sees the shared leads pool, can dial leads (ungated phone + VoIP), and books meetings that land **unassigned/system-owned** through the official meetings CRUD, ready for the existing super-admin assignment flow.

**Architecture:** Extend the existing CASL + scope-middleware system rather than add role-string branches. Three anti-patterns get upgraded to capabilities in the process: the boolean phone-gate becomes a capability, the role-agnostic `visibility` predicate signature becomes ability-aware, and the meeting-ownership hook resolves owner by capability. No bespoke booking function — dispatchers book via `meetingsCrud.create`; the CRUD's ownership hook is where "unassigned" is expressed.

**Tech Stack:** Next.js 15 · tRPC · Drizzle (Postgres/Neon) · better-auth · CASL (`@casl/ability`) · drizzle-kit **push** (not generate).

**Testing reality:** This repo has **no unit-test framework** yet (see `docs/plans/2026-07-07-testing-bootstrap-handoff.md`). Verification is `pnpm tsc` + `pnpm lint` (the quality gates per CLAUDE.md) plus targeted runtime checks in the dev app / DB. Do **not** invent `pnpm test` commands — they do not exist.

## Global Constraints

- **Enum edits are append-only.** Add `'dispatcher'` to the END of `userRoles` — never reorder (pgEnum is positional in Postgres). — `enum-standardization.md`
- **DB changes ship via `pnpm db:push:dev`.** NEVER `pnpm db:push` (that is prod). NEVER hand-author a SQL migration — drizzle-kit push emits `ALTER TYPE … ADD VALUE`. — CLAUDE.md, `database-schema.md:82`
- **CASL is the only authorization mechanism.** No new `role === '…'` / `inArray(user.role, […])` branches. Every gate reads `ctx.ability`. — `src/trpc/DOCS.md`
- **All writes go through the official CRUD / DAL.** No naked `db.insert/update`. Booking uses `meetingsCrud.create`. — `dal-conventions.md#only-dal-imports-db`
- **Hooks are thin orchestrators.** Pure decisions (e.g. owner resolution) live in `entities/<entity>/lib/`, not inline in the hook. — `src/trpc/DOCS.md`
- **Ownership hook is a security invariant.** For authed callers, `ownerId` from client input is ALWAYS overwritten server-side (never trusted). The dispatcher branch must be driven by a server-side capability the dispatcher has and the agent lacks. — `meetings/lib/server-spec.ts:44-48`
- **`pnpm tsc` and `pnpm lint` must pass at the end of every task.** — CLAUDE.md PR preflight
- **Never set `updatedAt` manually; never `git add -A`** (stage by path). — memory conventions
- **Verify docs against code before quoting a rule** and ping on any drift found. — CLAUDE.md

---

## File Structure

**New CASL vocabulary** (one place):
- `src/shared/domains/permissions/types.ts` — add action `'own'` + subject `'LeadsPool'`.

**Role registration:**
- `src/shared/constants/enums/user.ts` — append `'dispatcher'`.
- `src/shared/domains/permissions/abilities.ts` — `case 'dispatcher'` block; add `can('own','Meeting')` to agent.

**Ability-aware visibility (blast-radius signature change):**
- `src/shared/dal/server/types.ts` — `visibility` signature + new `VisibilityScope` type.
- `src/trpc/lib/middleware/scope-middleware.ts` — pass scope object.
- `src/trpc/lib/middleware/shareable-middleware.ts` — pass scope object (session path).
- `src/shared/dal/server/lib/helpers.ts` — `buildUserContext` passes scope object.
- `src/shared/entities/customers/lib/visibility.ts` — dispatcher → leads-pool branch.
- `src/shared/entities/customers/dal/server/visibility.ts` — new `leadsPoolVisibility()` predicate.
- `src/shared/entities/proposals/lib/visibility.ts` — signature-only adaptation.
- (Any other `*/lib/visibility.ts` tsc surfaces — signature-only adaptation.)

**Capability phone-gate:**
- `src/shared/entities/customers/lib/phone-gating-sql.ts` — rename param + add `canSeeUngatedPhone()` policy helper; fix DOCS wording.
- All `gatedPhoneSql(` call sites (~10) — pass the capability.

**Ownership hook:**
- `src/shared/entities/meetings/lib/resolve-owner.ts` — new pure owner-resolution helper.
- `src/shared/entities/meetings/lib/server-spec.ts` — `create.before` + `create.after` use it.

**Minimal UI:**
- `src/shared/domains/pipelines/lib/get-accessible-pipelines.ts` — dispatcher → `['leads']`.

---

### Task 1: Register the `dispatcher` role (CASL vocabulary + grants + DB)

**Files:**
- Modify: `src/shared/domains/permissions/types.ts` (add `'own'` action, `'LeadsPool'` subject)
- Modify: `src/shared/constants/enums/user.ts:1`
- Modify: `src/shared/domains/permissions/abilities.ts:89` (agent gets `can('own','Meeting')`) and `:172` (new dispatcher case)
- DB: `pnpm db:push:dev`

**Interfaces:**
- Produces: role string `'dispatcher'` in `UserRole`; CASL action `'own'`; CASL subject `'LeadsPool'`; dispatcher ability set (`access Dashboard`, `read/create/update Meeting`, `read Customer`, `update Customer` lead-contact fields, `read User`, VoIP read/create verbs, `read LeadsPool`) — WITHOUT `own Meeting`.
- Consumes: nothing (first task).

- [ ] **Step 1: Add the CASL action and subject.** In `src/shared/domains/permissions/types.ts`, add `'own'` to the `AppAction` union and `'LeadsPool'` to the `AppSubject` union.

```ts
// AppAction — add 'own'
export type AppAction = 'access' | 'assign' | 'create' | 'delete' | 'manage' | 'own' | 'read' | 'update'

// AppSubject — add 'LeadsPool' alongside the other non-entity gate subjects
export type AppSubject
  = EntityName
    | 'all'
    | 'Calendar'
    | 'CustomerPipeline'
    | 'Dashboard'
    | 'LeadsPool'
    | 'User'
```

- [ ] **Step 2: Append the role.** In `src/shared/constants/enums/user.ts:1`, append `'dispatcher'` to the END (append-only — do not reorder):

```ts
export const userRoles = ['user', 'homeowner', 'agent', 'super-admin', 'dispatcher'] as const
export type UserRole = (typeof userRoles)[number]
```

- [ ] **Step 3: Give agents `own Meeting`.** In `src/shared/domains/permissions/abilities.ts`, inside `case 'agent':`, next to the existing Meeting grants (~line 96-98), add:

```ts
      can('own', 'Meeting') // agents own the meetings they create (implicitly the sales rep)
```

- [ ] **Step 4: Add the dispatcher case.** In `abilities.ts`, add BEFORE the closing `}` of the switch (after the `case 'user':` block, ~line 171):

```ts
    // ── dispatcher ────────────────────────────────────────────────────────
    // Internal lead-qualifier (e.g. a virtual assistant). Works the shared
    // leads pool: qualifies leads and books appointments that land UNASSIGNED
    // (system-owned) for the dispatch/assignment flow. NOT a sales agent —
    // deliberately WITHOUT can('own','Meeting'), so meetings they create are
    // owned by the system account, not by them. No proposal/project/calendar.
    case 'dispatcher':
      can('access', 'Dashboard')
      can('read', 'LeadsPool') // sees the shared leads pool (drives visibility + phone + pipeline access)

      can('read', 'Customer')
      // Lead-contact fields only — NOT the sales-discovery JSON profiles.
      can('update', 'Customer', ['name', 'phone', 'email', 'address', 'city', 'state', 'zip', 'pipelineStage'])

      can('read', 'Meeting')
      can('create', 'Meeting') // books appointments (lands unassigned — see resolve-owner.ts)
      can('update', 'Meeting')
      // Note: NO can('own','Meeting') — this is what makes their bookings unassigned.

      can('read', 'User')

      // Dial + text leads (voip-in-house verbs; row-scoping via visibility predicates).
      can('read', 'VoipCall')
      can('create', 'VoipCall')
      can('read', 'VoipMessage')
      can('create', 'VoipMessage')
      can('read', 'VoipDid')
      break
```

- [ ] **Step 5: Push the enum value to the dev DB.**

Run: `pnpm db:push:dev`
Expected: drizzle-kit detects the new enum value and applies `ALTER TYPE "public"."user_role" ADD VALUE 'dispatcher'`. Confirm no destructive/unexpected changes are proposed before accepting.

- [ ] **Step 6: Verify types + lint.**

Run: `pnpm tsc`
Expected: PASS. The `switch (user.role)` in `abilities.ts` is now exhaustive again (Step 4 added the missing case); any OTHER non-exhaustive `switch(role)` tsc flags is a real site to handle — note it, but abilities.ts should be the only role switch.

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 7: Runtime sanity — dispatcher resolves the right abilities.** In the dev app (or a scratch `tsx` snippet importing `defineAbilitiesFor`), confirm:
  - `defineAbilitiesFor({ id:'x', role:'dispatcher' })` → `can('read','LeadsPool')` = true, `can('own','Meeting')` = false, `can('create','Proposal')` = false, `can('update','Customer','pipelineStage')` = true, `can('update','Customer','customerProfileJSON')` = false.
  - `defineAbilitiesFor({ id:'x', role:'agent' })` → `can('own','Meeting')` = true.

- [ ] **Step 8: Commit.**

```bash
git add src/shared/domains/permissions/types.ts src/shared/constants/enums/user.ts src/shared/domains/permissions/abilities.ts
git commit -m "feat(auth): add dispatcher role with CASL grants (own/LeadsPool vocabulary)"
```

---

### Task 2: Capability-based phone gate

**Why:** `gatedPhoneSql(isSuperAdmin: boolean)` is a misnamed role-proxy — every call site already passes `isOmni`. Dispatchers dial leads, so they need ungated phone. Convert the boolean to a named capability policy.

**Files:**
- Modify: `src/shared/entities/customers/lib/phone-gating-sql.ts`
- Modify: all `gatedPhoneSql(` call sites (grep below)
- Modify: `src/shared/entities/customers/DOCS.md` (wording fix — see drift)

**Interfaces:**
- Consumes: `can('read','LeadsPool')`, `can('manage','all')` from Task 1.
- Produces: `canSeeUngatedPhone(ability: AppAbility | null): boolean`; `gatedPhoneSql(canSeeUngated: boolean)` (param renamed, still boolean).

- [ ] **Step 1: Add the policy helper + rename the param.** In `phone-gating-sql.ts`:

```ts
import type { AppAbility } from '@/shared/domains/permissions/types'

/**
 * Ungated-phone policy. Omni callers (super-admin), leads-pool workers
 * (dispatchers, who dial leads), and trusted server/token paths (ability === null)
 * see raw phone. Everyone else is gated behind a sent proposal.
 */
export function canSeeUngatedPhone(ability: AppAbility | null): boolean {
  if (!ability) return true // SYSTEM_CONTEXT / token path — already trusted upstream
  return ability.can('manage', 'all') || ability.can('read', 'LeadsPool')
}

export function gatedPhoneSql(canSeeUngated: boolean) {
  if (canSeeUngated) {
    return sql<string | null>`${customers.phone}`
  }
  return sql<string | null>`CASE WHEN ${EXISTS_SENT_PROPOSAL} THEN ${customers.phone} ELSE NULL END`
}
```

Also update the module doc comment: replace "Super-admins always see it" with "Omni/leads-pool/trusted callers see it ungated (see `canSeeUngatedPhone`)."

- [ ] **Step 2: Find every call site.**

Run: `grep -rn "gatedPhoneSql(" src --include=*.ts`
Expected: ~10 hits (e.g. `customers/dal/server/queries.ts`, `meetings/dal/server/queries.ts`, `schedule/.../get-action-queue.ts`).

- [ ] **Step 3: Update each call site to pass the capability.** At each hit, the caller has `ctx` (with `ctx.ability`). Replace the argument:

```ts
// before: gatedPhoneSql(isOmni)  /  gatedPhoneSql(ctx.scope === null)  /  gatedPhoneSql(ability == null)
// after:
gatedPhoneSql(canSeeUngatedPhone(ctx.ability))
```

For any call site whose only signal is `ctx.scope === null` (token path), `ctx.ability` is `null` there → `canSeeUngatedPhone(null)` returns `true`, preserving today's behavior. Verify each site has `ctx.ability` in scope; import `canSeeUngatedPhone` from the phone module.

- [ ] **Step 4: Fix the DOCS drift.** In `src/shared/entities/customers/DOCS.md#phone-visibility-threshold`, reword the "super-admins always see it" line to "omni + leads-pool (dispatcher) + trusted server/token callers see it ungated" so doc matches code.

- [ ] **Step 5: Verify.**

Run: `pnpm tsc` → PASS. `pnpm lint` → PASS.

- [ ] **Step 6: Runtime check.** With a `dispatcher` test user, load a leads-pool customer and confirm the phone is present (not the locked/NULL state) even with no sent proposal. With an `agent` test user on the same customer, confirm phone is still gated.

- [ ] **Step 7: Commit.**

```bash
git add src/shared/entities/customers/lib/phone-gating-sql.ts src/shared/entities/customers/DOCS.md src/shared/entities/customers/dal/server/queries.ts src/shared/entities/meetings/dal/server/queries.ts
# add any other call-site files grep surfaced
git commit -m "refactor(customers): phone gate driven by canSeeUngatedPhone capability, not isSuperAdmin boolean"
```

---

### Task 3: Ability-aware visibility signature + leads-pool predicate

**Why:** `visibility: (userId: string) => SQL` cannot express "dispatcher sees the leads pool." Widen it to receive `{ userId, ability }`, then branch in the customer predicate. Agent/proposal behavior is unchanged — only the signature moves.

**Files:**
- Modify: `src/shared/dal/server/types.ts` (signature + `VisibilityScope`)
- Modify: `src/trpc/lib/middleware/scope-middleware.ts`
- Modify: `src/trpc/lib/middleware/shareable-middleware.ts`
- Modify: `src/shared/dal/server/lib/helpers.ts`
- Modify: `src/shared/entities/customers/lib/visibility.ts`
- Create: `leadsPoolVisibility()` in `src/shared/entities/customers/dal/server/visibility.ts`
- Modify: `src/shared/entities/proposals/lib/visibility.ts` (+ any other `*/lib/visibility.ts` tsc surfaces)

**Interfaces:**
- Consumes: `can('read','LeadsPool')` from Task 1.
- Produces: `VisibilityScope = { userId: string; ability: AppAbility }`; `visibility: (scope: VisibilityScope) => SQL`; `leadsPoolVisibility(): SQL`.

- [ ] **Step 1: Define `VisibilityScope` and change the spec signature.** In `src/shared/dal/server/types.ts`, near the `EntityServerSpec` interface:

```ts
import type { AppAbility } from '@/shared/domains/permissions/types'

/** Inputs a visibility predicate may branch on. userId for row-ownership; ability for capability-based views. */
export interface VisibilityScope {
  userId: string
  ability: AppAbility
}
```

And change line 69:

```ts
  visibility: (scope: VisibilityScope) => SQL
```

- [ ] **Step 2: Run tsc to enumerate the fan-out.**

Run: `pnpm tsc`
Expected: FAIL — every `spec.visibility(userId)` call site and every `*/lib/visibility.ts` implementer now mismatches. This list IS your work queue for the rest of this task.

- [ ] **Step 3: Update the middleware call sites.** In `scope-middleware.ts` (preserve the omni short-circuit — R9):

```ts
const isOmni = ctx.ability.can('manage', 'all')
const scope = isOmni ? null : spec.visibility({ userId: ctx.session.user.id, ability: ctx.ability })
```

In `shareable-middleware.ts`, the **session path** (NOT the token path — token path keeps `scope = eq(tokenColumn, token)` and `ability: null`):

```ts
const ability = defineAbilitiesFor({ id: ctx.session.user.id, role: ctx.session.user.role })
const isOmni = ability.can('manage', 'all')
const scope = isOmni ? null : spec.visibility({ userId: ctx.session.user.id, ability })
```

- [ ] **Step 4: Update `buildUserContext`.** In `src/shared/dal/server/lib/helpers.ts` (~line 71):

```ts
  const ability = defineAbilitiesFor({ id: userId, role: userRole })
  const isOmni = ability.can('manage', 'all')
  return {
    session: { user: { id: userId, role: userRole } } as ScopedContext['session'],
    ability,
    scope: isOmni ? null : spec.visibility({ userId, ability }),
  }
```

- [ ] **Step 5: Author the leads-pool predicate.** In `src/shared/entities/customers/dal/server/visibility.ts`, alongside `userCanSeeCustomer`, add (a lead = `pipeline = 'active'` AND no meeting exists — see `customers/DOCS.md#derived-5-bucket-pipeline`):

```ts
import { and, eq, sql } from 'drizzle-orm'
import { customers } from '@/shared/db/schema'

/** The shared leads pool: active customers with no meeting yet. see ../../DOCS.md#derived-5-bucket-pipeline */
export function leadsPoolVisibility(): SQL {
  return and(
    eq(customers.pipeline, 'active'),
    sql`NOT EXISTS (SELECT 1 FROM meetings m WHERE m.customer_id = ${customers.id})`,
  )!
}
```

- [ ] **Step 6: Branch the customer visibility on capability.** Replace `src/shared/entities/customers/lib/visibility.ts`:

```ts
import type { SQL } from 'drizzle-orm'
import type { VisibilityScope } from '@/shared/dal/server/types'

import { customers } from '@/shared/db/schema'
import { leadsPoolVisibility, userCanSeeCustomer } from '@/shared/entities/customers/dal/server/visibility'

/** see ../DOCS.md#visibility-via-meeting-participation and #derived-5-bucket-pipeline */
export function customerVisibility({ userId, ability }: VisibilityScope): SQL {
  // Dispatchers work the shared leads pool (active, no meeting yet) — a different
  // predicate than agent participation-scoping, not a widening of it.
  if (ability.can('read', 'LeadsPool')) {
    return leadsPoolVisibility()
  }
  return userCanSeeCustomer(userId, customers.id)
}
```

- [ ] **Step 7: Adapt the remaining implementers (signature only).** For `proposals/lib/visibility.ts` and any other `*/lib/visibility.ts` tsc flagged, change the parameter from `(userId: string)` to `({ userId }: VisibilityScope)` and keep the existing body. Example for proposals:

```ts
import type { VisibilityScope } from '@/shared/dal/server/types'
// ...
export function proposalVisibility({ userId }: VisibilityScope): SQL {
  return userParticipatesInMeeting(userId, proposals.meetingId)
}
```

- [ ] **Step 8: Verify.**

Run: `pnpm tsc` → PASS (all fan-out resolved). `pnpm lint` → PASS.

- [ ] **Step 9: Runtime check.** As `dispatcher`, the customers list shows leads-pool customers (active, no meeting) and NOT customers already in meetings. As `agent`, the customers list is unchanged (only customers whose meetings they participate in). As `super-admin`, unchanged (omni → scope null → sees all).

- [ ] **Step 10: Commit.**

```bash
git add src/shared/dal/server/types.ts src/trpc/lib/middleware/scope-middleware.ts src/trpc/lib/middleware/shareable-middleware.ts src/shared/dal/server/lib/helpers.ts src/shared/entities/customers/lib/visibility.ts src/shared/entities/customers/dal/server/visibility.ts src/shared/entities/proposals/lib/visibility.ts
git commit -m "refactor(dal): make entity visibility ability-aware; add dispatcher leads-pool predicate"
```

---

### Task 4: Capability-aware meeting ownership (unassigned bookings via the CRUD)

**Why:** A dispatcher booking through `meetingsCrud.create` must land **system-owned/unassigned**, not owned by the dispatcher (which would wrongly mark them the sales rep). Fix the CRUD's ownership hook — the sanctioned extension point — driven by the `own Meeting` capability. Also fix `create.after`, which would otherwise seat info@ as a participant.

**Files:**
- Create: `src/shared/entities/meetings/lib/resolve-owner.ts`
- Modify: `src/shared/entities/meetings/lib/server-spec.ts` (`create.before` + `create.after`)

**Interfaces:**
- Consumes: `can('own','Meeting')` (Task 1), `getSystemOwnerId()` (existing, `entities/users/dal/server/system.ts`), `ScopedContext`.
- Produces: `resolveMeetingOwnerId(ctx: ScopedContext): Promise<string>`.

- [ ] **Step 1: Author the pure owner-resolution helper** (keeps the hook thin — Global Constraint). `src/shared/entities/meetings/lib/resolve-owner.ts`:

```ts
import type { ScopedContext } from '@/shared/dal/server/types'

import { getSystemOwnerId } from '@/shared/entities/users/dal/server/system'

/**
 * Server-authoritative owner for an authed create. NEVER trusts input ownerId.
 * - Users who can `own` a Meeting (agents, super-admin) → own it themselves.
 * - Users who cannot (dispatchers) → the system account owns it, i.e. the
 *   meeting is UNASSIGNED, awaiting dispatch. see ../DOCS.md#system-account-not-a-person
 * Caller guarantees ctx.session (authed path only); SYSTEM_CONTEXT is handled
 * by the hook's passthrough before this is called.
 */
export async function resolveMeetingOwnerId(ctx: ScopedContext): Promise<string> {
  if (ctx.ability?.can('own', 'Meeting')) {
    return ctx.session!.user.id
  }
  return getSystemOwnerId()
}
```

- [ ] **Step 2: Use it in `create.before`.** In `server-spec.ts`, replace the `create.before` body (~lines 49-54). Note it becomes `async`:

```ts
      async before(input, ctx) {
        // SYSTEM_CONTEXT (orchestrators like createFromIntake) supply ownerId explicitly.
        if (!ctx.session) {
          return input
        }
        // Authed: ownerId is ALWAYS server-resolved (input ownerId is never trusted).
        // Agents own their meetings; dispatchers create unassigned (system-owned) ones.
        return { ...input, ownerId: await resolveMeetingOwnerId(ctx) }
      },
```

- [ ] **Step 3: Stop seating the system account as a participant.** In `create.after` (~lines 63-64), guard the `addParticipant` call so a system-owned (unassigned) meeting gets NO owner participant — the "unassigned, no sales agent" state per `meetings/DOCS.md#system-account-not-a-person`:

```ts
      async after(row: Meeting, _ctx) {
        const systemOwnerId = await getSystemOwnerId()
        // info@ cannot attend — an unassigned (system-owned) meeting has no owner participant.
        if (row.ownerId !== systemOwnerId) {
          await addParticipant(row.id, row.ownerId, 'owner')
        }

        if (row.scheduledFor) {
          await syncMeetingToGcalJob.dispatchOrThrow({ meetingId: row.id })
        }
        // Booked → stop CloudTalk dialing (unchanged; correct for dispatcher bookings too).
        if (row.customerId) {
          await graduateFromCampaignJob.dispatchOrThrow({ customerId: row.customerId })
        }
      },
```

Add the `getSystemOwnerId` import to `server-spec.ts` if not already present, and import `resolveMeetingOwnerId` from `./resolve-owner`.

- [ ] **Step 4: Verify.**

Run: `pnpm tsc` → PASS. `pnpm lint` → PASS.

- [ ] **Step 5: Runtime check (the security-critical one).**
  - As `dispatcher`, book a meeting via the normal create path (even POSTing `ownerId: <some agent>` in the payload). Confirm in DB: `meetings.owner_id` = the system owner id (info@), and there is **no** `meeting_participants` row for that meeting.
  - As `agent`, create a meeting (POSTing `ownerId: <another user>`). Confirm `meetings.owner_id` = the agent's own id (input ignored), and an `owner` participant row exists for the agent.
  - Confirm the `graduateFromCampaignJob` fires for a dispatcher booking with a `customerId` (CloudTalk unenroll) — desired.

- [ ] **Step 6: Commit.**

```bash
git add src/shared/entities/meetings/lib/resolve-owner.ts src/shared/entities/meetings/lib/server-spec.ts
git commit -m "feat(meetings): dispatcher bookings resolve to system-owned/unassigned via CRUD ownership hook"
```

---

### Task 5: Minimal dispatcher UI surface

**Why:** The dispatcher should land on the leads pipeline + schedule only. Nav is already CASL-driven, so the only change is pipeline access, which is a binary today and needs a third set.

**Files:**
- Modify: `src/shared/domains/pipelines/lib/get-accessible-pipelines.ts`

**Interfaces:**
- Consumes: `can('read','LeadsPool')`, `can('manage','all')` (Task 1).
- Produces: dispatcher → `['leads']` from `getAccessiblePipelines`.

- [ ] **Step 1: Add the dispatcher branch.** In `get-accessible-pipelines.ts`, before the existing agent fallback, add a leads-pool branch (omni still returns all):

```ts
export function getAccessiblePipelines(ability: AppAbility): readonly Pipeline[] {
  if (ability.can('manage', 'all')) {
    return ALL_PIPELINES
  }
  if (ability.can('read', 'LeadsPool')) {
    return ['leads'] // dispatcher — shared leads pool only
  }
  if (ability.can('read', 'Customer')) {
    return AGENT_PIPELINES // ['projects', 'fresh']
  }
  return []
}
```

(Match the file's actual existing structure — keep `ALL_PIPELINES` / `AGENT_PIPELINES` names as they are; only add the `LeadsPool` branch.)

- [ ] **Step 2: Verify.**

Run: `pnpm tsc` → PASS. `pnpm lint` → PASS.

- [ ] **Step 3: Runtime check.** Log in as a `dispatcher` user (set a test user's role to `dispatcher` in the DB). Confirm: sidebar shows the Pipeline (leads) + Schedule nav items and NOT the admin block (Lead Sources/Campaigns/Team/Analytics); the pipeline switcher offers only `leads`; the dashboard is reachable (not redirected to `/`). Confirm an `agent` user still sees `fresh` + `projects` only.

- [ ] **Step 4: Commit.**

```bash
git add src/shared/domains/pipelines/lib/get-accessible-pipelines.ts
git commit -m "feat(pipelines): dispatcher sees the leads pipeline only"
```

---

## Out of scope for Phase A (do NOT build here)

- `is-dispatched.ts` derivation, the dispatch-inbox surface, and the `sales_agent` participant-role migration (the documented-but-unbuilt dispatch substrate). Phase A produces unassigned/system-owned meetings; assignment uses the **existing** super-admin participant flow (`manageParticipants`). These are Phase B.
- The redundant `inArray(user.role, ['agent','super-admin'])` in `meetings.router/reads.router.ts:47` — it correctly EXCLUDES dispatchers from meeting-owner assignment dropdowns, which is the desired Phase A behavior. Converting it to a capability check is optional cleanup, deferred.
- Dispatcher signup/provisioning UX (role is admin-assigned in the DB for now; no auto-assign hook change).
- A bespoke dispatcher dashboard view (Phase A reuses the CASL-trimmed agent shell).

## Self-Review

- **Spec coverage:** Role registration (T1), leads-pool visibility (T3), ungated phone + VoIP (T1 grants + T2), book-unassigned-via-CRUD (T4), minimal UI (T5) — all four user answers covered. ✅
- **Auditor checklist:** R1/R2/R3/R4 → T1 (append-only, push not migrate, tsc-guided). R5/R6 → T1 grants incl. `pipelineStage`. R7/R8/R9 → T3 (signature change, distinct leads predicate, omni preserved). R10 → T2. R11/R12/R14/R15 → T4 (CRUD-only, capability-driven owner, thin helper, no info@ participant). R16/R17 → T5. ✅
- **Type consistency:** `VisibilityScope { userId, ability }` defined in T3 Step 1, consumed T3 Steps 3-7. `resolveMeetingOwnerId(ctx)` defined T4 Step 1, used T4 Step 2. `canSeeUngatedPhone(ability)` defined T2 Step 1, used T2 Step 3. `own`/`LeadsPool` defined T1 Step 1, consumed everywhere after. ✅
- **Highest-risk item (R12):** T4 overwrites `ownerId` for ALL authed callers (never trusts input) and branches on the `own Meeting` capability — the security invariant is preserved for agents and correctly redirected for dispatchers. Runtime check T4 Step 5 explicitly tests the input-spoofing case. ✅
