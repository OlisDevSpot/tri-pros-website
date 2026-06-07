# Customer Router DRY Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the customer-entity-server-spec migration by collapsing the parallel `business.*` mutation surface into the canonical `crud.*` surface, fixing three DAL bypasses (`createFromIntake`, `move-customer-pipeline-item`, `accounting.service`), and enabling the field-level CASL enforcement that makes the collapse safe.

**Architecture:** Three-step substrate: (1) framework enforces field-level CASL in `createCrudRouter.update` — replaces the omni-gate hack; (2) `customerServerSpec` gains `hooks.update.before` for the geocode-reset side effect; (3) UI migrates to `crud.*` procedure-by-procedure, deleting each `business.*` wrapper as its callers move. Each phase is independent, behavior-preserving, and ships with verification.

**Tech Stack:** Next.js 15, tRPC v11, Drizzle ORM (Postgres/Neon), Zod, CASL, better-auth. TypeScript strict. Verification gates: `pnpm tsc` + `pnpm lint`. No build step.

---

## Decisions locked in (from previous conversation)

1. **Field-level CASL inside `crud.update`** — `assertCan` for the `update` slot iterates `Object.entries(data)`, skips `undefined` values, and checks `ability.can('update', spec.caslSubject, field)` for each. Replaces the customers-specific omni-gate override.
2. **`hooks.update.before` for geocode-reset, with guard** — only nulls `latitude`/`longitude`/`geocodedAt` when (a) any of `address`/`city`/`state`/`zip` is in data with a non-undefined value AND (b) the data does NOT contain explicit `latitude` or `longitude` (so a legitimate geocode write-back is not stomped).
3. **`createFromIntake` routes through `customerCrud.create(SYSTEM_CONTEXT, ...)`** — accepts the trade-off that the customer insert is no longer atomic with the note insert (note becomes best-effort).

Plus: yes to all collapses (delete 7 redundant procedures: `getAll`, `getById`, `delete`, `updateProfile`, `updateCreatedAt`, `updateLeadSource`, `updateCustomerContact`, `ensureGeocoded` — 8 total counting ensureGeocoded).

---

## File structure

| File | Phase | Action |
|---|---|---|
| `src/trpc/lib/create-crud-router.ts` | 1 | Modify `assertCan` to accept slot+data and enforce field-level CASL on update |
| `src/trpc/routers/customers.router/index.ts` | 2 | Drop the `handlers.update` omni-gate override (no longer needed) |
| `src/shared/entities/customers/lib/server-spec.ts` | 3 | Add `hooks.update.before` for geocode-reset |
| `src/trpc/routers/customers.router/business.router.ts` | 4 | Refactor `createFromIntake` to use `customerCrud.create(SYSTEM_CONTEXT, ...)` |
| `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts` | 5 | Customer-stage write goes through `customerCrud.update` |
| `src/trpc/routers/customer-pipelines.router.ts` | 5 | Caller passes a constructed ScopedContext |
| `src/shared/services/accounting.service.ts` | 6 | qbCustomerId write goes through `customerCrud.update(SYSTEM_CONTEXT, ...)` |
| `src/trpc/routers/customers.router/business.router.ts` | 7 | Delete `getAll` + `ensureGeocoded` (zero callers) |
| `src/trpc/routers/customers.router/business.router.ts` + `src/shared/components/customer-search.tsx` | 8 | Migrate `business.getById` caller → `crud.getById`; delete `business.getById` |
| `src/trpc/routers/customers.router/business.router.ts` + `src/shared/entities/customers/hooks/use-customer-actions.ts` | 9 | Migrate `business.delete` caller → `crud.delete`; delete `business.delete` |
| `src/trpc/routers/customers.router/business.router.ts` + `src/shared/entities/customers/hooks/use-customer-edit-form.ts` | 10 | Migrate `business.updateProfile` caller → `crud.update`; delete `business.updateProfile` |
| `src/trpc/routers/customers.router/business.router.ts` + 3 UI files | 11 | Migrate `business.updateCreatedAt` callers → `crud.update`; delete `business.updateCreatedAt` |
| `src/trpc/routers/customers.router/business.router.ts` + `src/shared/entities/customers/hooks/use-update-lead-source-mutation.ts` | 12 | Migrate `business.updateLeadSource` caller → `crud.update`; delete `business.updateLeadSource` |
| `src/trpc/routers/customers.router/business.router.ts` + 2 UI files | 13 | Migrate `business.updateCustomerContact` callers → `crud.update`; delete `business.updateCustomerContact` |
| `src/trpc/DOCS.md`, `src/shared/entities/customers/DOCS.md`, `docs/plans/entity-server-migration-punch-list.md` | 14 | Doc updates + punch list strikethroughs |

**Untouched:** `business.list`, `business.search`, `business.addNote`, `business.createFromIntake` (after Phase 4) — all legitimate non-CRUD. The DAL queries.ts, server-spec.ts, and visibility files don't need changes beyond Phase 3.

---

## Phase 1 — Framework: field-level CASL in `createCrudRouter.update`

**Why first:** every subsequent collapse phase depends on `crud.update` correctly enforcing CASL per-field. Without this, dropping the omni-gate in Phase 2 would expose the field-bypass that the omni-gate was preventing.

### Task 1.1: Add field-level CASL enforcement to the `update` slot

**Files:**
- Modify: `src/trpc/lib/create-crud-router.ts:112-124` (the `update` slot) + `:150-162` (the `assertCan` helper)

- [ ] **Step 1: Read the current code**

Confirm `src/trpc/lib/create-crud-router.ts:112-124` matches:

```ts
    update: updateProcedure
      .input(updateInput)
      .mutation(async ({ ctx, input }) => {
        if (ctx.ability) {
          assertCan(ctx.ability, 'update', config.spec)
        }
        // Cast: Zod 4 can't resolve generic TUpdate output type in z.object({ data: TUpdate }).
        // The schema validates at runtime; this tells TS the shape matches CrudHandlers.
        const { id, data } = input as { id: TId, data: z.output<TUpdate>, token?: string }

        const row = dalToTrpc(await handlers.update(ctx, { id, data }))
        return row
      }),
```

And `:150-162` matches the existing `assertCan` (slot-level only).

- [ ] **Step 2: Replace the `update` slot body**

Replace lines 112-124 with:

```ts
    update: updateProcedure
      .input(updateInput)
      .mutation(async ({ ctx, input }) => {
        // Cast: Zod 4 can't resolve generic TUpdate output type in z.object({ data: TUpdate }).
        // The schema validates at runtime; this tells TS the shape matches CrudHandlers.
        const { id, data } = input as { id: TId, data: z.output<TUpdate>, token?: string }

        if (ctx.ability) {
          assertCanUpdateFields(ctx.ability, config.spec, data as Record<string, unknown>)
        }

        const row = dalToTrpc(await handlers.update(ctx, { id, data }))
        return row
      }),
```

- [ ] **Step 3: Add the `assertCanUpdateFields` helper**

Append this function below the existing `assertCan` helper (after line 162):

```ts
/**
 * Field-level CASL gate for the update slot. For every key in `data` whose
 * value is defined, requires `ability.can('update', subject, field)` to return
 * true. Throws FORBIDDEN naming the first field that fails.
 *
 * CASL semantics:
 * - Unrestricted grant (`can('update', 'X')` with no `fields`): every field passes.
 * - Field-restricted grant (`can('update', 'X', ['a', 'b'])`): only 'a' and 'b' pass.
 * - No grant: every field fails.
 * - `manage all`: every field passes.
 *
 * Undefined values are skipped (Drizzle ignores them anyway). Callers that
 * pass `data: { phone: undefined }` are treated as "not attempting to write
 * phone" — same semantics as the input shape itself.
 */
function assertCanUpdateFields(
  ability: { can: (action: AppAction, subject: AppSubject, field?: string) => boolean },
  spec: EntityServerSpec,
  data: Record<string, unknown>,
): void {
  for (const [field, value] of Object.entries(data)) {
    if (value === undefined) {
      continue
    }
    if (!ability.can('update', spec.caslSubject, field)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `You do not have permission to update ${spec.entityName}.${field}`,
      })
    }
  }
}
```

