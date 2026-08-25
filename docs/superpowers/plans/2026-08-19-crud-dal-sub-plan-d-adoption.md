# CRUD DAL Sub-plan D · Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire what Sub-plans A/B built into the entities — relocate the three spec-hook entities onto the config factory, delete the `synthesizeFromSpec` shim, standardize `lead-sources` onto the entity pattern, and route `projects` mutations through CRUD — with no item waiting on #285 or the deferred tx/crux-2 work.

**Scope note (2026-08-19):** the **non-tx bypass elimination (D-c)** is **DEFERRED out of this plan**. The affected callers (`accounting.service.ts`, `providers/ai/client.ts`, `voip/compliance.service.ts`, `voip/voip-link-tokens.service.ts`) are mostly stubbed / slated for a complete overhaul, so migrating their writes now would be rework. They stay as-is; see **Deferred tail**.

**Architecture:** Every entity mutation flows through `createCrudDal(spec, configFactory?)`. Factory-invariant hooks (`before`/`after`/`duplicate`) live in the entity's `dal/server/crud.ts` config factory (canonical exemplar: [meetings/dal/server/crud.ts](src/shared/entities/meetings/dal/server/crud.ts)), NOT on `EntityServerSpec`. Server-only or conditional/bulk writes stay as bespoke naked-`db` DAL functions inside the owning entity's DAL (§5.9) — never inline in a service/router, never a two-schema engine path (that subsystem was killed in the D grill). `scopeIds` is a call-site closure, never engine input.

**Tech Stack:** Next.js 15 · TypeScript · tRPC · Drizzle ORM (node-postgres / Neon) · Zod · better-auth · CASL.

**Spec:** [docs/plans/2026-08-12-crud-dal-mutation-interface-extension.md](docs/plans/2026-08-12-crud-dal-mutation-interface-extension.md) §6-D (the grilled boundary, 2026-08-19). Read §3 (locked model), §5 (final decisions — esp. 5.2/5.3/5.4 overturns, 5.9, 5.11), and §6-D before starting.

## Global Constraints

- **No test runner exists.** Verify EVERY task with `pnpm tsc` + `pnpm lint` (both must be green). NEVER `pnpm build`. For behavior-changing tasks, additionally run a throwaway smoke script (`pnpm tsx scripts/tmp-*.ts`) against the **dev** DB — see [reference-config-factory-hook-smoke-tests](../../../.claude/projects/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/memory/reference-config-factory-hook-smoke-tests.md) for the recipe.
- **DB safety:** scripts touch the **dev** DB only. NEVER set `DRIZZLE_TARGET=prod`. Throwaway scripts MUST begin with `import './lib/load-env'` (not `'dotenv/config'`). Delete `scripts/tmp-*.ts` when done.
- **Git:** work on local `main`. Stage explicitly by path; NEVER `git add -A`. Commit ONLY the files a task touches. The session snapshot may be stale — re-check `git status` per commit.
- **Behavior-preserving by default.** D routes behavior through the new plumbing; it does NOT tighten security. Project mutations keep bare `agentProcedure` (so `ctx.scope` stays `undefined` → unscoped, identical to today). Scope-tightening is the named **#285 tail**, out of scope here.
- **Naked-writer is sanctioned, not a smell.** `recomputeProposalFinancials` and `setCashInDeal` (proposals) stay naked `db` DAL functions. Do NOT wrap them in a crud abstraction or a two-schema path.
- **Side-effecting `after` hooks stay INLINE** (naked-safe: no tx threaded → the single write autocommits before the hook fires). Do NOT relocate them to `afterCommit` (Sub-plan C is deferred).
- **`@migration(...)` comments** in relocated hook bodies are carried over verbatim — do not action or delete them.
- Follow all rules in `CLAUDE.md`, the memory index, and [docs/codebase-conventions/](docs/codebase-conventions/). When a documented rule disagrees with the code, favor the code and ping.

---

## File Structure

**Modified (hook relocation — D-a):**
- `src/shared/entities/customers/dal/server/crud.ts` — 1-arg → config factory
- `src/shared/entities/customers/lib/server-spec.ts` — strip `hooks`
- `src/shared/entities/proposals/dal/server/crud.ts` — 1-arg → config factory
- `src/shared/entities/proposals/lib/server-spec.ts` — strip `hooks` + `duplicate`
- `src/shared/entities/customer-notes/dal/server/crud.ts` — 1-arg → config factory (crudHandlers arg dissolves lazy import)
- `src/shared/entities/customer-notes/lib/server-spec.ts` — strip `hooks`

**Modified (shim removal — D-b):**
- `src/shared/dal/server/lib/create-crud-dal.ts` — delete `synthesizeFromSpec`; default `cfg` → `{}`
- `src/shared/dal/server/types.ts` — strip `hooks` + `duplicate` from `EntityServerSpec`
- `src/trpc/DOCS.md` — rewrite the pre-A hook-model text

**Bypass elimination (D-c): DEFERRED — see Deferred tail. No files touched in this plan.**

**Created (lead-sources standardization — D-d):**
- `src/shared/entities/lead-sources/lib/constants.ts` — `LEAD_SOURCE`
- `src/shared/entities/lead-sources/lib/visibility.ts` — visibility predicate
- `src/shared/entities/lead-sources/lib/server-spec.ts` — spec + schemas
- `src/shared/entities/lead-sources/dal/server/crud.ts` — `leadSourceCrud` + config factory
- **Modified:** `src/shared/domains/permissions/abilities.ts` (ENTITY_NAMES + agent grants), `src/trpc/routers/lead-sources.router.ts` (CRUD → crud), `src/shared/entities/lead-sources/dal/server/mutations.ts` (unchanged; `setVoipCampaignsPolicy` stays)

**Modified (projects through CRUD — D-e):**
- `src/shared/entities/projects/dal/server/crud.ts` — config factory (delete.before R2) + `create/updateProjectWithScopes`
- `src/shared/entities/projects/dal/server/mutations.ts` — delete `createProject`/`updateProject`/`deleteProject`; keep `setProjectScopes`
- `src/shared/entities/projects/lib/server-spec.ts` — corrected docstring (D-0)
- `src/trpc/routers/projects.router/crud.router.ts` — route through abstractions, keep `agentProcedure`

---

## Sequence & Dependencies

```
D-0 ─┬─→ D-a1 (customers) ─┐
     ├─→ D-a2 (proposals) ─┼─→ D-b ─→ D-e (projects)
     ├─→ D-a3 (cust-notes) ┘
     └─→ D-d (lead-sources) ── (independent)
```

- **Critical path:** D-0 → D-a(×3) → D-b. Everything else parallelizes off it.
- **D-d** (lead-sources) is independent of D-a/D-b (greenfield) — start it in parallel after D-0.
- **D-b** is gated on ALL THREE of D-a completing (it deletes the shim they depend on).
- **D-e** (projects) is independent of D-a/D-b (projects has no spec.hooks today) but is placed last for a clean review surface; it needs only D-0's docstring correction.

