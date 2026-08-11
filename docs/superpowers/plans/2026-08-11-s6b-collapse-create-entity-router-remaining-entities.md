# S6b — Collapse `createEntityRouter` (customers / meetings / applications) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the customers, meetings, and applications tRPC routers off the `createEntityRouter` factory — each gets a `procedures.ts` (scoped procedures defined once), standalone leaf files, a standalone `crud.router.ts`, and a pure-composition `index.ts` — so nothing imports `createEntityRouter` / `EntityToolkit` any more.

**Architecture:** Replicate the fully-migrated **proposals** router shape (reference impl). Per-entity pre-scoped procedures are built once with the cast-free inline `.use()` pattern in `procedures.ts`; every sub-router becomes a plain leaf importing those procedures; `crud` moves to `crud.router.ts` (which after S6a builds its own procedures inline from the spec); `index.ts` becomes a flat `createTRPCRouter({…})`. No behavior changes, no tRPC path changes.

**Tech Stack:** Next.js 15, tRPC v11 (`@trpc/server` ^11.4.1), Drizzle/Neon, Zod, CASL, pnpm. Lint = @antfu/eslint-config (`perfectionist/sort-imports`, autofix `npx eslint --fix`).

## Global Constraints

- **NO commits, NO staging games.** The entire tRPC standardization epic (S1–S6a) sits **uncommitted** in the working tree on `main`. Each task ends with `pnpm tsc` + `pnpm lint` green and the changes **left uncommitted**. Do NOT `git add`, `git commit`, or `git push`. (SDD review packages for this epic are built from snapshot diffs, not commit ranges.)
- **Verification is `pnpm tsc` + `pnpm lint` only.** NEVER run `pnpm build`. This repo has no router unit-test suite.
- **tRPC paths must not change.** Preserve every router key and its order exactly: customers → `crud, profile, business`; meetings → `crud, reads, participants, business`; applications → `crud, business, draft`. A changed key is a client-breaking bug.
- **Naming convention (from proposals, verbatim):** per-entity procedures are `<entity>Procedure` (e.g. `customerProcedure`); intra-entity leaf files export the **unprefixed** `crudRouter` / `businessRouter` / `readsRouter` / `participantsRouter` / `profileRouter` / `draftRouter`.
- **Type fidelity, not just tsc-green:** the built CRUD routers' input/output types and resolver `ctx` must stay concrete (never collapse to `any`). A wrong-shape call to a procedure must remain a tsc error.
- **The inline scope pattern is cast-free — copy it exactly** (never `.use(scopeMiddleware(spec))`, which widens `ctx.session` back to nullable and forces an `as typeof agentProcedure` cast):
  ```ts
  export const <entity>Procedure = agentProcedure.use(async ({ ctx, next }) => {
    const scope = resolveVisibilityScope(<entity>ServerSpec, { userId: ctx.session.user.id, ability: ctx.ability })
    return next({ ctx: { ...ctx, scope } })
  })
  ```
- **None of the three specs declares `shareable`; only customers has a public entrypoint.** So: customers `procedures.ts` = authed + public; meetings = authed only; applications = authed only. No shareable procedure anywhere in S6b.
- **Imports come from `../../init`:** `agentProcedure`, `baseProcedure`, `createTRPCRouter`. Scope helpers: `resolveVisibilityScope` from `../../lib/middleware/scope-middleware`, `shareableMiddleware` from `../../lib/middleware/shareable-middleware` (not needed in S6b — no shareable specs).

---

### Task 1: customers.router — off the factory

**Files:**
- Create: `src/trpc/routers/customers.router/procedures.ts`
- Create: `src/trpc/routers/customers.router/crud.router.ts`
- Create: `src/trpc/routers/customers.router/profile.router.ts`
- Modify: `src/trpc/routers/customers.router/business.router.ts` (factory → plain leaf)
- Modify: `src/trpc/routers/customers.router/index.ts` (pure composition)

**Interfaces:**
- Consumes: `agentProcedure`, `baseProcedure`, `createTRPCRouter` from `../../init`; `resolveVisibilityScope` from `../../lib/middleware/scope-middleware`; `createCrudRouter` from `../../lib/create-crud-router`; `customerServerSpec`, `customerSchemas` from `@/shared/entities/customers/lib/server-spec`.
- Produces: `customerProcedure`, `customerPublicProcedure` (from `./procedures`); `crudRouter` (from `./crud.router`); `profileRouter` (from `./profile.router`); `businessRouter` (from `./business.router`). `customersRouter` composition + all tRPC paths unchanged (`customers.crud.*`, `customers.profile.upsert`, `customers.business.*`).