Note: the existing `assertCan` is still used by `create`, `delete`, and `duplicate` slots — leave it alone. The `getById` slot uses `assertCan` too (with `slot='getById'` → action='read'). Only `update` switches to the new helper.

- [ ] **Step 4: Update the `assertCan` type signature for clarity**

The existing `assertCan` is unchanged behaviorally, but its CASL type signature should allow the optional `field` arg so it doesn't diverge from the new helper. Update the parameter type at line 151 from:

```ts
  ability: { can: (action: AppAction, subject: AppSubject) => boolean },
```

to:

```ts
  ability: { can: (action: AppAction, subject: AppSubject, field?: string) => boolean },
```

This is type-only; the function body still calls `ability.can(action, spec.caslSubject)` with no field.

- [ ] **Step 5: tsc + lint**

```bash
pnpm tsc
pnpm lint
```

Expected: same pre-existing `voipCampaignStatuses` error from main. No new errors. Lint exit 0.

- [ ] **Step 6: Verify no proposals regression**

The proposals CASL grant (in `src/shared/domains/permissions/abilities.ts`) has no field restrictions on `update Proposal`. So for every proposals.crud.update call, every `ability.can('update', 'Proposal', field)` check returns true (the unrestricted-grant path) — no behavior change. No need to run the app; the CASL semantics guarantee this. **Confirm** by reading `abilities.ts` and verifying the agent's `update Proposal` rule has no `fields` argument.

- [ ] **Step 7: Commit**

```bash
git add src/trpc/lib/create-crud-router.ts
git commit -m "$(cat <<'EOF'
feat(trpc): enforce field-level CASL on createCrudRouter update slot

The default update gate called `ability.can('update', subject)` with no
field arg, which CASL satisfies for any field-restricted grant — so a
caller with `can('update', 'Customer', ['profileA', 'profileB'])` could
PATCH any column via crud.update, bypassing the per-field intent.

The workaround on customersRouter (commit fd0412ed) was a slot-level
omni-gate that locked out agents entirely. This replaces it with a
field-level enforcement at the framework: iterate the data payload,
check `ability.can('update', subject, field)` for each defined field,
throw FORBIDDEN naming the first failure.

Backward compatible: entities with unrestricted update grants
(proposals, etc.) see no behavior change — the rule satisfies every
field check. Entities with field-restricted grants (customers) now
enforce those restrictions automatically through crud.update.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Drop the omni-gate override on `customersRouter`

**Why:** the framework now enforces field-level CASL on update. The customers-specific omni-gate was a stopgap and would block legitimate agent JSONB updates after Phase 1.

### Task 2.1: Remove the update handler override

**Files:**
- Modify: `src/trpc/routers/customers.router/index.ts`

- [ ] **Step 1: Read the current file**

It currently has `handlers: { getById: ..., update: <omni-gate-override> }`. The `getById` override stays (phone-gating). The `update` override goes.

- [ ] **Step 2: Replace the file**

Replace the entire content with:

```ts
import z from 'zod'

import { getCustomer } from '@/shared/entities/customers/dal/server/queries'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { customerSchemas, customerServerSpec } from '@/shared/entities/customers/lib/server-spec'

import { createTRPCRouter } from '../../init'
import { createCrudRouter } from '../../lib/create-crud-router'
import { createEntityRouter } from '../../lib/create-entity-router'
import { createCustomerBusinessRouter } from './business.router'

export const customersRouter = createEntityRouter(customerServerSpec, (entity) => {
  return createTRPCRouter({
    // ── CRUD (5 single-row operations) ──────────────────────────────────
    // Generated by createCrudRouter. spec.update.jsonbMergeColumns deep-merges
    // the four typed JSONB columns; spec.hooks.delete.before cascades meeting
    // and proposal deletes before the customer row is removed; spec.hooks.update.before
    // resets the geocode cache when address fields change.
    //
    // crud.getById is overridden to return the phone-gated row shape — the
    // default handler from createCrudDal does a plain SELECT * which would
    // include the ungated phone column, violating phone-visibility-threshold.
    // see ../../../shared/entities/customers/DOCS.md#phone-visibility-threshold
    //
    // crud.update uses the framework's field-level CASL enforcement (added in
    // create-crud-router.ts). The agent CASL grant on 'Customer' is field-
    // restricted to the three JSON profile columns; the gate rejects any
    // field outside that allow list automatically.
    crud: createCrudRouter({
      spec: customerServerSpec,
      schemas: { ...customerSchemas, id: z.string().uuid() },
      authedProcedure: entity.authedProcedure,
      shareableProcedure: entity.shareableProcedure,
      handlers: {
        // Cast: getCustomer returns CustomerWithPhoneGate (Customer & { hasSentProposal })
        // which is a structural superset of Row<typeof customers>. The CrudHandlers
        // contract types getById as Row<TTable> | undefined — the extra
        // hasSentProposal field is harmless (callers that don't read it see the
        // standard row shape). The framework-level type for handlers.getById
        // doesn't admit phantom enrichments, so the cast is necessary.
        getById: async (ctx, input) => getCustomer(ctx, input) as ReturnType<typeof customerCrud.getById>,
      },
    }),

    // ── Business queries + entity-specific mutations ────────────────────
    // Hand-coded: list (paginated table), search (phone-gated text search),
    // addNote (writes customer_notes table — different entity), createFromIntake
    // (rate-limited public + multi-step tx). Single-row CRUD mutations live on
    // `crud.*` — agents get there via crud.update (field-CASL-gated), super-
    // admins reach the full surface.
    business: createCustomerBusinessRouter(entity),
  })
})
```

Notes:
- `customerCrud` import is RETAINED because it's used in the `as ReturnType<typeof customerCrud.getById>` cast.
- The `handlers.update` override is gone.
- The comment block reflects the new architecture (field-level CASL, geocode hook coming in Phase 3).
- The Phase 13 deletion of `business.updateCustomerContact` makes the long comment about "agents must use business.update*" wrong — preempt that by writing the comment block in its final form now.

- [ ] **Step 3: tsc + lint**

```bash
pnpm tsc
pnpm lint
```

Expected: clean modulo voipCampaignStatuses.

- [ ] **Step 4: Commit**

```bash
git add src/trpc/routers/customers.router/index.ts
git commit -m "$(cat <<'EOF'
refactor(customers/router): drop crud.update omni-gate, rely on framework field-CASL

Phase 1 added field-level CASL enforcement to createCrudRouter.update.
The customers-specific omni-gate handler override is now redundant — and
would block legitimate agent JSONB-profile updates that the new gate
correctly permits. Drop it; the framework handles the gating uniformly.

handlers.getById override is retained (phone-gating is orthogonal to CASL).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Add `hooks.update.before` for geocode-reset

**Why:** the side effect ("when any address field changes, invalidate the cached geocode") currently lives in `business.updateCustomerContact`. After Phase 13 that procedure goes away. Moving the logic into the spec hook means every `customerCrud.update` path (router, services, future jobs) honors the invariant automatically.

### Task 3.1: Add the hook to `customerServerSpec`