**Deferred tail (NOT in this plan's done-when):**
- **D-c · non-tx bypass elimination — DEFERRED.** `accounting.service.ts` (projects `qbSubCustomerId`), `providers/ai/client.ts` (proposals `projectJSON`), `voip/compliance.service.ts` (customers DNC, conditional write → bespoke DAL fn), `voip/voip-link-tokens.service.ts` (`purgeExpired`, bulk delete → bespoke DAL fn). These callers are mostly stubbed / slated for a complete overhaul; migrating their writes now is rework. Revisit when those services are overhauled. **Verified targets (for whoever picks this up):** accounting → `projectCrud.update`; ai/client → `proposalCrud.update` (fires recompute); compliance → new bespoke customers-DAL fns `markCustomerDnc`/`clearCustomerDnc` (the `isNull(dncOptedOutAt)` idempotency guard rules out `crud.update`); voip purge → bespoke `purgeExpiredLinkTokens` in the voip-link-tokens entity DAL (bulk predicate-delete rules out `crud.delete`). The epic §6-D:225 register's line refs are stale — use these.
- **#285** projects security tightening (swap `agentProcedure → projectProcedure`, `delete` gate on `can('delete','Project')`); field-authz. Do not build here.
- **crux-2** in-tx parent+child atomicity (project row + scopes; incentives child-replace). Do not build here.

---

## Task D-0: Correct stale code comments

The epic (§6-D) is already corrected. This task fixes the **code** comments the grill exposed as stale, so they stop misleading future readers. Docs-only; no runtime change.

**Files:**
- Modify: `src/shared/entities/projects/lib/server-spec.ts:24-43` (docstring)
- Modify: `src/shared/entities/projects/dal/server/crud.ts:4-14` (docstring)
- Modify: `src/trpc/DOCS.md` (the pre-A hook-model text — grep for it)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing (comments only). Later tasks overwrite these files' code but not these corrected comments.

- [ ] **Step 1: Read the current comments**

Read `src/shared/entities/projects/lib/server-spec.ts:24-43`. The stale claim is: *"Migrating the router also TIGHTENS behavior (create/update/delete gain `ctx.scope`; `delete` gates on `can('delete','Project')`…)"*. This conflates route-through-crud with scope-tightening — they are separable (project mutations are unscoped today; routing through crud with bare `agentProcedure` keeps `ctx.scope` undefined).

- [ ] **Step 2: Rewrite the projects server-spec docstring**

Replace the `SCOPE (S5a): …` paragraph (lines 30-42) with:

```ts
 * SCOPE (S5a): this ships the spec + `projectCrud` (`dal/server/crud.ts`). Sub-plan D
 * (2026-08-19) routes the full project lifecycle through `projectCrud` via the
 * `create/updateProjectWithScopes` abstractions (scopeIds as a call-site closure)
 * and a `delete.before` R2-cleanup hook. Routing is **behavior-preserving**: the
 * router keeps bare `agentProcedure`, so `ctx.scope` stays `undefined` (unscoped —
 * identical to the pre-D feature-DAL path). Security tightening (route onto
 * `projectProcedure` for `ctx.scope`; gate `delete` on `can('delete','Project')`)
 * is the SEPARATE #285 tail — routing through crud does NOT tighten scope.
```

- [ ] **Step 3: Rewrite the projects crud.ts docstring**

In `src/shared/entities/projects/dal/server/crud.ts:4-14`, the docstring says lifecycle side-effects "are NOT here yet … until those mutations are routed through `createCrudDal`." D-e makes that true. Since D-e rewrites this file anyway, leave a one-line placeholder note here now and let D-e finalize it:

```ts
/**
 * Stable CRUD handlers for the projects entity. Sub-plan D routes the full
 * lifecycle through here — see `create/updateProjectWithScopes` below and the
 * `delete.before` R2-cleanup hook.
 */
```

(If executing D-0 and D-e in the same session, you may skip this step and let D-e write the final docstring — but leaving it correct now prevents a stale window.)

- [ ] **Step 4: Fix the trpc/DOCS.md hook-model text**

Grep: `grep -n "synthesizeFromSpec\|spec.hooks\|spec\\.hooks\|hooks live on\|EntityServerSpec.*hooks" src/trpc/DOCS.md`. Find the passage (~lines 185, 203 per the epic) describing hooks as living on the spec. Update it to: hooks live in the entity's `dal/server/crud.ts` config factory (`createCrudDal(spec, configFactory)`); `EntityServerSpec` no longer carries `hooks`/`duplicate` after Sub-plan D. Keep it to the minimal factual correction.

- [ ] **Step 5: Verify**

Run: `pnpm lint` (comments/markdown). `pnpm tsc` (should be unaffected — no code changed).
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/shared/entities/projects/lib/server-spec.ts src/shared/entities/projects/dal/server/crud.ts src/trpc/DOCS.md
git commit -m "docs(crud-dal): correct stale hook-model + projects-scope comments (D-0)"
```

---

## Task D-a1: Relocate customers hooks onto the config factory

Move `customerServerSpec.hooks` into a config factory in `customers/dal/server/crud.ts`. All 3 hooks are **pure moves** (no self-`crud`; delete cascade uses cross-entity `meetingCrud` + raw `db`). The delete hook's signature changes from `(id) → (row)` per G4.

**Files:**
- Modify: `src/shared/entities/customers/dal/server/crud.ts`
- Modify: `src/shared/entities/customers/lib/server-spec.ts` (remove `hooks`)

**Interfaces:**
- Consumes: `createCrudDal(spec, configFactory)` from [create-crud-dal.ts](src/shared/dal/server/lib/create-crud-dal.ts); the config-factory shape `(crudHandlers) => ({ hooks, duplicate })` (see meetings exemplar).
- Produces: `customerCrud` (unchanged export name/type) with hooks now firing via the factory. `customerServerSpec` no longer has `.hooks`.

- [ ] **Step 1: Read the exemplar and the current customers crud.ts**

Read [meetings/dal/server/crud.ts](src/shared/entities/meetings/dal/server/crud.ts) (the canonical config-factory shape) and the current `src/shared/entities/customers/dal/server/crud.ts`.

- [ ] **Step 2: Move the hooks into the config factory**

Rewrite `src/shared/entities/customers/dal/server/crud.ts` so `createCrudDal(customerServerSpec, () => ({ hooks: {...} }))` carries the two hook slots. Copy the hook BODIES verbatim from `customers/lib/server-spec.ts` (lines 48-143), adapting ONLY the delete signature (`id` → `row`, using `row.id` where the body used `String(id)`):

```ts
import { eq, inArray } from 'drizzle-orm'

import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { meetings, proposals } from '@/shared/db/schema'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import { propagateCustomerChangeJob } from '@/shared/services/providers/upstash/jobs/propagate-customer-change'

export const customerCrud = createCrudDal(customerServerSpec, () => ({
  hooks: {
    update: {
      // see ../../lib/server-spec.ts history — geocode-cache invalidation.
      async before(data, _ctx) {
        const addressKeys = ['address', 'city', 'state', 'zip'] as const
        const addressChanged = addressKeys.some(
          k => k in data && (data as Record<string, unknown>)[k] !== undefined,
        )
        if (!addressChanged) {
          return data
        }
        const coordsBeingSet
          = ('latitude' in data && (data as Record<string, unknown>).latitude !== undefined)
            || ('longitude' in data && (data as Record<string, unknown>).longitude !== undefined)
        if (coordsBeingSet) {
          return data
        }
        return { ...data, latitude: null, longitude: null, geocodedAt: null }
      },
      // @migration(ably-realtime-kernel) — carried over verbatim; do not action.
      // Strict dispatch: a missed enqueue leaves synced GCal events stale.
      // see docs/codebase-conventions/service-architecture.md#background-side-effects-via-qstash-jobs
      async after(row, _ctx, _meta) {
        await propagateCustomerChangeJob.dispatchOrThrow({ customerId: row.id })
      },
    },
    delete: {
      // G4: engine prefetches the row. Cascade: delete proposals → meetings
      // (via meetingCrud so each meeting's GCal cleanup fires) before the
      // customer row is removed. Non-atomic + partial-tolerant (documented).
      async before(row, _ctx) {
        const customerId = row.id
        const customerMeetings = await db
          .select({ id: meetings.id })
          .from(meetings)
          .where(eq(meetings.customerId, customerId))
        if (customerMeetings.length === 0) {
          return
        }
        const meetingIds = customerMeetings.map(m => m.id)
        await db.delete(proposals).where(inArray(proposals.meetingId, meetingIds))
        for (const m of customerMeetings) {
          dalVerifySuccess(await meetingCrud.delete(SYSTEM_CONTEXT, { id: m.id }))
        }
      },
    },
  },
}))
```

Preserve the full verbatim comment blocks from the source hooks (abbreviated above for the plan — copy the real ones). Keep the `duplicate` behavior: customers has no `duplicate` config today, so omit it.

- [ ] **Step 3: Strip `hooks` from `customerServerSpec`**

In `src/shared/entities/customers/lib/server-spec.ts`, delete the entire `hooks: { … }` block (lines 48-144) and its now-unused imports (`eq`, `inArray`, `dalVerifySuccess`, `SYSTEM_CONTEXT`, `db`, `meetings`, `proposals`, `meetingCrud`, `propagateCustomerChangeJob`). Keep `customerVisibility`, the schemas, and the `satisfies EntityServerSpec` tail. **Watch for a circular import:** `crud.ts` now imports `customerServerSpec` from `server-spec.ts`, and `server-spec.ts` must NOT import from `crud.ts` (it doesn't — good).

- [ ] **Step 4: Verify types + lint**

Run: `pnpm tsc` then `pnpm lint`.
Expected: green. If `tsc` flags an unused import in server-spec.ts, remove it. If it flags a hook-signature mismatch, compare against the `CrudSlotHookMap` in [types.ts](src/shared/dal/server/types.ts) (delete `before` takes `(row, ctx)`).

- [ ] **Step 5: Smoke-test the cascade (behavior-preserving check)**

Write `scripts/tmp-smoke-customer-cascade.ts` (starts with `import './lib/load-env'`): create a dev customer + meeting + proposal via the cruds, then `customerCrud.delete(SYSTEM_CONTEXT, { id })`, and assert the meeting + proposal rows are gone. Run `pnpm tsx scripts/tmp-smoke-customer-cascade.ts`. Delete the script after.

- [ ] **Step 6: Commit**

```bash
git add src/shared/entities/customers/dal/server/crud.ts src/shared/entities/customers/lib/server-spec.ts
git commit -m "refactor(dal): relocate customers hooks to config factory (D-a1)"
```

---

## Task D-a2: Relocate proposals hooks onto the config factory

Move `proposalServerSpec.hooks` **and** `proposalServerSpec.duplicate` into a config factory. All 5 hooks are **pure moves** (create.after + update.after call the naked `recomputeProposalFinancials`; create.before uses cross-entity `meetingCrud`; no self-`crud`).

> **Retiring-seam note (verified 2026-08-19 vs JSONB waves):** relocate the `update.after` trigger `'startingTcpCents' in meta.input || 'projectJSON' in meta.input` **verbatim** — it is current and correct today. But the `'projectJSON' in meta.input` clause is a **known JSONB Wave 4 change target**: `projectJSON` is still a live `NOT NULL` column whose SOW section-incentives feed `finalTcpCents` (`recomputeProposalFinancials` still walks `jsonb_array_elements(projectJSON->'data'->'sow')`), and W4 (SOW normalization, not yet started) will move section incentives to `proposal_incentives` rows and drop that clause. Do NOT "future-proof" or edit the trigger here — move it as-is; W4 owns its removal.

**Files:**
- Modify: `src/shared/entities/proposals/dal/server/crud.ts`
- Modify: `src/shared/entities/proposals/lib/server-spec.ts` (remove `hooks` + `duplicate`; keep `shareable`)

**Interfaces:**
- Consumes: `recomputeProposalFinancials` (naked DAL fn, unchanged) from [proposals/dal/server/mutations.ts](src/shared/entities/proposals/dal/server/mutations.ts); `meetingCrud`.
- Produces: `proposalCrud` (unchanged export) with hooks + duplicate firing via the factory. `proposalServerSpec` keeps only `shareable`.

- [ ] **Step 1: Read the current proposals crud.ts + server-spec.ts**

Read both files. Note `duplicate.overrides` uses `ctx.session!.user.id` — this moves verbatim.

- [ ] **Step 2: Move hooks + duplicate into the config factory**

Rewrite `src/shared/entities/proposals/dal/server/crud.ts`:

```ts
import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT, ThrowableDalError } from '@/shared/dal/server/types'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { recomputeProposalFinancials } from '@/shared/entities/proposals/dal/server/mutations'
import { getProposalLockSignals } from '@/shared/entities/proposals/dal/server/queries'
import { deriveProposalKind } from '@/shared/entities/proposals/lib/derive-proposal-kind'
import { generateShareToken } from '@/shared/entities/proposals/lib/generate-share-token'
import { isProposalFrozen, touchesFrozenLockedFields } from '@/shared/entities/proposals/lib/proposal-lock'
import { snapSowFromMeeting } from '@/shared/entities/proposals/lib/snap-sow-from-meeting'
import { proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'

export const proposalCrud = createCrudDal(proposalServerSpec, () => ({
  hooks: {
    create: {
      // see ../../DOCS.md#kind-derived-from-meeting-project (carry full comments)
      async before(input, _ctx) {
        if (!input.meetingId) {
          return { ...input, kind: deriveProposalKind(null), token: generateShareToken() }
        }
        const meeting = dalVerifySuccess(
          await meetingCrud.getById(SYSTEM_CONTEXT, { id: input.meetingId }),
        )
        const kind = deriveProposalKind(meeting?.projectId ?? null)
        const token = generateShareToken()
        const enriched = snapSowFromMeeting(input, meeting?.flowStateJSON ?? null)
        return { ...enriched, kind, token }
      },
      async after(row, _ctx) {
        dalVerifySuccess(await recomputeProposalFinancials(row.id))
      },
    },
    update: {
      // Whole-proposal lock ladder (#264). see ../../DOCS.md#proposal-lock-ladder
      async before(input, _ctx, meta) {
        if (!touchesFrozenLockedFields(input)) {
          return input
        }
        const signals = dalVerifySuccess(await getProposalLockSignals(String(meta.id)))
        if (isProposalFrozen(signals)) {
          throw new ThrowableDalError({ type: 'precondition-failed', reason: 'proposal_frozen' })
        }
        return input
      },
      async after(row, _ctx, meta) {
        if ('startingTcpCents' in meta.input || 'projectJSON' in meta.input) {
          dalVerifySuccess(await recomputeProposalFinancials(row.id))
        }
      },
    },
  },
  duplicate: {
    exclude: [
      'createdAt', 'updatedAt', 'status', 'kind', 'token', 'sentAt', 'approvedAt',
      'contractSentAt', 'contractViewedAt', 'contractSignedAt', 'contractDeclinedAt',
      'contractEnvelopeId', 'qbInvoiceId', 'qbPaymentStatus',
    ],
    overrides: (source, ctx) => ({
      label: `Copy of ${source.label}`,
      ownerId: ctx.session!.user.id,
      status: 'draft' as const,
    }),
  },
}))
```

Copy the FULL verbatim comment blocks from the source. Note the current `crud.ts` likely already builds `proposalCrud` 1-arg — replace that call.

- [ ] **Step 3: Strip `hooks` + `duplicate` from `proposalServerSpec`**

In `server-spec.ts` delete the `hooks` block (40-95) and the `duplicate` block (100-122). **Keep** `shareable: { tokenColumn: 'token' }`, `visibility`, schemas. Remove now-unused imports (`dalVerifySuccess`, `SYSTEM_CONTEXT`, `ThrowableDalError`, `meetingCrud`, `recomputeProposalFinancials`, `getProposalLockSignals`, `deriveProposalKind`, `generateShareToken`, `isProposalFrozen`, `touchesFrozenLockedFields`, `snapSowFromMeeting`).

- [ ] **Step 4: Verify**

`pnpm tsc` then `pnpm lint`. Expected: green.

- [ ] **Step 5: Smoke-test recompute fires**

Write `scripts/tmp-smoke-proposal-recompute.ts` (`import './lib/load-env'`): create a proposal via `proposalCrud.create`, read `finalTcpCents` (should be set by create.after), then `proposalCrud.update` with `{ startingTcpCents: <new> }` and assert `finalTcpCents` re-converged. Run, then delete.

- [ ] **Step 6: Commit**

```bash
git add src/shared/entities/proposals/dal/server/crud.ts src/shared/entities/proposals/lib/server-spec.ts
git commit -m "refactor(dal): relocate proposals hooks + duplicate to config factory (D-a2)"
```

---

## Task D-a3: Relocate customer-notes hooks (circular-barrier rewrite)

customer-notes is the one entity whose `update.before`/`delete.before` reach their OWN `customerNoteCrud` via `await import('../dal/server/crud')` (lazy import breaking a TDZ cycle). The config factory hands `crudHandlers` in as an argument, dissolving the lazy import. `delete.before` further collapses via G4 (receives the row → no `getById` needed).

**Files:**
- Modify: `src/shared/entities/customer-notes/dal/server/crud.ts`
- Modify: `src/shared/entities/customer-notes/lib/server-spec.ts` (remove `hooks`)

**Interfaces:**
- Consumes: the `crudHandlers` factory arg (typed `CrudHandlers<typeof customerNotes>`); cross-entity `customerCrud` + `customerServerSpec` (for the visibility probe); `buildUserContext`, `assertNoteAuthorOrAdmin`.
- Produces: `customerNoteCrud` with hooks firing via the factory; the lazy `import('../dal/server/crud')` is GONE.

- [ ] **Step 1: Read the current customer-notes crud.ts + server-spec.ts**

Read both. The key rewrite: `update.before` and `delete.before` currently do `const { customerNoteCrud } = await import('../dal/server/crud')` then `customerNoteCrud.getById(...)`. In the factory, use the `crudHandlers` arg directly (`crudHandlers.getById(...)`). `delete.before` no longer needs `getById` at all — the engine hands it the row (G4), so it just runs `assertNoteAuthorOrAdmin(row, ctx)`.

- [ ] **Step 2: Write the config factory**

Rewrite `src/shared/entities/customer-notes/dal/server/crud.ts`:

```ts
import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { buildUserContext, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT, ThrowableDalError } from '@/shared/dal/server/types'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import { assertNoteAuthorOrAdmin } from '@/shared/entities/customer-notes/lib/assert-note-author'
import { customerNoteServerSpec } from '@/shared/entities/customer-notes/lib/server-spec'

export const customerNoteCrud = createCrudDal(customerNoteServerSpec, crudHandlers => ({
  hooks: {
    create: {
      // Probe target customer is visible + stamp authorId (issue #280).
      // MUST probe with the CUSTOMER's own visibility, not ctx.scope — carry
      // the full comment block from the old spec hook verbatim.
      async before(input, ctx) {
        const userId = ctx.session?.user.id
        const isOmni = ctx.ability?.can('manage', 'all') ?? false
        const probeCtx = (!userId || isOmni)
          ? SYSTEM_CONTEXT
          : buildUserContext(userId, ctx.session!.user.role, customerServerSpec)
        const customer = dalVerifySuccess(await customerCrud.getById(probeCtx, { id: input.customerId }))
        if (!customer) {
          throw new ThrowableDalError({ type: 'not-found' })
        }
        return { ...input, authorId: userId ?? input.authorId ?? null }
      },
    },
    update: {
      // Own-entity read now via the crudHandlers arg — no lazy import.
      async before(data, ctx, { id }) {
        const note = dalVerifySuccess(await crudHandlers.getById(ctx, { id: String(id) }))
        if (!note) {
          throw new ThrowableDalError({ type: 'not-found' })
        }
        assertNoteAuthorOrAdmin(note, ctx)
        return data
      },
    },
    delete: {
      // G4: engine hands us the row — no getById, no lazy import.
      async before(row, ctx) {
        assertNoteAuthorOrAdmin(row, ctx)
      },
    },
  },
}))
```

- [ ] **Step 3: Strip `hooks` from `customerNoteServerSpec`**

In `server-spec.ts` delete the `hooks` block (43-107) and the now-unused imports (`buildUserContext`, `dalVerifySuccess`, `SYSTEM_CONTEXT`, `ThrowableDalError`, `customerCrud`, `customerServerSpec`, `assertNoteAuthorOrAdmin`). Keep the schemas (`insertCustomerNoteSchemaBounded`, etc.), `customerNoteVisibility`, `CUSTOMER_NOTE`. **Verify the TDZ cycle is truly gone:** `server-spec.ts` must no longer import anything from `dal/server/crud.ts` (it never did — the lazy import lived in the hook). The old comment (lines 78-87) warning against a top-level `crud.ts` import is now obsolete — it lived in the hook body being moved, so it's deleted with the block.

- [ ] **Step 4: Verify (types + the cycle)**

`pnpm tsc` then `pnpm lint`. Expected: green. The cycle was invisible to `tsc` (runtime TDZ), so ALSO smoke it: Step 5.

- [ ] **Step 5: Smoke-test the author-gate + no TDZ crash**

Write `scripts/tmp-smoke-customer-notes.ts` (`import './lib/load-env'`) that **imports `customerNoteServerSpec` FIRST** (the old cycle entry point — `import { customerNoteServerSpec } from '.../lib/server-spec'` then `import { customerNoteCrud } from '.../dal/server/crud'`), creates a note, updates it as the author (succeeds), and attempts an update as a non-author non-admin ctx (expect `precondition`/forbidden from `assertNoteAuthorOrAdmin`). No `ReferenceError: Cannot access '…' before initialization` should occur. Run, then delete.

- [ ] **Step 6: Commit**

```bash
git add src/shared/entities/customer-notes/dal/server/crud.ts src/shared/entities/customer-notes/lib/server-spec.ts
git commit -m "refactor(dal): relocate customer-notes hooks via crudHandlers arg (D-a3)"
```

---

## Task D-b: Delete the `synthesizeFromSpec` shim

With all three spec-hook entities relocated, the ONLY reader of `spec.hooks`/`spec.duplicate` is `synthesizeFromSpec`. Delete it, default the config to `{}`, and purge `hooks`/`duplicate` from the `EntityServerSpec` type. Hookless entities (voip ×8, applications) stay clean 1-arg `createCrudDal(spec)` — nothing to migrate.

**Files:**
- Modify: `src/shared/dal/server/lib/create-crud-dal.ts` (delete `synthesizeFromSpec`; default `cfg`)
- Modify: `src/shared/dal/server/types.ts` (strip `hooks` + `duplicate` from `EntityServerSpec`)
- Modify: `src/trpc/DOCS.md` (final hook-model text — most of this was done in D-0; confirm)

**Interfaces:**
- Consumes: nothing new.
- Produces: `EntityServerSpec` with no `hooks`/`duplicate` fields; `createCrudDal(spec)` with no factory yields an empty config (no hooks fire).

- [ ] **Step 1: Confirm zero remaining `spec.hooks`/`spec.duplicate` consumers**

Run:
```bash
grep -rn "\.hooks\b" src/shared/entities/*/lib/server-spec.ts
grep -rn "spec\.hooks\|spec\.duplicate\|\.duplicate\b" src/shared/dal/server/lib/create-crud-dal.ts
grep -rn "synthesizeFromSpec" src
```
Expected: no `hooks`/`duplicate` on any `server-spec.ts` (D-a cleared the last three); `synthesizeFromSpec` only in `create-crud-dal.ts`. If any entity still declares `spec.hooks`, STOP — that entity was missed; relocate it first.

- [ ] **Step 2: Default `cfg` to `{}` and delete `synthesizeFromSpec`**

In `create-crud-dal.ts`, change lines 57-59:
```ts
  const cfg: CrudConfig<TTable, TId> = configFactory
    ? configFactory(crudHandlers)
    : {}
```
Delete the entire `synthesizeFromSpec` function (lines 75-106) and remove its reference in the doc-comment at the top of the file (lines ~11-14, the "synthesized from the deprecated `spec.hooks`" note).

- [ ] **Step 3: Strip `hooks` + `duplicate` from `EntityServerSpec`**

In `types.ts`, delete the `hooks?: { … }` block (lines 188-227) and the `duplicate?: { … }` block (lines 228-243) from the `EntityServerSpec` interface. Keep `CrudConfig`, `CrudHooks`, `CrudConfigFactory`, `CrudSlotHookMap` (those are the NEW factory types — still used). **#285 coordination:** #285 also edits this interface (strips `visibility`) — disjoint field removals; whoever rebases second re-applies. No need to coordinate live.

- [ ] **Step 4: Verify**

`pnpm tsc` then `pnpm lint`. Expected: green. If `tsc` errors that some entity's `satisfies EntityServerSpec` now fails, that entity still had a `hooks`/`duplicate` key — go back to Step 1.

- [ ] **Step 5: Finalize trpc/DOCS.md**

Confirm the hook-model passage (touched in D-0) no longer references `synthesizeFromSpec` or spec-carried hooks anywhere. Grep `grep -n "synthesizeFromSpec\|spec.hooks" src/trpc/DOCS.md` → expect no results.

- [ ] **Step 6: Commit**

```bash
git add src/shared/dal/server/lib/create-crud-dal.ts src/shared/dal/server/types.ts src/trpc/DOCS.md
git commit -m "refactor(dal): delete synthesizeFromSpec shim + purge spec.hooks/duplicate (D-b)"
```

---

## Task D-d: Standardize lead-sources onto the entity pattern

`lead-sources` has NO server-spec, NO crud, NO CASL subject, NO visibility — only bespoke DAL + a hand-rolled router. Standardize it: author the full entity setup and route the router's CRUD procedures through `leadSourceCrud`. The genuine business logic (unique-slug generation, token rotation on slug change, duplicate copy semantics, attached-customer delete precondition) moves into config-factory hooks. The analytics procedures (getStats/getAnalytics/etc.) stay AS-IS. Canonical reference for the full entity shape: [docs/how-to/add-an-entity.md](docs/how-to/add-an-entity.md) + the meetings entity.

> This is the largest task. Sub-step it carefully; commit at the end (or after Step 6 if splitting).

**Files:**
- Create: `src/shared/entities/lead-sources/lib/constants.ts`, `lib/visibility.ts`, `lib/server-spec.ts`, `dal/server/crud.ts`
- Modify: `src/shared/domains/permissions/abilities.ts`, `src/trpc/routers/lead-sources.router.ts`

**Interfaces:**
- Consumes: `createCrudDal`; `insertLeadSourceSchema`/`selectLeadSourceSchema`/`leadSourcesTable` (already exist in [db/schema/lead-sources.ts](src/shared/db/schema/lead-sources.ts)); `slugify`, `generateToken`.
- Produces: `LEAD_SOURCE` constant; `leadSourceServerSpec`; `leadSourceCrud`; router CRUD procedures routing through `leadSourceCrud`.

- [ ] **Step 1: Add the CASL subject / entity name**

In `abilities.ts`: create `src/shared/entities/lead-sources/lib/constants.ts` with `export const LEAD_SOURCE = 'LeadSource' as const`, import it into `abilities.ts`, and add `LEAD_SOURCE` to the `ENTITY_NAMES` array (line 46-66). Add `AppSubject` wiring the same way sibling entities do (grep how `PROJECT`/`CUSTOMER` flow into `AppSubject`). Since lead-sources is **super-admin-only** (router uses `superAdminProcedure`), no agent grants are needed — super-admin's `can('manage','all')` covers it. Add a one-line comment noting agents have no lead-source access by design.

- [ ] **Step 2: Author visibility (minimal — super-admin-only)**

Create `lib/visibility.ts`. Because the only caller is `superAdminProcedure` (omni → `scope: null`), the visibility predicate is never exercised for row-scoping today. Provide a conservative predicate that resolves to "own or none" for non-omni, mirroring the simplest sibling (e.g. a `sql\`false\`` deny-by-default, since no non-omni actor should list lead sources). Document that omni bypasses it. Example:
```ts
import { sql } from 'drizzle-orm'
import type { VisibilityScope } from '@/shared/dal/server/types'
// Super-admin-only entity: non-omni actors see nothing. Omni callers
// (superAdminProcedure resolves scope:null) bypass this entirely.
export function leadSourceVisibility(_scope: VisibilityScope) {
  return sql`false`
}
```

- [ ] **Step 3: Author schemas + server-spec**

Create `lib/server-spec.ts`. The insert/update schemas: `insertLeadSourceSchema` exists (omits id/createdAt/updatedAt). Build `update` as `insertLeadSourceSchema.partial()`. Then:
```ts
import type { EntityServerSpec } from '@/shared/dal/server/types'
import { insertLeadSourceSchema, leadSourcesTable, selectLeadSourceSchema } from '@/shared/db/schema/lead-sources'
import { LEAD_SOURCE } from './constants'
import { leadSourceVisibility } from './visibility'

const updateLeadSourceSchema = insertLeadSourceSchema.partial()
export const leadSourceSchemas = { insert: insertLeadSourceSchema, update: updateLeadSourceSchema }

export const leadSourceServerSpec = {
  entityName: LEAD_SOURCE,
  caslSubject: LEAD_SOURCE,
  visibility: leadSourceVisibility,
  table: leadSourcesTable,
  schemas: { insert: insertLeadSourceSchema, update: updateLeadSourceSchema, select: selectLeadSourceSchema },
} satisfies EntityServerSpec<typeof leadSourcesTable>
```

- [ ] **Step 4: Author the config factory with the business-logic hooks**

The router's `create`/`update`/`duplicate`/`delete` carry real logic. Move it into hooks in `dal/server/crud.ts`. **Slug uniqueness + token generation** are the hard parts — the current `create` generates a unique slug + token BEFORE insert; `update` rotates the token only when the slug actually changes and rejects malformed/duplicate slugs. Model these as `create.before` / `update.before`:

```ts
import { and, eq, ne } from 'drizzle-orm'
import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT, ThrowableDalError } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'
import { generateToken } from '@/shared/lib/generate-token'
import { slugify } from '@/shared/lib/slugify'
import { leadSourceServerSpec } from '@/shared/entities/lead-sources/lib/server-spec'

// Bespoke helper (kept in-DAL, §5.9): unique slug generation.
async function generateUniqueSlug(base: string): Promise<string> {
  const root = slugify(base, { maxLen: 64 }) || 'source'
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`
    const [existing] = await db.select({ id: leadSourcesTable.id }).from(leadSourcesTable)
      .where(eq(leadSourcesTable.slug, candidate)).limit(1)
    if (!existing) return candidate
  }
  throw new ThrowableDalError({ type: 'precondition-failed', reason: 'slug_generation_exhausted' })
}

export const leadSourceCrud = createCrudDal(leadSourceServerSpec, crudHandlers => ({
  hooks: {
    create: {
      // Router previously accepted only { name, formConfigJSON } and derived
      // slug/token/isActive. Preserve: generate a unique slug + token; default
      // isActive true. Callers passing an explicit slug are honored only if it
      // is unique (keep parity with the old generateUniqueSlug-on-name path).
      async before(input, _ctx) {
        const slug = input.slug ?? await generateUniqueSlug(input.name)
        return { ...input, slug, token: input.token ?? generateToken(), isActive: input.isActive ?? true }
      },
    },
    update: {
      // Token rotates ONLY when the slug actually changes (a no-op save must
      // not rotate live intake URLs). Reject malformed slugs + duplicates.
      async before(data, _ctx, { id }) {
        if (data.slug === undefined) return data
        if (slugify(data.slug, { maxLen: 64 }) !== data.slug) {
          throw new ThrowableDalError({ type: 'precondition-failed', reason: 'slug_malformed' })
        }
        const current = dalVerifySuccess(await crudHandlers.getById(SYSTEM_CONTEXT, { id: String(id) }))
        if (!current) throw new ThrowableDalError({ type: 'not-found' })
        if (data.slug === current.slug) return data // no-op → no token rotation
        const [dupe] = await db.select({ id: leadSourcesTable.id }).from(leadSourcesTable)
          .where(and(eq(leadSourcesTable.slug, data.slug), ne(leadSourcesTable.id, String(id)))).limit(1)
        if (dupe) throw new ThrowableDalError({ type: 'precondition-failed', reason: 'slug_duplicate' })
        return { ...data, token: generateToken() }
      },
    },
    delete: {
      // Attached-customer precondition (G4: engine hands us the row).
      async before(row, _ctx) {
        const attached = await db.$count(customers, eq(customers.leadSourceId, row.id))
        if (attached > 0) {
          throw new ThrowableDalError({ type: 'precondition-failed', reason: `lead_source_has_${attached}_customers` })
        }
      },
    },
  },
  duplicate: {
    // Router's duplicate: copy formConfigJSON, new name "(copy)", fresh unique
    // slug + token, isActive false. slug/token come from create.before's fresh
    // generation IF we drop them here; force isActive:false + the "(copy)" name.
    exclude: ['createdAt', 'updatedAt', 'slug', 'token', 'archivedAt'],
    overrides: source => ({ name: `${source.name} (copy)`, isActive: false }),
  },
}))
```

**Important:** the `duplicate` path routes through `createImpl` → `create.before`, so excluding `slug`/`token` makes `create.before` regenerate them (unique slug from the "(copy)" name, fresh token). Verify this matches the old `duplicate` semantics (unique slug, fresh token, inactive).

- [ ] **Step 5: Rewire the router CRUD procedures**

In `lead-sources.router.ts`, replace the bodies of `create`, `update`, `duplicate`, `delete` to call `leadSourceCrud` (via `dalToTrpc`), keeping `superAdminProcedure` and the SAME input schemas the clients send. Example for `create`:
```ts
create: superAdminProcedure
  .input(createInput)
  .mutation(async ({ ctx, input }) => dalToTrpc(await leadSourceCrud.create(ctx, {
    name: input.name, formConfigJSON: input.formConfigJSON,
  }))),
```
For `update`, map `updateInput` → `leadSourceCrud.update(ctx, { id, data: { name, slug, formConfigJSON, isActive } })` (the slug/token logic now lives in the hook — DELETE the inline slug/token/dup-check code from the router). `rotateToken` and `archive` are single-column writes with no crud slot — leave them as bespoke `db.update` inline OR (cleaner) move them into a lead-sources DAL mutation; **minimum bar: keep them working** (they may stay inline for now — they are not in the D-c register and are super-admin-only single-column toggles; note them as a follow-up). `delete`: route through `leadSourceCrud.delete(ctx, { id })` (the precondition is now the hook). Keep ALL analytics procedures (`list`, `getById`, `getStats`, `getAnalytics`, etc.) untouched. `generateUniqueSlug` in the router is now unused — remove it (it lives in the DAL).

- [ ] **Step 6: Verify (types + lint)**

`pnpm tsc` + `pnpm lint`. Expected: green. Common issues: `AppSubject` union needs `LEAD_SOURCE` (Step 1); `insertLeadSourceSchema` may require fields the router's `createInput` doesn't pass (the hook fills slug/token/isActive; check `formConfigJSON` + `name` are the only required-at-call fields).

- [ ] **Step 7: Smoke-test the CRUD + preconditions**

`scripts/tmp-smoke-lead-sources.ts` (`import './lib/load-env'`, use `SYSTEM_CONTEXT`):
1. `create` a source → assert slug + token generated, isActive true.
2. `update` slug to a new value → assert token rotated; `update` slug to the SAME value → assert token unchanged.
3. `duplicate` → assert "(copy)" name, unique slug, fresh token, isActive false.
4. Attach a dev customer (`leadSourceId`), attempt `delete` → expect precondition failure; detach, retry → succeeds.
Run on dev DB, delete after.

- [ ] **Step 8: Commit**

```bash
git add src/shared/entities/lead-sources/lib/constants.ts src/shared/entities/lead-sources/lib/visibility.ts src/shared/entities/lead-sources/lib/server-spec.ts src/shared/entities/lead-sources/dal/server/crud.ts src/shared/domains/permissions/abilities.ts src/trpc/routers/lead-sources.router.ts
git commit -m "feat(dal): standardize lead-sources onto entity pattern + route CRUD through crud (D-d)"
```

---

## Task D-e: Route projects mutations through CRUD

Route the projects lifecycle through `projectCrud` via two named abstractions (`create/updateProjectWithScopes`) that compose `crud.* + { after: setProjectScopes }` INLINE (no tx — matches today's non-atomic order), plus a `delete.before` R2-cleanup hook (G4). Delete the hand-rolled `hasFields` guard (engine G7 handles it). The router keeps bare `agentProcedure` — routing is behavior-preserving; scope-tightening is the #285 tail.

**Files:**
- Modify: `src/shared/entities/projects/dal/server/crud.ts` (config factory + abstractions)
- Modify: `src/shared/entities/projects/dal/server/mutations.ts` (delete create/update/deleteProject; keep `setProjectScopes`)
- Modify: `src/trpc/routers/projects.router/crud.router.ts`

**Interfaces:**
- Consumes: `projectCrud` (base handlers); `setProjectScopes` (stays in mutations.ts); R2 cleanup logic (moves from `deleteProject` into `delete.before`); `mediaFiles`, `r2Client`.
- Produces: `createProjectWithScopes(ctx, data, scopeIds)` / `updateProjectWithScopes(ctx, id, data, scopeIds?)`; `projectCrud` with a `delete.before` R2 hook. `mutations.ts` `createProject`/`updateProject`/`deleteProject` are GONE.

- [ ] **Step 1: Read current projects crud.ts, mutations.ts, crud.router.ts**

(Already mapped: `setProjectScopes` stays; `createProject`/`updateProject`/`deleteProject` become abstractions/hook; `hasFields` guard is superseded by engine G7.)

- [ ] **Step 2: Write the config factory + abstractions in crud.ts**

```ts
import type { InsertProject, Project } from '@/shared/db/schema'
import type { R2BucketName } from '@/shared/services/providers/r2/types'
import type { ScopedContext, DalReturn } from '@/shared/dal/server/types'

import { eq } from 'drizzle-orm'
import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { db } from '@/shared/db'
import { mediaFiles } from '@/shared/db/schema'
import { projectServerSpec } from '@/shared/entities/projects/lib/server-spec'
import { setProjectScopes } from '@/shared/entities/projects/dal/server/mutations'
import { r2Client } from '@/shared/services/providers/r2/client'

export const projectCrud = createCrudDal(projectServerSpec, () => ({
  hooks: {
    delete: {
      // G4: engine hands us the row. R2 media cleanup BEFORE the DB cascade
      // removes media_files rows (moved verbatim from the old deleteProject).
      async before(row, _ctx) {
        const files = await db
          .select({ pathKey: mediaFiles.pathKey, bucket: mediaFiles.bucket })
          .from(mediaFiles)
          .where(eq(mediaFiles.projectId, row.id))
        await Promise.all(
          files
            .filter((f): f is { pathKey: string, bucket: string } => f.pathKey !== null && f.bucket !== null)
            .map(f => r2Client.deleteMediaWithVariants(f.bucket as R2BucketName, f.pathKey)),
        )
      },
    },
  },
}))

/**
 * scopeIds is a CALL-SITE CLOSURE (G2 / §5.11), never engine input. Composes
 * projectCrud.create + an inline `after` child-set — non-atomic, matching the
 * pre-D order (tx deferred with crux-2). No factory hook models scopeIds.
 */
export async function createProjectWithScopes(
  ctx: ScopedContext, data: InsertProject, scopeIds: string[],
): Promise<DalReturn<Project>> {
  return projectCrud.create(ctx, data, {
    after: async (row) => { await setProjectScopes(row.id, scopeIds); return row },
  })
}

export async function updateProjectWithScopes(
  ctx: ScopedContext, id: string, data: Partial<InsertProject>, scopeIds?: string[],
): Promise<DalReturn<Project>> {
  return projectCrud.update(ctx, { id, data }, {
    after: scopeIds === undefined
      ? undefined
      : async (row) => { await setProjectScopes(row.id, scopeIds); return row },
  })
}
```

**G7 note:** a scopes-only update passes `data: {}` — the engine's empty-`.set()` guard (updateImpl:181-195) returns the current row without bumping `updatedAt` and WITHOUT firing `after`. But we NEED `setProjectScopes` to run on a scopes-only update. **This is the one real interface subtlety.** The old `updateProject` ran `setProjectScopes` regardless of `hasFields`. With the engine short-circuiting `after` on empty data, a scopes-only update would skip the scope write. **Resolve:** in `updateProjectWithScopes`, when `data` is empty but `scopeIds` is provided, call `setProjectScopes(id, scopeIds)` directly and return `projectCrud.getById` — do NOT rely on the `after` hook for the empty-data case. Concretely:
```ts
export async function updateProjectWithScopes(
  ctx: ScopedContext, id: string, data: Partial<InsertProject>, scopeIds?: string[],
): Promise<DalReturn<Project>> {
  const hasData = Object.values(data).some(v => v !== undefined)
  if (!hasData && scopeIds !== undefined) {
    // scopes-only: engine would no-op the update (G7) and skip `after`, so set
    // scopes directly. No projects-row write → updatedAt intentionally unbumped.
    await setProjectScopes(id, scopeIds)
    return projectCrud.getById(ctx, { id }) as Promise<DalReturn<Project>>
  }
  return projectCrud.update(ctx, { id, data }, {
    after: scopeIds === undefined ? undefined : async (row) => { await setProjectScopes(row.id, scopeIds); return row },
  })
}
```
(`getById` returns `Row | undefined`; a scopes-only update on a missing project is a caller error — the cast is acceptable, or map undefined → not-found.)

- [ ] **Step 3: Delete the superseded mutations**

In `mutations.ts`, delete `createProject`, `updateProject`, `deleteProject` (with its R2 logic, now in the hook). **Keep `setProjectScopes`.** Remove now-unused imports (`projects`, `InsertProject`/`Project` if unused, `r2Client`, `R2BucketName`, `mediaFiles` — check each). `setProjectScopes` still needs `db`, `eq`, `x_projectScopes`.

- [ ] **Step 4: Rewire the router**

In `crud.router.ts`, keep `agentProcedure` on `create`/`update`/`delete`. Route through the abstractions:
```ts
create: agentProcedure
  .input(projectFormSchema)
  .mutation(async ({ ctx, input }) => {
    const { scopeIds, ...projectData } = input
    return dalToTrpc(await createProjectWithScopes(ctx, projectData, scopeIds ?? []))
  }),

update: agentProcedure
  .input(z.object({ id: z.string().uuid(), data: projectFormSchema.partial() }))
  .mutation(async ({ ctx, input }) => {
    const { scopeIds, ...projectData } = input.data
    return dalToTrpc(await updateProjectWithScopes(ctx, input.id, projectData, scopeIds))
  }),

delete: agentProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    dalToTrpc(await projectCrud.delete(ctx, { id: input.id }))
    return { success: true }
  }),