- [ ] **Step 1: Create `procedures.ts`**

Create `src/trpc/routers/customers.router/procedures.ts` with exactly:

```ts
// Per-entity pre-scoped procedures for the customers router — defined ONCE
// here as top-level consts (tRPC-idiomatic `const + typeof`), imported directly
// by every customer sub-router. This replaces the old `createEntityRouter`
// factory + `EntityToolkit` argument: the middleware is baked on at definition
// time, not generated per call. see ../../DOCS.md#entity-router-via-factory
// (being rewritten — epic S7)
//
// server-spec.ts stays a PURE data object (imported by the DAL); the tRPC
// runtime is pulled in HERE, router-side, never into the entity/DAL layer.
//
// Why the agent scope step is inlined (not `.use(scopeMiddleware(spec))`):
// the standalone `scopeMiddleware` is typed against the ROOT context, where
// `session` is nullable — chaining it would widen `ctx.session` back to null
// and force an `as typeof agentProcedure` cast (the old factory's crutch).
// An inline `.use()` infers `ctx` from `agentProcedure`, so the non-null
// session/ability narrowing flows through and no cast is needed. The scope
// math stays DRY via the shared `resolveVisibilityScope`.

import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'

import { agentProcedure, baseProcedure } from '../../init'
import { resolveVisibilityScope } from '../../lib/middleware/scope-middleware'

/** Agent-only. Session + ability guaranteed; `ctx.scope` resolved from customer visibility (null for omni). */
export const customerProcedure = agentProcedure.use(async ({ ctx, next }) => {
  const scope = resolveVisibilityScope(customerServerSpec, { userId: ctx.session.user.id, ability: ctx.ability })
  return next({ ctx: { ...ctx, scope } })
})

/** No auth. Pass-through of baseProcedure — the public intake entrypoint enforces its own rate-limit + validation inline. */
export const customerPublicProcedure = baseProcedure
```

- [ ] **Step 2: Create `crud.router.ts`** (move the crud config out of `index.ts`, verbatim including the `getById` override + comments)

Create `src/trpc/routers/customers.router/crud.router.ts` with exactly:

```ts
// ─── Customers CRUD Router ───────────────────────────────────────────────────
// The 5 single-row operations. Plain leaf: createCrudRouter builds its scoped
// procedures inline from the spec (no createEntityRouter, no cast — epic S6a).
//
// spec.hooks.delete.before cascades meeting and proposal deletes before the
// customer row is removed; spec.hooks.update.before resets the geocode cache
// when address fields change. (leadMeta jsonbMergeColumns registration was
// removed in Wave-2 — the blob is frozen; attribution + enrichment are their
// own child tables now.)
//
// crud.getById is overridden to return the phone-gated row shape — the default
// handler from createCrudDal does a plain SELECT * which would include the
// ungated phone column, violating phone-visibility-threshold.
// see ../../../shared/entities/customers/DOCS.md#phone-visibility-threshold
//
// crud.update uses the framework's field-level CASL enforcement (in
// create-crud-router.ts). The agent CASL grant on 'Customer' is field-
// restricted to just `age` now (Addendum B, 2026-07-14) — the 23
// sales-discovery columns moved to the `customer_profiles` child table and go
// through `profile.upsert`, gated on the CustomerProfile subject instead.

import type { customerCrud } from '@/shared/entities/customers/dal/server/crud'

import z from 'zod'

import { getCustomer } from '@/shared/entities/customers/dal/server/queries'
import { customerSchemas, customerServerSpec } from '@/shared/entities/customers/lib/server-spec'

import { createCrudRouter } from '../../lib/create-crud-router'

export const crudRouter = createCrudRouter({
  spec: customerServerSpec,
  schemas: { ...customerSchemas, id: z.string().uuid() },
  handlers: {
    // Cast: getCustomer returns CustomerWithProfile (a structural superset of
    // Row<typeof customers> — phone-gated + flattened-spread joined against
    // customer_profiles). The CrudHandlers contract types getById as
    // Row<TTable> | undefined — the extra fields are harmless (callers that
    // don't read them see the standard row shape). The framework-level type for
    // handlers.getById doesn't admit phantom enrichments, so the cast is necessary.
    getById: async (ctx, input) => getCustomer(ctx, input) as ReturnType<typeof customerCrud.getById>,
  },
})
```