**Files:**
- Modify: `src/shared/entities/customers/lib/server-spec.ts`

- [ ] **Step 1: Read the current file**

It has `update: { jsonbMergeColumns: [...] }` and `hooks: { delete: { before(...) } }`. The new hook adds `hooks.update.before` alongside delete.

- [ ] **Step 2: Add the hook**

Inside the `hooks: {` block of `customerServerSpec`, add a new `update` key BEFORE the existing `delete` key (alphabetical):

```ts
  hooks: {
    update: {
      // see ../DOCS.md#geocoding-stored-on-customer — when any address
      // component changes, invalidate the cached lat/lng/geocodedAt so the
      // map surfaces re-geocode on next read. Guard: skip if the caller is
      // explicitly setting latitude or longitude in the same update (e.g.,
      // a geocode write-back path) — otherwise we'd stomp their own write.
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
        return {
          ...data,
          latitude: null,
          longitude: null,
          geocodedAt: null,
        }
      },
    },
    delete: {
      // existing delete hook — UNCHANGED
      async before(id, _ctx) {
        // ... existing body unchanged ...
      },
    },
  },
```

(Leave the existing delete hook body exactly as-is — only the outer `hooks: {}` gains the `update` key.)

- [ ] **Step 3: Verify the type signature**

`EntityServerSpec.hooks.update.before` has signature `(data: Update<TTable>, ctx: ScopedContext) => Promise<Update<TTable>> | Update<TTable>` per `src/shared/dal/server/types.ts:101-102`. The new function matches.

- [ ] **Step 4: tsc + lint**

```bash
pnpm tsc
pnpm lint
```

Expected: clean modulo voipCampaignStatuses.

- [ ] **Step 5: Commit**

```bash
git add src/shared/entities/customers/lib/server-spec.ts
git commit -m "$(cat <<'EOF'
feat(customers/spec): add hooks.update.before for geocode cache invalidation

When any of address/city/state/zip is in the update payload, null out
latitude/longitude/geocodedAt so map surfaces re-geocode on next read.
Guard: skip the reset if the caller is explicitly setting latitude or
longitude in the same update — that's a legitimate geocode write-back
path (e.g., business.ensureGeocoded, future jobs) and stomping the
caller's coords would defeat the cache the write is trying to populate.

Moves the side effect off of business.updateCustomerContact (slated for
deletion in Phase 13) and onto the spec, so every customerCrud.update
caller — router, services, future jobs — honors the invariant
automatically.

see entities/customers/DOCS.md#geocoding-stored-on-customer

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — `createFromIntake` routes through `customerCrud.create`

**Why:** the public intake form currently does `tx.insert(customers).values(...)` inline. That bypasses any future `hooks.create.*` baked into the spec — the intake path silently diverges. Route through `customerCrud.create(SYSTEM_CONTEXT, ...)` so all customer creates fire the same hooks.

### Task 4.1: Restructure the transaction

**Files:**
- Modify: `src/trpc/routers/customers.router/business.router.ts` (the `createFromIntake` mutation, currently around lines 376–489)

- [ ] **Step 1: Read the current `createFromIntake` body**

The current shape (paraphrased):
1. Rate limit check
2. `mode === 'customer_and_meeting'` precondition: scheduledFor present
3. `db.transaction` start:
   - Resolve lead source slug → id
   - `tx.insert(customers).values(...).returning()` — **the violation**
   - If `notes`, `tx.insert(customerNotes).values(...)`
   - Resolve meeting owner (session or fallback to info@)
4. `db.transaction` end
5. POST-COMMIT: if `mode === 'customer_and_meeting'`, call `meetingCrud.create(...)` (this part already uses the canonical DAL)

- [ ] **Step 2: Read the imports at the top of the file**

Confirm `SYSTEM_CONTEXT` is NOT yet imported. It needs to be added from `@/shared/dal/server/types`. Confirm `dalVerifySuccess` is not yet imported either — it needs to be added from `@/shared/dal/server/lib/helpers`.

- [ ] **Step 3: Add the imports**

Add these imports (alphabetized within the existing groups):

```ts
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
```

- [ ] **Step 4: Rewrite the `createFromIntake` mutation body**

Replace the existing mutation body with the restructured version. Replace the inline `tx.insert(customers)` block with `customerCrud.create(SYSTEM_CONTEXT, ...)`, and accept that the note insert is no longer atomic with the customer insert (note becomes best-effort).

Replace:

```ts
        const { customerId, meetingOwner } = await db.transaction(async (tx) => {
          // Resolve lead source FK: slug -> id, defaulting to 'manual' when absent.
          const resolveSlug = leadSourceSlug ?? 'manual'
          const [leadSourceRow] = await tx
            .select({ id: leadSourcesTable.id })
            .from(leadSourcesTable)
            .where(eq(leadSourcesTable.slug, resolveSlug))
            .limit(1)

          if (!leadSourceRow) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Lead source "${resolveSlug}" not found. Contact an administrator.`,
            })
          }

          // 1. Insert customer
          const [customer] = await tx
            .insert(customers)
            .values({
              ...customerData,
              zip: customerData.zip || '',
              leadSourceId: leadSourceRow.id,
            })
            .returning()

          if (!customer) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create customer' })
          }

          // 2. Insert note (if provided)
          if (notes) {
            await tx.insert(customerNotes).values({
              customerId: customer.id,
              content: notes,
              authorId: session?.user.id ?? null,
            })
          }

          // 3. Resolve meeting owner identity (in-tx so a missing fallback rolls
          //    back the customer insert too — better to fail loudly than create an
          //    orphan customer for an intake that can't be completed).
          let owner: { id: string, role: UserRole } | null = null
          if (mode === 'customer_and_meeting') {
            if (session) {
              owner = { id: session.user.id, role: session.user.role }
            }
            else {
              const [fallbackUser] = await tx
                .select({ id: user.id, role: user.role })
                .from(user)
                .where(eq(user.email, 'info@triprosremodeling.com'))
                .limit(1)

              if (!fallbackUser) {
                throw new TRPCError({
                  code: 'INTERNAL_SERVER_ERROR',
                  message: 'Fallback meeting owner not found. Contact an administrator.',
                })
              }
              owner = { id: fallbackUser.id, role: fallbackUser.role ?? 'agent' }
            }
          }

          return { customerId: customer.id, meetingOwner: owner }
        })
```

With:

```ts
        // Resolve lead source FK: slug -> id, defaulting to 'manual' when absent.
        const resolveSlug = leadSourceSlug ?? 'manual'
        const [leadSourceRow] = await db
          .select({ id: leadSourcesTable.id })
          .from(leadSourcesTable)
          .where(eq(leadSourcesTable.slug, resolveSlug))
          .limit(1)

        if (!leadSourceRow) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Lead source "${resolveSlug}" not found. Contact an administrator.`,
          })
        }

        // 1. Create customer through the canonical DAL — fires any spec hooks
        //    (currently none on create; future hooks will run automatically).
        //    SYSTEM_CONTEXT because this is a public form, not a user-scoped
        //    action — the caller may be unauthenticated.
        const customer = dalVerifySuccess(
          await customerCrud.create(SYSTEM_CONTEXT, {
            ...customerData,
            zip: customerData.zip || '',
            leadSourceId: leadSourceRow.id,
          }),
        )

        // 2. Insert note (best-effort — no longer atomic with the customer
        //    insert, but notes are optional and a failed note doesn't justify
        //    rolling back the customer that the user just successfully submitted).
        if (notes) {
          await db.insert(customerNotes).values({
            customerId: customer.id,
            content: notes,
            authorId: session?.user.id ?? null,
          })
        }

        // 3. Resolve meeting owner identity.
        let meetingOwner: { id: string, role: UserRole } | null = null
        if (mode === 'customer_and_meeting') {
          if (session) {
            meetingOwner = { id: session.user.id, role: session.user.role }
          }
          else {
            const [fallbackUser] = await db
              .select({ id: user.id, role: user.role })
              .from(user)
              .where(eq(user.email, 'info@triprosremodeling.com'))
              .limit(1)

            if (!fallbackUser) {
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Fallback meeting owner not found. Contact an administrator.',
              })
            }
            meetingOwner = { id: fallbackUser.id, role: fallbackUser.role ?? 'agent' }
          }
        }

        const customerId = customer.id