```
Update imports: drop `createProject`/`updateProject`/`deleteProject`; add `createProjectWithScopes`/`updateProjectWithScopes`/`projectCrud`, `dalToTrpc`. **Behavior check:** `agentProcedure` injects no `ctx.scope` → `and(eq(pk,id), undefined)` → unscoped, identical to today. Confirm `dalToTrpc` exists and maps DalReturn → tRPC (grep sibling routers).

- [ ] **Step 5: Verify + smoke the full lifecycle**

`pnpm tsc` + `pnpm lint`. Then `scripts/tmp-smoke-projects.ts` (`import './lib/load-env'`, `SYSTEM_CONTEXT` or a built agent ctx):
1. `createProjectWithScopes(ctx, data, [scopeA, scopeB])` → assert project row + 2 `x_projectScopes` rows.
2. `updateProjectWithScopes(ctx, id, { title: 'X' }, [scopeA])` → assert title changed AND scopes replaced to 1 row.
3. `updateProjectWithScopes(ctx, id, {}, [])` (scopes-only, empty scopes) → assert scopes cleared, `updatedAt` NOT bumped, title unchanged.
4. Create a `media_files` row for the project (dev), then `projectCrud.delete(ctx, { id })` → assert R2 cleanup ran (mock/observe — R2 side-effect needs the tunnel per [qstash-hooks-need-tunnel]; for a pure DB check, assert the project + its media_files rows are gone). Run on dev DB, delete after.

- [ ] **Step 6: Commit**

```bash
git add src/shared/entities/projects/dal/server/crud.ts src/shared/entities/projects/dal/server/mutations.ts src/trpc/routers/projects.router/crud.router.ts
git commit -m "feat(dal): route projects lifecycle through projectCrud (scopes closure + R2 delete hook) (D-e)"
```

---

## Done-when (Sub-plan D complete)

- [ ] The 3 spec-hook entities (customers, proposals, customer-notes) are relocated onto config factories; `spec.hooks`/`spec.duplicate` no longer appear on any `server-spec.ts`.
- [ ] `synthesizeFromSpec` is deleted; `EntityServerSpec` carries no `hooks`/`duplicate`; `createCrudDal(spec)` (no factory) yields an empty config.
- [ ] (D-c non-tx bypass elimination is DEFERRED — not part of this plan's done-when; see Deferred tail.)
- [ ] lead-sources is standardized (constants + CASL subject + visibility + server-spec + `leadSourceCrud` + router routing through crud); its slug/token/duplicate/delete-precondition logic lives in hooks.
- [ ] projects mutations route through `projectCrud` via `create/updateProjectWithScopes` + the `delete.before` R2 hook; the `hasFields` guard is gone; the router keeps bare `agentProcedure` (unscoped, behavior-preserving).
- [ ] `pnpm tsc` and `pnpm lint` are green.
- [ ] All `scripts/tmp-*.ts` smoke files are deleted.
- [ ] **Nothing waited on #285 or the deferred tx/crux-2 work.**

## Self-Review Notes (for the executor)

- **D-c is deferred** (services stubbed / pending overhaul): the verified per-site targets are recorded in the Deferred tail so the future overhaul doesn't re-derive them. The proposals recompute trigger (`'projectJSON' in meta.input`) is a *pure verbatim move* in D-a2 — safe regardless of D-c.
- **The scopes-only update G7 interaction** (D-e Step 2) is the single non-mechanical subtlety — the empty-data short-circuit skips `after`, so the scopes-only branch sets scopes directly. Do not "simplify" it back into the `after` hook.
- **Type consistency:** `createProjectWithScopes`/`updateProjectWithScopes` return `Promise<DalReturn<Project>>` (router unwraps via `dalToTrpc`); `markCustomerDnc`/`clearCustomerDnc`/`purgeExpiredLinkTokens` return `Promise<DalReturn<{...}>>` (services unwrap per their style). `leadSourceCrud`/`projectCrud`/`customerCrud`/`proposalCrud`/`customerNoteCrud` keep their existing export names and `CrudHandlers` types.