- [ ] **Step 3: Create `profile.router.ts`** (extract the inline `profile` sub-router; swap `entity.authedProcedure` → `customerProcedure`)

Create `src/trpc/routers/customers.router/profile.router.ts` with exactly:

```ts
// ─── Customer Profile Router ─────────────────────────────────────────────────
// customer_profiles 1:1 child table (Addendum B). Own CASL subject
// ('CustomerProfile') — a different permission boundary than Customer's
// contact/identity fields. Lazy upsert: row-exists = discovery data collected.

import { TRPCError } from '@trpc/server'
import z from 'zod'

import { customerProfilePatchSchema } from '@/shared/db/schema'
import { upsertCustomerProfile } from '@/shared/entities/customers/dal/server/mutations'

import { createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'
import { customerProcedure } from './procedures'

export const profileRouter = createTRPCRouter({
  upsert: customerProcedure
    .input(z.object({ id: z.string().uuid(), data: customerProfilePatchSchema }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.ability.cannot('update', 'CustomerProfile')) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to update the customer profile.',
        })
      }
      return dalToTrpc(await upsertCustomerProfile(ctx, { customerId: input.id, patch: input.data }))
    }),
})
```

- [ ] **Step 4: Convert `business.router.ts` from factory to plain leaf**

In `src/trpc/routers/customers.router/business.router.ts`, make exactly these edits — leave every query/mutation body byte-for-byte unchanged:

1. Delete the two type imports at the top:
   ```ts
   import type { PgTable } from 'drizzle-orm/pg-core'
   import type { EntityToolkit } from '../../lib/create-entity-router'
   ```
2. Add an import of the shared procedures. Place it after the existing `import { clientIp } from '../../lib/client-ip'` line:
   ```ts
   import { customerProcedure, customerPublicProcedure } from './procedures'
   ```
3. Replace the function-wrapper opening line:
   ```ts
   export function createCustomerBusinessRouter(entity: EntityToolkit<PgTable>) {
     return createTRPCRouter({
   ```
   with:
   ```ts
   export const businessRouter = createTRPCRouter({
   ```
4. Replace the wrapper's closing `  })\n}` (the `})` that closes `createTRPCRouter` **and** the `}` that closes the function) with a single `})`.
5. De-indent the router body by 2 spaces (it dropped one nesting level). `npx eslint --fix` will do this for you in Step 6 — but the two brace edits above must be correct first.
6. Swap the procedure references (3 sites): `list` and `search` use `entity.authedProcedure` → `customerProcedure`; `createFromIntake` uses `entity.publicProcedure` → `customerPublicProcedure`.

- [ ] **Step 5: Reduce `index.ts` to pure composition**

Replace the **entire** contents of `src/trpc/routers/customers.router/index.ts` with exactly:

```ts
// Customers router — pure composition. Every leaf is its own file. No
// createEntityRouter: crud builds its procedures inline from the spec (S6a).
// see ../../DOCS.md#entity-router-via-factory (rewritten in S7)

import { createTRPCRouter } from '../../init'
import { businessRouter } from './business.router'
import { crudRouter } from './crud.router'
import { profileRouter } from './profile.router'

export const customersRouter = createTRPCRouter({
  crud: crudRouter,
  profile: profileRouter,
  business: businessRouter,
})
```

- [ ] **Step 6: Fix import order, then verify**

Run: `npx eslint --fix src/trpc/routers/customers.router/`
Then run: `pnpm lint`
Expected: clean (no errors in `customers.router/`).

- [ ] **Step 7: Type-check**

Run: `pnpm tsc`
Expected: no NEW errors versus the pre-task baseline. In particular no errors in any `customers.router/` file, and no error at the `customersRouter` export or its consumers in `src/trpc/routers/_app.ts` (or wherever the app router composes it). If tsc reports a **pre-existing** error unrelated to customers (from another uncommitted epic slice), note it and move on — do not fix it here.

- [ ] **Step 8: Prove the factory is gone from customers + paths intact**

Run: `grep -rn "createEntityRouter\|EntityToolkit" src/trpc/routers/customers.router/`
Expected: **no matches** (customers is fully off the factory).