```

The post-commit Phase 2 (meeting creation via `meetingCrud.create`) stays UNCHANGED — it was already correct. Only the customer+note+owner block changes.

- [ ] **Step 5: Audit unused imports**

After the rewrite, `db.transaction` may no longer be the sole caller of `db` — `db.select` and `db.insert` still use it. `tx` is gone entirely. No imports to drop.

- [ ] **Step 6: tsc + lint**

```bash
pnpm tsc
pnpm lint
```

Expected: clean modulo voipCampaignStatuses.

- [ ] **Step 7: Commit**

```bash
git add src/trpc/routers/customers.router/business.router.ts
git commit -m "$(cat <<'EOF'
refactor(customers/router): createFromIntake routes through customerCrud.create

The inline tx.insert(customers) silently bypassed any future spec hooks
on customer creation — making the intake path divergent from every
other create path. Route through customerCrud.create(SYSTEM_CONTEXT, ...)
so every create fires the same hooks.

Trade-off: the customer insert + note insert are no longer co-transactional.
If the note insert fails after the customer succeeds, the customer
survives without its note. Acceptable: notes are optional, and failing
to record a note doesn't justify rolling back a customer the user just
successfully submitted via the public form. The pre-existing meeting-
creation Phase 2 (post-commit, separate transaction) was already non-
atomic; this aligns the customer+note phase to that same model.

SYSTEM_CONTEXT is correct: the form is public, the caller may be
unauthenticated, and customerCrud.create's gates would otherwise
reject. SYSTEM-level callers bypass CASL by design.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — `moveCustomerPipelineItem` routes the customers write through `customerCrud.update`

**Why:** the `pipelineStage` write in the 'leads' branch is the only customers write in this file. Fixing it lets the punch list strike off this row. The other writes in this file (meetings, projects, proposals) are tracked separately and migrate with those entities.

### Task 5.1: Update the signature + customers write

**Files:**
- Modify: `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts` (the `if (pipeline === 'leads')` branch + the function signature)
- Modify: `src/trpc/routers/customer-pipelines.router.ts` (the caller — passes a built ScopedContext)

- [ ] **Step 1: Read the current `move-customer-pipeline-item.ts` signature**

```ts
interface MoveParams {
  customerId: string
  fromStage: string
  toStage: string
  pipeline: Pipeline
  userId: string
  isOmni?: boolean
}

export async function moveCustomerPipelineItem({ customerId, fromStage, toStage, pipeline, userId, isOmni = false }: MoveParams): Promise<void> { ... }
```

- [ ] **Step 2: Identify the caller**

Grep for the function name:
```bash
grep -rn "moveCustomerPipelineItem" /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/refactor-customer-entity-server-spec/src/ --include="*.ts" --include="*.tsx"
```

Expected: a definition + at least one caller in `src/trpc/routers/customer-pipelines.router.ts`. Read that caller to see how `userId` + `isOmni` are passed today.

- [ ] **Step 3: Decide signature**

Two options:
- (a) Keep `userId` / `isOmni` and construct `ScopedContext` INSIDE the function (cleanest from the caller's view; awkward inside because we need to import customerServerSpec + buildUserContext).
- (b) Refactor to accept `ctx: ScopedContext` directly. Caller constructs it via `buildUserContext(ctx.session.user.id, ctx.session.user.role, customerServerSpec)`.

**Use (a).** It contains the change to this file; the caller's API is preserved. Inside the function we'll import the helper. Plus a `userRole` param needs to be added because `buildUserContext` requires the role.

Update the signature:

```ts
interface MoveParams {
  customerId: string
  fromStage: string
  toStage: string
  pipeline: Pipeline
  userId: string
  userRole: UserRole
  isOmni?: boolean
}
```

And add imports at the top:

```ts
import type { UserRole } from '@/shared/constants/enums'
import { buildUserContext } from '@/shared/dal/server/lib/helpers'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
```

(Alphabetize within the existing groups. `dalVerifySuccess` and `buildUserContext` both come from the same module — merge into one import.)

- [ ] **Step 4: Rewrite the 'leads' branch**

Replace lines 27-33:

```ts
  // Leads pipeline: update customers.pipelineStage directly
  if (pipeline === 'leads') {
    await db
      .update(customers)
      .set({ pipelineStage: toStage })
      .where(eq(customers.id, customerId))
    return
  }
```

With:

```ts
  // Leads pipeline: update customers.pipelineStage through customerCrud so any
  // future spec.hooks.update.* fires consistently. The user must be able to see
  // the customer (meeting-participation visibility) for the write to land.
  if (pipeline === 'leads') {
    const ctx = buildUserContext(userId, userRole, customerServerSpec)
    dalVerifySuccess(
      await customerCrud.update(ctx, {
        id: customerId,
        data: { pipelineStage: toStage },
      }),
    )
    return
  }
```

- [ ] **Step 5: Update the caller in `customer-pipelines.router.ts`**

Grep for the call site. Add `userRole: ctx.session.user.role` to the call (alongside the existing `userId: ctx.session.user.id`).

- [ ] **Step 6: tsc + lint**

```bash
pnpm tsc
pnpm lint
```

Expected: clean modulo voipCampaignStatuses.

- [ ] **Step 7: Commit**

```bash
git add src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts src/trpc/routers/customer-pipelines.router.ts
git commit -m "$(cat <<'EOF'
refactor(customer-pipelines): route leads-stage write through customerCrud.update

The leads-pipeline branch did `db.update(customers).set({ pipelineStage })`
inline, bypassing customerServerSpec.hooks.update and any future create-time
or update-time spec logic. Route through customerCrud.update(ctx, ...)
with a constructed user-scoped ScopedContext so the write inherits
visibility scoping and hook execution.

The other branches in this function (meetings, projects, proposals writes)
remain inline — they'll migrate when those entities adopt the entity-
server-spec pattern. Tracked in docs/plans/entity-server-migration-punch-list.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6 — `accounting.service.ts` routes through `customerCrud.update`

**Why:** the `qbCustomerId` writeback at `accounting.service.ts:75` inline-bypasses the customers DAL — same violation as Phase 5, smaller blast radius.

### Task 6.1: Replace the inline `db.update(customers)`

**Files:**
- Modify: `src/shared/services/accounting.service.ts`

- [ ] **Step 1: Read the surrounding context**

Read `src/shared/services/accounting.service.ts:50-80`. Confirm:
- The function is `ensureCustomer` (or similar) in a service factory.
- `customerId` is in scope.
- `db.update(customers).set({ qbCustomerId }).where(eq(customers.id, customerId))` is the violation.

- [ ] **Step 2: Add imports**

Add at the top of the file (alphabetize within groups):

```ts
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
```

If any of those are already imported, don't duplicate.

- [ ] **Step 3: Replace line 75**

Replace:

```ts
      await db.update(customers).set({ qbCustomerId }).where(eq(customers.id, customerId))
```

With:

```ts
      dalVerifySuccess(
        await customerCrud.update(SYSTEM_CONTEXT, {
          id: customerId,
          data: { qbCustomerId },
        }),
      )
```

- [ ] **Step 4: Drop unused imports if any**

If `customers` (the table) was only imported for this one statement, the import is now dead. Grep the file for other references to `customers.` to confirm. If unused, remove the import. Same for `eq` if it has no other use in the file.

- [ ] **Step 5: tsc + lint**

```bash
pnpm tsc
pnpm lint
```

Expected: clean modulo voipCampaignStatuses.

- [ ] **Step 6: Commit**

```bash
git add src/shared/services/accounting.service.ts
git commit -m "$(cat <<'EOF'
refactor(accounting): route qbCustomerId writeback through customerCrud.update

The inline db.update(customers).set({ qbCustomerId }) bypassed
customerServerSpec.hooks.update. Route through customerCrud.update
with SYSTEM_CONTEXT so the writeback inherits spec hook execution.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 7 — Delete `business.getAll` and `business.ensureGeocoded` (zero callers)

**Why:** both procedures are dead code. The audit confirmed zero UI callers.

### Task 7.1: Remove the dead procedures

**Files:**
- Modify: `src/trpc/routers/customers.router/business.router.ts`

- [ ] **Step 1: Read the current procedure names**

Grep the file for `getAll:`, `ensureGeocoded:`. Confirm their line ranges.

- [ ] **Step 2: Delete `getAll`**

Delete the `getAll` procedure block. Likely lines ~49-53:

```ts
    // Fetch all customers visible to the caller. Scope is set by middleware.
    getAll: entity.authedProcedure
      .query(async ({ ctx }) => {
        return dalToTrpc(await listCustomers(ctx))
      }),
```

- [ ] **Step 3: Delete `ensureGeocoded`**

Delete the `ensureGeocoded` procedure block (the largest block in the file — ~lines 268-333).

- [ ] **Step 4: Drop unused imports**

After deletion, `listCustomers` may be unused. Check by grepping the file for `listCustomers`. If unused, remove the import line. Same check for `geocodeAddress` (used only by `ensureGeocoded`) and any address-related imports that were only feeding the geocode flow.

- [ ] **Step 5: Run pnpm tsc and pnpm lint, follow the errors**

```bash
pnpm tsc
pnpm lint
```

ESLint's `unused-imports` rule will flag any leftover dead imports — remove what it flags.

- [ ] **Step 6: Commit**

```bash
git add src/trpc/routers/customers.router/business.router.ts
git commit -m "$(cat <<'EOF'
chore(customers/router): drop unused business.getAll + business.ensureGeocoded

Both procedures have zero UI callers (verified by grep). getAll was a
post-Phase-2 shim around listCustomers that the dashboard never adopted.
ensureGeocoded was a lazy-geocode procedure that the map components
ended up bypassing in favor of pre-cached coords from the customer row.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 8 — Migrate `business.getById` → `crud.getById`

**Why:** `business.getById` after the previous migration is literally `dalToTrpc(await getCustomer(ctx, { id: input.customerId }))`. The `crud.getById` override (in `customers.router/index.ts`) is `getCustomer(ctx, input)` cast to the standard return type. **They do the exact same thing.** Plus, `crud.getById` now properly phone-gates after the override fix in commit `67604e0c`.

### Task 8.1: Update the caller

**Files:**
- Modify: `src/shared/components/customer-search.tsx` (lines 24-29 area)

- [ ] **Step 1: Read the caller**

Currently uses `business.getById({ customerId })`. Note the input key is `customerId`, not `id`. After migration to `crud.getById`, the input key is `id`.

- [ ] **Step 2: Replace the caller**

Replace:

```ts
  const prefillQuery = useQuery(
    trpc.customersRouter.business.getById.queryOptions(
      { customerId: prefillCustomerId ?? '' },
      { enabled: !!prefillCustomerId && !selectedId },
    ),
  )
```

With:

```ts
  const prefillQuery = useQuery(
    trpc.customersRouter.crud.getById.queryOptions(
      { id: prefillCustomerId ?? '' },
      { enabled: !!prefillCustomerId && !selectedId },
    ),
  )
```

The downstream destructure (`prefillQuery.data.id`, `prefillQuery.data.name`) stays the same — both return shapes include those columns.

### Task 8.2: Delete `business.getById`

**Files:**
- Modify: `src/trpc/routers/customers.router/business.router.ts`

- [ ] **Step 1: Delete the `getById` procedure block**

```ts
    // Phone-gated single-customer read. Scope is enforced by middleware.
    getById: entity.authedProcedure
      .input(z.object({ customerId: z.string().uuid() }))
      .query(async ({ input, ctx }) => {
        return dalToTrpc(await getCustomer(ctx, { id: input.customerId }))
      }),
```

- [ ] **Step 2: Drop unused imports**

If `getCustomer` is no longer referenced in this file, remove its import.

- [ ] **Step 3: tsc + lint**

```bash
pnpm tsc
pnpm lint
```

Expected: clean modulo voipCampaignStatuses.

- [ ] **Step 4: Commit (both files)**

```bash
git add src/shared/components/customer-search.tsx src/trpc/routers/customers.router/business.router.ts
git commit -m "$(cat <<'EOF'
refactor(customers): migrate business.getById caller to crud.getById, delete wrapper

business.getById and crud.getById did the exact same thing after Phase 2
(business.getById was a dalToTrpc shim around getCustomer; crud.getById
is overridden to use getCustomer for phone-gating). Migrate the one
caller (customer-search prefill) to the canonical surface and drop the
wrapper. Input key changes from `customerId` to `id` — matches the
EntityServerSpec id convention.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 9 — Migrate `business.delete` → `crud.delete`

**Why:** `business.delete` is a thin wrapper that re-runs the CASL check (which `crud.delete` already does). The cascade hook (`spec.hooks.delete.before`) fires identically through either path. The only behavioral difference: `business.delete` returns `{ success: true as const }`, `crud.delete` returns `undefined`. The caller currently doesn't use the return value (it just invalidates queries), so the migration is mechanical.

### Task 9.1: Update the caller

**Files:**
- Modify: `src/shared/entities/customers/hooks/use-customer-actions.ts`

- [ ] **Step 1: Read the caller**

It currently calls `trpc.customersRouter.business.delete.mutationOptions(...)` with `customerId` as the input key.

- [ ] **Step 2: Replace the caller**

The exact replacement depends on the file. Mechanically:
- Procedure path: `business.delete` → `crud.delete`
- Input key: `customerId` → `id`
- Invocations from elsewhere in the file (`.mutate({ customerId })`): update to `.mutate({ id })`

- [ ] **Step 3: Verify the invalidation logic doesn't reference the return value**

The current `business.delete` returns `{ success: true as const }`. `crud.delete` returns `undefined`. If `onSuccess` destructures `data.success`, that breaks. Read the onSuccess callback and confirm it doesn't depend on the return.

### Task 9.2: Delete `business.delete`

**Files:**
- Modify: `src/trpc/routers/customers.router/business.router.ts`

- [ ] **Step 1: Delete the `delete` procedure block**

```ts
    // Permanently delete a customer + their meetings, proposals, notes, and
    // projects. CASL-gated to `delete Customer` — only super-admin (`manage all`)
    // currently has this permission. UI must confirm before invoking.
    delete: entity.authedProcedure
      .input(z.object({ customerId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.ability.cannot('delete', 'Customer')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to delete customers.' })
        }
        dalToTrpc(await customerCrud.delete(ctx, { id: input.customerId }))
        return { success: true as const }
      }),
```

- [ ] **Step 2: tsc + lint**

```bash
pnpm tsc
pnpm lint
```

If `customerCrud` is no longer used in this file (Phase 10/11/12/13 still need it), leave the import.

- [ ] **Step 3: Commit**

```bash
git add src/shared/entities/customers/hooks/use-customer-actions.ts src/trpc/routers/customers.router/business.router.ts
git commit -m "$(cat <<'EOF'
refactor(customers): migrate business.delete caller to crud.delete, delete wrapper

The wrapper added a CASL check (redundant — crud.delete already
asserts can('delete', 'Customer')), then delegated to customerCrud.delete
and shaped a { success: true } return. crud.delete fires the same
cascade hook (spec.hooks.delete.before) and returns void on success.

The caller (use-customer-actions) doesn't read the return value, so
the void-vs-success-flag change has no UI effect.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 10 — Migrate `business.updateProfile` → `crud.update`

**Why:** the wrapper does `customerCrud.update(ctx, { id, data: profiles })` and nothing else. With Phase 1's field-level CASL now active, agents can call `crud.update({ data: { customerProfileJSON, ... } })` directly and the gate validates each field is in their allow list.

### Task 10.1: Update the caller

**Files:**
- Modify: `src/shared/entities/customers/hooks/use-customer-edit-form.ts`

- [ ] **Step 1: Read the relevant chunk**

The current code (around lines 30-34):

```ts
  const profileMutation = useMutation(
    trpc.customersRouter.business.updateProfile.mutationOptions({
      onSuccess: () => invalidateCustomer(),
    }),
  )
```

And the call site (around lines 45-53):

```ts
    if (canEditProfiles) {
      promises.push(
        profileMutation.mutateAsync({
          customerId: customer.id,
          customerProfileJSON: values.customerProfileJSON,
          financialProfileJSON: values.financialProfileJSON,
          propertyProfileJSON: values.propertyProfileJSON,
        }),
      )
    }
```

- [ ] **Step 2: Replace the mutation hook**

Change the procedure path and the mutation input shape (`customerId` → `id`; the JSONB fields nest under `data`):

```ts
  const profileMutation = useMutation(
    trpc.customersRouter.crud.update.mutationOptions({
      onSuccess: () => invalidateCustomer(),
    }),
  )
```

And the call site:

```ts
    if (canEditProfiles) {
      promises.push(
        profileMutation.mutateAsync({
          id: customer.id,
          data: {
            customerProfileJSON: values.customerProfileJSON,
            financialProfileJSON: values.financialProfileJSON,
            propertyProfileJSON: values.propertyProfileJSON,
          },
        }),
      )
    }
```

### Task 10.2: Delete `business.updateProfile`

**Files:**
- Modify: `src/trpc/routers/customers.router/business.router.ts`

- [ ] **Step 1: Delete the `updateProfile` procedure**

Delete the entire `updateProfile` block (including the multi-paragraph omni-gate-bypass comment that's now obsolete).

- [ ] **Step 2: Drop unused imports**

The Zod schemas (`customerProfileSchema`, `propertyProfileSchema`, `financialProfileSchema`) imported from `entities/customers/schemas` were probably only used by `updateProfile`. Check by grepping the file. Remove if unused.

- [ ] **Step 3: tsc + lint**

```bash
pnpm tsc
pnpm lint
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/customers/hooks/use-customer-edit-form.ts src/trpc/routers/customers.router/business.router.ts
git commit -m "$(cat <<'EOF'
refactor(customers): migrate business.updateProfile caller to crud.update, delete wrapper

business.updateProfile was a thin wrapper around customerCrud.update
restricted to the three JSONB profile columns via Zod input shape.
After Phase 1 (field-level CASL on crud.update) and Phase 2 (omni-
gate dropped), agents can call crud.update directly with the same
fields — the gate enforces the per-field CASL grant automatically.

The mutation input restructures: { customerId, customerProfileJSON, ... }
→ { id, data: { customerProfileJSON, ... } }. The form caller is the
only invocation.

spec.update.jsonbMergeColumns still does the deep merge — that's a
DAL-layer concern unaffected by the router surface change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 11 — Migrate `business.updateCreatedAt` → `crud.update`

**Why:** wrapper does `cannot('update', 'Customer', 'createdAt') → throw` then `customerCrud.update({createdAt})`. Phase 1's field-level CASL enforces the same check at the framework level.

### Task 11.1: Update the 3 callers

**Files:**
- Modify: `src/shared/entities/customers/components/customers-table.tsx` (lines 45-54 and the call site at 78)
- Modify: `src/features/lead-sources-admin/ui/components/all-customers-section.tsx` (around line 44)
- Modify: `src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx` (around line 48)

- [ ] **Step 1: Read each caller**

Each caller wires `trpc.customersRouter.business.updateCreatedAt.mutationOptions({...})` and the mutate call passes `{ customerId, createdAt }`.

- [ ] **Step 2: Replace the procedure path and input shape (per caller)**

For each of the three files, change the mutation hook:

From:
```ts
  const updateCreatedAt = useMutation(
    trpc.customersRouter.business.updateCreatedAt.mutationOptions({
      onSuccess: () => {
        toast.success('Created date updated')
        invalidateCustomer()
        invalidateLeadSource()
      },
      onError: err => toast.error(err.message),
    }),
  )
```

To:
```ts
  const updateCreatedAt = useMutation(
    trpc.customersRouter.crud.update.mutationOptions({
      onSuccess: () => {
        toast.success('Created date updated')
        invalidateCustomer()
        invalidateLeadSource()
      },
      onError: err => toast.error(err.message),
    }),
  )
```

And the mutate call site:

From:
```ts
updateCreatedAt.mutate({ customerId, createdAt: date.toISOString() })
```

To:
```ts
updateCreatedAt.mutate({ id: customerId, data: { createdAt: date.toISOString() } })
```

(Adapt to each file's exact variable names — `customerId`, `id`, etc.)

### Task 11.2: Delete `business.updateCreatedAt`

**Files:**
- Modify: `src/trpc/routers/customers.router/business.router.ts`

- [ ] **Step 1: Delete the procedure**

Delete the entire `updateCreatedAt` block (~30 lines including comment).

- [ ] **Step 2: tsc + lint**

```bash
pnpm tsc
pnpm lint
```

Expected: clean. ESLint may flag now-unused imports; resolve as needed.

- [ ] **Step 3: Commit**

```bash
git add src/shared/entities/customers/components/customers-table.tsx src/features/lead-sources-admin/ui/components/all-customers-section.tsx src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx src/trpc/routers/customers.router/business.router.ts
git commit -m "$(cat <<'EOF'
refactor(customers): migrate business.updateCreatedAt callers to crud.update, delete wrapper

The wrapper's `cannot('update', 'Customer', 'createdAt')` check is now
enforced uniformly by Phase 1's field-level CASL gate on crud.update.
Three callers (customers-table, lead-sources-admin all-customers + per-
source panes) migrate to the canonical surface. Input shape changes:
{ customerId, createdAt } → { id, data: { createdAt } }.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 12 — Migrate `business.updateLeadSource` → `crud.update`

**Why:** wrapper does FK-existence pre-check + `crud.update`-equivalent + name/slug enrichment for the toast. Phase 1's field-level CASL covers the auth. The FK pre-check is defense-in-depth (Postgres FK would catch it anyway). The enriched return shape's only consumer is the toast message — that simplifies to a static "Lead source updated."

### Task 12.1: Update the caller

**Files:**
- Modify: `src/shared/entities/customers/hooks/use-update-lead-source-mutation.ts`

- [ ] **Step 1: Read the current caller (already inspected)**

It uses `data.leadSourceName` for the toast: `toast.success(data.leadSourceName ? \`Source set to ${data.leadSourceName}\` : 'Lead source updated')`.

- [ ] **Step 2: Replace the hook**

Replace:

```ts
  return useMutation(
    trpc.customersRouter.business.updateLeadSource.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.leadSourceName
          ? `Source set to ${data.leadSourceName}`
          : 'Lead source updated')
        invalidateCustomer()
        invalidateLeadSource()
      },
      onError: err => toast.error(err.message),
    }),
  )
```

With:

```ts
  return useMutation(
    trpc.customersRouter.crud.update.mutationOptions({
      onSuccess: () => {
        toast.success('Lead source updated')
        invalidateCustomer()
        invalidateLeadSource()
      },
      onError: err => toast.error(err.message),
    }),
  )
```

- [ ] **Step 3: Find callers that invoke this hook's mutate**

Grep for `useUpdateLeadSourceMutation`:

```bash
grep -rn "useUpdateLeadSourceMutation" /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/refactor-customer-entity-server-spec/src/
```

For each call site, the existing call pattern is `mutate({ customerId, leadSourceId })`. After migration, it must be `mutate({ id: customerId, data: { leadSourceId } })`. Update each call site found.

### Task 12.2: Delete `business.updateLeadSource`

**Files:**
- Modify: `src/trpc/routers/customers.router/business.router.ts`

- [ ] **Step 1: Delete the procedure**

Delete the entire `updateLeadSource` block (~30 lines).

- [ ] **Step 2: Drop unused imports**

If `leadSourcesTable` import is no longer used in this file (after deleting updateLeadSource and `createFromIntake` was Phase 4 — verify), remove it. Check via grep before removing.

- [ ] **Step 3: tsc + lint**

```bash
pnpm tsc
pnpm lint
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/customers/hooks/use-update-lead-source-mutation.ts src/trpc/routers/customers.router/business.router.ts
git commit -m "$(cat <<'EOF'
refactor(customers): migrate business.updateLeadSource caller to crud.update, delete wrapper

The wrapper did per-field CASL (now covered by Phase 1), an FK existence
pre-check (Postgres FK would catch the same error — defense in depth
not load-bearing for a super-admin-only dropdown), and a join to return
{ leadSourceName, leadSourceSlug } purely for the toast message. The
toast simplifies to a static 'Lead source updated' — the user verifies
the new source in the table after invalidation refreshes the list.

Caller hook migrates to crud.update with input shape
{ customerId, leadSourceId } → { id, data: { leadSourceId } }.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 13 — Migrate `business.updateCustomerContact` → `crud.update`

**Why:** wrapper did per-field CASL loop (Phase 1 covers) + geocode reset (Phase 3's spec hook covers). The DAL surface is now identical.

### Task 13.1: Update the 2 caller files

**Files:**
- Modify: `src/shared/entities/customers/components/profile/address-edit-dialog.tsx`
- Modify: `src/shared/entities/customers/hooks/use-customer-edit-form.ts`

- [ ] **Step 1: Update `address-edit-dialog.tsx`**

Replace:

```ts
  const updateContact = useMutation(
    trpc.customersRouter.business.updateCustomerContact.mutationOptions({
      onSuccess: () => {
        invalidateCustomer()
        toast.success('Address updated')
        handleClose()
      },
      onError: err => toast.error(err.message),
    }),
  )
```

With:

```ts
  const updateContact = useMutation(
    trpc.customersRouter.crud.update.mutationOptions({
      onSuccess: () => {
        invalidateCustomer()
        toast.success('Address updated')
        handleClose()
      },
      onError: err => toast.error(err.message),
    }),
  )
```

And the call site:

From:
```ts
    updateContact.mutate({
      customerId,
      address: picked.address,
      city: picked.city,
      state: picked.state || 'CA',
      zip: picked.zip,
    })
```

To:
```ts
    updateContact.mutate({
      id: customerId,
      data: {
        address: picked.address,
        city: picked.city,
        state: picked.state || 'CA',
        zip: picked.zip,
      },
    })
```

The address-fields-only payload triggers `spec.hooks.update.before` to null the coords — no manual reset needed.

- [ ] **Step 2: Update `use-customer-edit-form.ts`**

Replace:

```ts
  const contactMutation = useMutation(
    trpc.customersRouter.business.updateCustomerContact.mutationOptions({
      onSuccess: () => invalidateCustomer(),
    }),
  )
```

With:

```ts
  const contactMutation = useMutation(
    trpc.customersRouter.crud.update.mutationOptions({
      onSuccess: () => invalidateCustomer(),
    }),
  )
```

And the call site:

From:
```ts
      promises.push(
        contactMutation.mutateAsync({
          customerId: customer.id,
          name: values.name || undefined,
          phone: values.phone || undefined,
          email: values.email || undefined,
          address: values.address || undefined,
          city: values.city || undefined,
          state: values.state || undefined,
          zip: values.zip || undefined,
        }),
      )
```

To:
```ts
      promises.push(
        contactMutation.mutateAsync({
          id: customer.id,
          data: {
            name: values.name || undefined,
            phone: values.phone || undefined,
            email: values.email || undefined,
            address: values.address || undefined,
            city: values.city || undefined,
            state: values.state || undefined,
            zip: values.zip || undefined,
          },
        }),
      )
```

### Task 13.2: Delete `business.updateCustomerContact`

**Files:**
- Modify: `src/trpc/routers/customers.router/business.router.ts`

- [ ] **Step 1: Delete the procedure**

Delete the `updateCustomerContact` block (~40 lines including the per-field CASL loop and geocode reset).

- [ ] **Step 2: Drop unused imports**

Likely candidates to check: any import that was only feeding this procedure (the per-field CASL loop used `ctx.ability.cannot`, the geocode reset wrote to `customers` directly... wait, no, it used `customerCrud.update` after Phase 4). Run tsc + lint and remove anything flagged.

- [ ] **Step 3: tsc + lint**

```bash
pnpm tsc
pnpm lint
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/customers/components/profile/address-edit-dialog.tsx src/shared/entities/customers/hooks/use-customer-edit-form.ts src/trpc/routers/customers.router/business.router.ts
git commit -m "$(cat <<'EOF'
refactor(customers): migrate business.updateCustomerContact callers to crud.update, delete wrapper

Wrapper combined three concerns: per-field CASL loop (now Phase 1's
crud.update gate), inline data assembly (unchanged — callers build
the payload), and geocode-reset on address change (now Phase 3's
spec.hooks.update.before — fires automatically when any address field
is in the data without explicit coords). After those shifts, the
wrapper added zero value over crud.update.

Two callers (address-edit-dialog, use-customer-edit-form) migrate to
crud.update. Input shape changes: { customerId, ...fields } →
{ id, data: { ...fields } }.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 14 — DOCS + punch-list updates

**Why:** the canonical docs (`trpc/DOCS.md`, `customers/DOCS.md`) describe the operational rules of the system. The new field-level CASL behavior and the geocode hook are load-bearing rules that future readers must know about. Also: punch list needs the three resolved DAL violations struck off.

### Task 14.1: Update `src/trpc/DOCS.md`

**Files:**
- Modify: `src/trpc/DOCS.md`

- [ ] **Step 1: Find the section that documents CRUD slot CASL**

Grep for "CRUD" and "CASL" in the file. The section likely says something like "Each slot's CASL check is `ability.can(action, subject)`." Find that line.

- [ ] **Step 2: Add a sub-section about field-level update enforcement**

Append (or insert near the CRUD-CASL section) a paragraph like:

```markdown
### Field-level CASL on update

The `update` slot does NOT use the bare `ability.can('update', subject)`
check — that would let any field-restricted grant satisfy the gate and
write any column. Instead, `createCrudRouter.update` iterates the input
`data` payload and calls `ability.can('update', subject, field)` for each
defined field, throwing `FORBIDDEN` on the first failure.

Implication: per-entity field-restricted grants in `abilities.ts` are
enforced automatically. For example, the agent grant
`can('update', 'Customer', ['customerProfileJSON', 'propertyProfileJSON', 'financialProfileJSON'])`
means agents can call `crud.update({ data: { customerProfileJSON: {...} } })`
but NOT `crud.update({ data: { phone: '...' } })` — the gate rejects
the second call automatically without any per-entity router code.

**Reference impl**: `src/trpc/lib/create-crud-router.ts` — `assertCanUpdateFields` helper.
```

### Task 14.2: Update `src/shared/entities/customers/DOCS.md`

**Files:**
- Modify: `src/shared/entities/customers/DOCS.md`

- [ ] **Step 1: Find the `#geocoding-stored-on-customer` section**

This rule currently says geocoding is written on the customer row. After Phase 3, the rule has a new mechanism: any `customerCrud.update` call containing address fields nullifies the cached coords.

- [ ] **Step 2: Update the rule body**

Find this paragraph:

```markdown
**Reference impl**: address-edit handler in customers router business sub-router (see `src/trpc/routers/customers.router/business.router.ts`)
**Enforced by**: convention (only the address-edit path should write these)
```

Replace with:

```markdown
**Reference impl**: `customerServerSpec.hooks.update.before` at `src/shared/entities/customers/lib/server-spec.ts` — nullifies cached coords whenever the update payload contains any of `address`/`city`/`state`/`zip` AND no explicit `latitude`/`longitude` (the geocode write-back path).
**Enforced by**: spec hook — fires for every `customerCrud.update` caller (routers, services, jobs). Previously enforced by convention in `business.updateCustomerContact`, which is now deleted; the hook is now the only enforcement point.
```

### Task 14.3: Update the migration punch list

**Files:**
- Modify: `docs/plans/entity-server-migration-punch-list.md`

- [ ] **Step 1: Read the current punch list**

Find the rows for:
- Section C (Internal services importing `db`): `accounting.service.ts`
- Section D (Background jobs importing `db`): (none — accounting is C, not D)
- Section E (`isOmni` dance inlined): `get-customer-pipeline-items.ts` and `move-customer-pipeline-item.ts`

- [ ] **Step 2: Update each row**

For `accounting.service.ts` (in Section C), change the row to indicate the customer-write fix landed:

> | ~~`src/shared/services/accounting.service.ts`~~ | ✅ Partial — customer qbCustomerId write now routes through customerCrud.update (this branch). Proposal-side reads still inline. |

For `move-customer-pipeline-item.ts` (in Section E), change the row:

> | ~~`src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts`~~ | 20 | ✅ Partial — leads-pipeline customer write now routes through customerCrud.update (this branch). Meetings/projects/proposals writes still inline (migrate with those entities). |

For `createFromIntake` (newly discovered, NOT previously on the list), add a new row to Section A or C explaining it's now fixed:

> Add a footnote under the Section A table: "Note: `createFromIntake` in `customers.router/business.router.ts` previously inserted customers via inline `tx.insert(customers)`. Routed through `customerCrud.create(SYSTEM_CONTEXT, ...)` on this branch — no longer a DAL violation."

- [ ] **Step 3: Update the "Status snapshot" section**

Add a line: "Customer business mutations collapsed into crud.* on branch `refactor/customer-entity-server-spec` (TBD-PR): 7 redundant wrappers deleted, framework-level field-level CASL added, geocode-reset moved to spec.hooks.update.before."

### Task 14.4: Final verification

- [ ] **Step 1: tsc + lint**

```bash
pnpm tsc
pnpm lint
```

Expected: same single pre-existing `voipCampaignStatuses` error from main. No new errors. Lint exit 0.

- [ ] **Step 2: Sanity-check the business.router.ts file size**

```bash
wc -l /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/refactor-customer-entity-server-spec/src/trpc/routers/customers.router/business.router.ts
```

Before this plan: ~560 lines. After: should be roughly half (only `list`, `search`, `addNote`, `createFromIntake` remain).

- [ ] **Step 3: Verify the final procedure inventory**

Grep the file for top-level mutation/query declarations:

```bash
grep -E "^    (list|search|addNote|createFromIntake):" /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/refactor-customer-entity-server-spec/src/trpc/routers/customers.router/business.router.ts
```

Expected: exactly four matches — `list`, `search`, `addNote`, `createFromIntake`. If anything else appears, something didn't get deleted.

- [ ] **Step 4: Commit**

```bash
git add src/trpc/DOCS.md src/shared/entities/customers/DOCS.md docs/plans/entity-server-migration-punch-list.md
git commit -m "$(cat <<'EOF'
docs: update CRUD field-CASL + customer geocode-hook + punch list

- trpc/DOCS.md: document the field-level CASL enforcement on the update
  slot (Phase 1 of the cleanup).
- entities/customers/DOCS.md#geocoding-stored-on-customer: enforcement
  point moved from business.updateCustomerContact (deleted) to
  customerServerSpec.hooks.update.before.
- entity-server-migration-punch-list.md: mark accounting.service +
  move-customer-pipeline-item leads-stage write as resolved; note that
  createFromIntake's inline insert (previously not on the list) was
  routed through customerCrud.create.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review

**1. Spec coverage:** Mapping each decision back to a task:
- Decision 1 (field-level CASL) → Phase 1 + Phase 2 ✓
- Decision 2 (geocode hook with guard) → Phase 3 ✓
- Decision 3 (createFromIntake fix) → Phase 4 ✓
- 7 wrapper deletions → Phases 7-13 (getAll + ensureGeocoded in Phase 7, then 8/9/10/11/12/13) ✓
- 2 non-router DAL violations (move-customer-pipeline-item, accounting.service) → Phases 5 + 6 ✓
- DOCS + punch list → Phase 14 ✓

**2. Placeholder scan:** No "TODO", "implement later", or unstated requirements. Every step has either exact code blocks or exact command sequences.

**3. Type consistency:** `customerCrud.update` signature is `(ctx: ScopedContext, input: { id, data }) => Promise<DalReturn<Row<typeof customers>>>` — referenced consistently. The migrated callers all destructure `{ id, data }` for `crud.update` (the framework convention). The CASL helper added in Phase 1 (`assertCanUpdateFields`) is referenced by name in the Phase 14 DOCS update. No drift.

**4. Behavior preservation check:**
- Phase 1: zero behavior change for proposals (unrestricted grant satisfies every field check).
- Phase 2: removes a stopgap that was blocking legitimate updates; the new field-CASL gate handles the security concern.
- Phase 3: a NEW behavior (geocode reset on address changes) but it matches the OLD behavior in `business.updateCustomerContact` — net zero from the user's perspective.
- Phase 4: trades atomicity (customer+note tx) for spec consistency. Notes are optional; the trade is acceptable per the locked-in decision.
- Phases 5+6: no behavior change for end users, just code refactor.
- Phases 7-13: 7 wrappers deleted. UI callers' input shape changes (`customerId` → `id`, fields move under `data`). Toast messages are preserved except updateLeadSource (simplified to static text — locked in via decision).
- Phase 14: docs only.

**5. Phase ordering integrity:** Phase 2 requires Phase 1. Phase 13 requires Phase 3 (geocode hook must exist before deleting the inline reset). Phase 10 requires Phase 1+2 (agent JSONB update needs field-CASL active and omni-gate gone). Other phases are independent.