Run: `grep -rn "entity\.\(authed\|public\|shareable\)Procedure" src/trpc/routers/customers.router/`
Expected: **no matches**.

**Leave uncommitted** (Global Constraint — no `git add`/`commit`).

---

### Task 2: meetings.router — off the factory

**Files:**
- Create: `src/trpc/routers/meetings.router/procedures.ts`
- Create: `src/trpc/routers/meetings.router/crud.router.ts`
- Modify: `src/trpc/routers/meetings.router/reads.router.ts` (factory → plain leaf)
- Modify: `src/trpc/routers/meetings.router/participants.router.ts` (factory → plain leaf)
- Modify: `src/trpc/routers/meetings.router/business.router.ts` (factory → plain leaf)
- Modify: `src/trpc/routers/meetings.router/index.ts` (pure composition)

**Interfaces:**
- Consumes: `agentProcedure`, `createTRPCRouter` from `../../init`; `resolveVisibilityScope` from `../../lib/middleware/scope-middleware`; `createCrudRouter` from `../../lib/create-crud-router`; `meetingServerSpec`, `meetingSchemas` from `@/shared/entities/meetings/lib/server-spec`.
- Produces: `meetingProcedure` (from `./procedures`); `crudRouter` (from `./crud.router`); `readsRouter` (from `./reads.router`); `participantsRouter` (from `./participants.router`); `businessRouter` (from `./business.router`). `meetingsRouter` composition + all tRPC paths unchanged (`meetings.crud.*`, `meetings.reads.*`, `meetings.participants.*`, `meetings.business.*`).

- [ ] **Step 1: Create `procedures.ts`**

Create `src/trpc/routers/meetings.router/procedures.ts` with exactly:

```ts
// Per-entity pre-scoped procedures for the meetings router — defined ONCE here
// as top-level consts, imported directly by every meeting sub-router. Replaces
// the old `createEntityRouter` factory + `EntityToolkit` argument: middleware is
// baked on at definition time, not generated per call.
// see ../../DOCS.md#entity-router-via-factory (being rewritten — epic S7)
//
// server-spec.ts stays a PURE data object (imported by the DAL); the tRPC
// runtime is pulled in HERE, router-side, never into the entity/DAL layer.
//
// The agent scope step is inlined (not `.use(scopeMiddleware(spec))`) so
// `ctx` is inferred from `agentProcedure` — the non-null session/ability
// narrowing flows through and no `as typeof agentProcedure` cast is needed.

import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'

import { agentProcedure } from '../../init'
import { resolveVisibilityScope } from '../../lib/middleware/scope-middleware'

/** Agent-only. Session + ability guaranteed; `ctx.scope` resolved from meeting visibility (null for omni). */
export const meetingProcedure = agentProcedure.use(async ({ ctx, next }) => {
  const scope = resolveVisibilityScope(meetingServerSpec, { userId: ctx.session.user.id, ability: ctx.ability })
  return next({ ctx: { ...ctx, scope } })
})
```

- [ ] **Step 2: Create `crud.router.ts`**

Create `src/trpc/routers/meetings.router/crud.router.ts` with exactly:

```ts
// ─── Meetings CRUD Router ────────────────────────────────────────────────────
// The 5 single-row operations. Plain leaf: createCrudRouter builds its scoped
// procedures inline from the spec (no createEntityRouter, no cast — epic S6a).
// spec.hooks fire pipeline derivation + GCal/Ably sync on write.

import z from 'zod'

import { meetingSchemas, meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'

import { createCrudRouter } from '../../lib/create-crud-router'

export const crudRouter = createCrudRouter({
  spec: meetingServerSpec,
  schemas: { ...meetingSchemas, id: z.string().uuid() },
})
```

- [ ] **Step 3: Convert `reads.router.ts` from factory to plain leaf**

In `src/trpc/routers/meetings.router/reads.router.ts`, make exactly these edits — leave every query body byte-for-byte unchanged:

1. Delete the two type imports:
   ```ts
   import type { PgTable } from 'drizzle-orm/pg-core'

   import type { EntityToolkit } from '@/trpc/lib/create-entity-router'
   ```
2. Add, after the existing `import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'` line:
   ```ts
   import { meetingProcedure } from './procedures'
   ```
3. Replace:
   ```ts
   export function createMeetingReadsRouter(entity: EntityToolkit<PgTable>) {
     return createTRPCRouter({
   ```
   with:
   ```ts
   export const readsRouter = createTRPCRouter({
   ```
4. Replace the wrapper's closing `  })\n}` with a single `})`.
5. Swap all `entity.authedProcedure` → `meetingProcedure` (3 sites: `list`, `getByIdWithJoins`, `getInternalUsers`).

- [ ] **Step 4: Convert `participants.router.ts` from factory to plain leaf**

In `src/trpc/routers/meetings.router/participants.router.ts`, make exactly these edits — leave every mutation/query body byte-for-byte unchanged:

1. Delete the two type imports:
   ```ts
   import type { PgTable } from 'drizzle-orm/pg-core'

   import type { EntityToolkit } from '@/trpc/lib/create-entity-router'
   ```
2. Add, after the existing `import { createTRPCRouter } from '@/trpc/init'` line:
   ```ts
   import { meetingProcedure } from './procedures'
   ```
3. Replace:
   ```ts
   export function createParticipantsRouter(entity: EntityToolkit<PgTable>) {
     return createTRPCRouter({
   ```
   with:
   ```ts
   export const participantsRouter = createTRPCRouter({
   ```
4. Replace the wrapper's closing `  })\n}` with a single `})`.
5. Swap all `entity.authedProcedure` → `meetingProcedure` (2 sites: `getParticipants`, `manageParticipants`).

- [ ] **Step 5: Convert `business.router.ts` from factory to plain leaf**

In `src/trpc/routers/meetings.router/business.router.ts`, make exactly these edits — leave the mutation body byte-for-byte unchanged:

1. Delete the two type imports:
   ```ts
   import type { PgTable } from 'drizzle-orm/pg-core'
   import type { EntityToolkit } from '../../lib/create-entity-router'
   ```
2. Add, after the existing `import { createTRPCRouter } from '../../init'` line:
   ```ts
   import { meetingProcedure } from './procedures'
   ```
3. Replace:
   ```ts
   export function createMeetingBusinessRouter(entity: EntityToolkit<PgTable>) {
     return createTRPCRouter({
   ```
   with:
   ```ts
   export const businessRouter = createTRPCRouter({
   ```
4. Replace the wrapper's closing `  })\n}` with a single `})`.
5. Swap `entity.authedProcedure` → `meetingProcedure` (1 site: `setOutcomeWithReason`).

- [ ] **Step 6: Reduce `index.ts` to pure composition**

Replace the **entire** contents of `src/trpc/routers/meetings.router/index.ts` with exactly:

```ts
// Meetings router — pure composition. Every leaf is its own file. No
// createEntityRouter: crud builds its procedures inline from the spec (S6a).
// see ../../DOCS.md#entity-router-via-factory (rewritten in S7)

import { createTRPCRouter } from '../../init'
import { businessRouter } from './business.router'
import { crudRouter } from './crud.router'
import { participantsRouter } from './participants.router'
import { readsRouter } from './reads.router'

export const meetingsRouter = createTRPCRouter({
  crud: crudRouter,
  reads: readsRouter,
  participants: participantsRouter,
  business: businessRouter,
})
```

- [ ] **Step 7: Fix import order, then verify**

Run: `npx eslint --fix src/trpc/routers/meetings.router/`
Then run: `pnpm lint`
Expected: clean (no errors in `meetings.router/`). Note: `reads.router.ts` and `participants.router.ts` de-indented by one level when the function wrapper was removed — eslint `--fix` handles the reindent.

- [ ] **Step 8: Type-check**

Run: `pnpm tsc`
Expected: no NEW errors versus baseline; no errors in any `meetings.router/` file or at the `meetingsRouter` export/consumers. Pre-existing unrelated errors from other uncommitted slices → note and move on.

- [ ] **Step 9: Prove the factory is gone from meetings**

Run: `grep -rn "createEntityRouter\|EntityToolkit" src/trpc/routers/meetings.router/`
Expected: **no matches**.

Run: `grep -rn "entity\.\(authed\|public\|shareable\)Procedure" src/trpc/routers/meetings.router/`
Expected: **no matches**.

**Leave uncommitted.**

---

### Task 3: applications.router — off the factory

**Files:**
- Create: `src/trpc/routers/applications.router/procedures.ts`
- Create: `src/trpc/routers/applications.router/crud.router.ts`
- Create: `src/trpc/routers/applications.router/business.router.ts` (extract inline `business`)
- Create: `src/trpc/routers/applications.router/draft.router.ts` (extract inline `draft`)
- Modify: `src/trpc/routers/applications.router/index.ts` (pure composition)

**Interfaces:**
- Consumes: `agentProcedure`, `createTRPCRouter` from `../../init`; `resolveVisibilityScope` from `../../lib/middleware/scope-middleware`; `createCrudRouter` from `../../lib/create-crud-router`; `applicationServerSpec`, `applicationSchemas` from `@/shared/entities/applications/lib/server-spec`; DAL fns `saveDraft`, `submitApplication`, `withdraw` from `@/shared/entities/applications/dal/server/mutations`; `applicationListInputSchema`, `getApplicationWithAnswers`, `listApplications` from `@/shared/entities/applications/dal/server/queries`; `applicationDraftSchema` from `@/shared/entities/applications/schemas`; `dalToTrpc` from `../../lib/dal-to-trpc`.
- Produces: `applicationProcedure` (from `./procedures`); `crudRouter`, `businessRouter`, `draftRouter`. `applicationsRouter` composition + all tRPC paths unchanged (`applications.crud.*`, `applications.business.*`, `applications.draft.*`).

- [ ] **Step 1: Create `procedures.ts`**

Create `src/trpc/routers/applications.router/procedures.ts` with exactly:

```ts
// Per-entity pre-scoped procedures for the applications router — defined ONCE
// here as top-level consts, imported directly by every application sub-router.
// Replaces the old `createEntityRouter` factory + `EntityToolkit` argument:
// middleware is baked on at definition time, not generated per call.
// see ../../DOCS.md#entity-router-via-factory (being rewritten — epic S7)
//
// server-spec.ts stays a PURE data object (imported by the DAL); the tRPC
// runtime is pulled in HERE, router-side, never into the entity/DAL layer.
//
// The agent scope step is inlined (not `.use(scopeMiddleware(spec))`) so
// `ctx` is inferred from `agentProcedure` — the non-null session/ability
// narrowing flows through and no `as typeof agentProcedure` cast is needed.

import { applicationServerSpec } from '@/shared/entities/applications/lib/server-spec'

import { agentProcedure } from '../../init'
import { resolveVisibilityScope } from '../../lib/middleware/scope-middleware'

/** Agent-only. Session + ability guaranteed; `ctx.scope` resolved from application visibility (null for omni). */
export const applicationProcedure = agentProcedure.use(async ({ ctx, next }) => {
  const scope = resolveVisibilityScope(applicationServerSpec, { userId: ctx.session.user.id, ability: ctx.ability })
  return next({ ctx: { ...ctx, scope } })
})
```

- [ ] **Step 2: Create `crud.router.ts`**

Create `src/trpc/routers/applications.router/crud.router.ts` with exactly:

```ts
// ─── Applications CRUD Router ────────────────────────────────────────────────
// The 5 single-row operations (create = agent starts a draft; status defaults
// to 'draft'). Plain leaf: createCrudRouter builds its scoped procedures inline
// from the spec (no createEntityRouter, no cast — epic S6a).

import z from 'zod'

import { applicationSchemas, applicationServerSpec } from '@/shared/entities/applications/lib/server-spec'

import { createCrudRouter } from '../../lib/create-crud-router'

export const crudRouter = createCrudRouter({
  spec: applicationServerSpec,
  schemas: { ...applicationSchemas, id: z.string().uuid() },
})
```

- [ ] **Step 3: Create `business.router.ts`** (extract the inline `business` sub-router; swap `entity.authedProcedure` → `applicationProcedure`)

Create `src/trpc/routers/applications.router/business.router.ts` with exactly:

```ts
// ─── Applications Business Reads ─────────────────────────────────────────────
// Paginated list + single application-with-answers. Plain leaf importing the
// pre-scoped applicationProcedure from ./procedures.

import {
  applicationListInputSchema,
  getApplicationWithAnswers,
  listApplications,
} from '@/shared/entities/applications/dal/server/queries'
import z from 'zod'

import { createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'
import { applicationProcedure } from './procedures'

export const businessRouter = createTRPCRouter({
  list: applicationProcedure
    .input(applicationListInputSchema)
    .query(async ({ ctx, input }) => {
      return dalToTrpc(await listApplications(ctx, input))
    }),

  getWithAnswers: applicationProcedure
    .input(z.object({ applicationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return dalToTrpc(await getApplicationWithAnswers(ctx, input))
    }),
})
```

> Note: keep the exact import order/style your linter enforces (`npx eslint --fix` in Step 6 will resolve `perfectionist/sort-imports`). The `z` import and the DAL barrel import above may reorder — that is expected.

- [ ] **Step 4: Create `draft.router.ts`** (extract the inline `draft` sub-router; swap `entity.authedProcedure` → `applicationProcedure`)

Create `src/trpc/routers/applications.router/draft.router.ts` with exactly:

```ts
// ─── Applications Draft Lifecycle ────────────────────────────────────────────
// Autosave + submit + withdraw (agent + homeowner via the engine). Plain leaf
// importing the pre-scoped applicationProcedure from ./procedures. `save` is
// the target of sub-project #2's DB StepPersistenceAdapter.

import z from 'zod'

import { saveDraft, submitApplication, withdraw } from '@/shared/entities/applications/dal/server/mutations'
import { applicationDraftSchema } from '@/shared/entities/applications/schemas'

import { createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'
import { applicationProcedure } from './procedures'

export const draftRouter = createTRPCRouter({
  save: applicationProcedure
    .input(z.object({
      applicationId: z.string().uuid(),
      state: applicationDraftSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      return dalToTrpc(await saveDraft(ctx, input))
    }),

  submit: applicationProcedure
    .input(z.object({ applicationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return dalToTrpc(await submitApplication(ctx, input))
    }),

  withdraw: applicationProcedure
    .input(z.object({ applicationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return dalToTrpc(await withdraw(ctx, input))
    }),
})
```

- [ ] **Step 5: Reduce `index.ts` to pure composition**

Replace the **entire** contents of `src/trpc/routers/applications.router/index.ts` with exactly:

```ts
// Applications router — pure composition. Every leaf is its own file. No
// createEntityRouter: crud builds its procedures inline from the spec (S6a).
// see ../../DOCS.md#entity-router-via-factory (rewritten in S7)

import { createTRPCRouter } from '../../init'
import { businessRouter } from './business.router'
import { crudRouter } from './crud.router'
import { draftRouter } from './draft.router'

export const applicationsRouter = createTRPCRouter({
  crud: crudRouter,
  business: businessRouter,
  draft: draftRouter,
})
```

- [ ] **Step 6: Fix import order, then verify**

Run: `npx eslint --fix src/trpc/routers/applications.router/`
Then run: `pnpm lint`
Expected: clean (no errors in `applications.router/`).

- [ ] **Step 7: Type-check**

Run: `pnpm tsc`
Expected: no NEW errors versus baseline; no errors in any `applications.router/` file or at the `applicationsRouter` export/consumers. Pre-existing unrelated errors from other uncommitted slices → note and move on.

- [ ] **Step 8: Prove the factory is gone from applications AND epic-wide**

Run: `grep -rn "createEntityRouter\|EntityToolkit" src/trpc/routers/applications.router/`
Expected: **no matches**.

Run (epic exit gate — all routers): `grep -rln "createEntityRouter\|EntityToolkit" src/trpc/routers/`
Expected: **no matches anywhere** (proposals + customer-notes done in S6a; customers + meetings done in Tasks 1–2; applications done here).

Run (confirm only the factory defs + registry remain, now unreferenced): `grep -rln "createEntityRouter\|EntityToolkit\|entity-registry\|entityRegistry" src/trpc/`
Expected: only `src/trpc/lib/create-entity-router.ts` and `src/trpc/lib/entity-registry.ts` themselves (and any barrel that re-exports them) — these get deleted in **S7**, NOT here.

**Leave uncommitted.**

---

## Notes for the executor

- After all three tasks: the working tree has customers/meetings/applications fully off the factory, joining proposals + customer-notes (S6a). `createEntityRouter` + `entity-registry` are now dead code with zero import sites — their deletion + the ADR-0002/`src/trpc/DOCS.md` rewrite is **S7**, a separate slice. Do not delete them here.
- Do not touch the epic's "Pending fixes" item (`createCrudRouter` `id` infers `unknown` not `TId`) — out of scope for S6b.
- If `pnpm tsc` surfaces a pre-existing error in a NON-router file (e.g. from another in-flight uncommitted slice), it is not yours — record it in the SDD ledger and continue; do not fix it.
