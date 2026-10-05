# How to Add an Entity

Step-by-step procedure for adding a new business entity to the tRPC layer under the Entity Server System (ADR-0002).

**Read first**: [`docs/adr/0002-entity-server-system.md`](../adr/0002-entity-server-system.md) for the *why*. This document is the *how*.

Every top-level entity is an `EntityServerSpec` with its own CASL subject and visibility predicate. A child table (per-parent rows, append-only logs) is also an `EntityServerSpec`, but declares `parent: { spec, fk }` and omits its own `visibility` — its scope is derived from the parent (ADR-0002 Amendment 2026-08-11; e.g. `src/shared/modules/proposals/incentives/server-spec.ts`).

---

## Step 1: Decide where it lives

**If the entity has UI components / hooks / schemas of its own** → `src/shared/entities/<entity>/lib/` (flat Single Unit).

**If it is one of several related entity units served by one root service** → a unit folder under `src/shared/modules/<module>/<unit>/` (same entity layout; `server-spec.ts` sits at the unit root, and the module's root `service.ts` is its server API). Canonical: `src/shared/modules/proposals/{core,incentives,media,views}/`.

See `feedback-entity-organization.md` in agent memory for entity directory conventions.

---

## Step 2: Declare the entity name

`src/shared/entities/<entity>/lib/constants.ts`:

```ts
export const WIDGET = 'Widget' as const
```

Then in `src/shared/domains/permissions/abilities.ts`, import it and add to `ENTITY_NAMES`:

```ts
import { WIDGET } from '@/shared/entities/widgets/lib/constants'

export const ENTITY_NAMES = [
  CUSTOMER,
  MEETING,
  PROPOSAL,
  PROJECT,
  WIDGET,    // ← add here
] as const

export type EntityName = (typeof ENTITY_NAMES)[number]
```

If your entity needs its own CASL rules, add rules per role in `defineAbilitiesFor`.

---

## Step 3: Write the visibility predicate

`src/shared/entities/<entity>/lib/visibility.ts`:

```ts
import type { SQL } from 'drizzle-orm'
import type { VisibilityScope } from '@/shared/dal/server/types'

import { and, eq, or, exists } from 'drizzle-orm'
import { proposals, meetings } from '@/shared/db/schema'

// Signature is fixed by `EntityServerSpec.visibility: (scope: VisibilityScope) => SQL`
// — a single destructured object, not positional args. `ability` is there for
// capability-based branching (e.g. a dispatcher-only leads-pool clause); most
// predicates only need `userId`.
export function proposalVisibility({ userId }: VisibilityScope): SQL {
  return or(
    eq(proposals.ownerId, userId),
    exists(
      db.select()
        .from(meetings)
        .where(and(
          eq(meetings.id, proposals.meetingId),
          userParticipatesInMeeting(userId),
        )),
    ),
  )
}
```

---

## Step 4: Write the server-spec

```ts
// src/shared/modules/proposals/core/server-spec.ts
// (a plain entity puts this at src/shared/entities/<entity>/lib/server-spec.ts)
import { PROPOSAL } from '@/shared/modules/proposals/core/lib/constants'
import { proposalVisibility } from '@/shared/modules/proposals/core/lib/visibility'
import { insertProposalSchema, proposals, selectProposalSchema } from '@/shared/db/schema'

const updateProposalSchema = insertProposalSchema.partial()

// Concrete-typed schemas — consumed by createCrudRouter for tRPC type inference.
// The spec also holds these objects, but type-erased via the EntityServerSpec
// interface (fine for DAL's runtime .parse()).
export const proposalSchemas = {
  insert: insertProposalSchema,
  update: updateProposalSchema,
}

export const proposalServerSpec = {
  entityName: PROPOSAL,
  caslSubject: PROPOSAL,
  visibility: proposalVisibility,
  table: proposals,
  schemas: { ...proposalSchemas, select: selectProposalSchema },
  // Optional spec fields — named typed config for cross-entity patterns:
  shareable: { tokenColumn: 'token' },
  // Note: list is NOT on the spec — it's a business concern with entity-specific
  // joins, derived columns, and filter predicates. Each entity writes its own
  // list query as a business sub-router procedure.
} satisfies EntityServerSpec<typeof proposals>  // TId defaults to string (UUID)
```

---

## Step 5: Lifecycle Hooks (optional)

Hooks NEVER live on the spec (`spec.hooks`/`spec.duplicate` were deleted — CRUD-DAL
sub-plans A/D, 2026-08). They live in the **config factory** passed to
`createCrudDal` in `dal/server/crud.ts`, and the exported handlers are consumed as
`<entity>Crud.<handler>`:

```ts
// dal/server/crud.ts
export const proposalCrud = createCrudDal(proposalServerSpec, () => ({
  hooks: {
    create: {
      before(input, ctx) {
        return { ...input, ownerId: ctx.session!.user.id }
      },
      async after(row, ctx) {
        await someService.onCreated(row, ctx)
      },
    },
  },
  // Declarative duplicate config (if the entity supports duplication):
  duplicate: {
    exclude: ['createdAt', 'updatedAt', 'status'],
    overrides: (source, ctx) => ({
      label: `Copy of ${source.label}`,
      ownerId: ctx.session!.user.id,
    }),
  },
}))
```

Entities with no hooks pass no factory: `createCrudDal(spec)`. Hooks should be thin
orchestrators — extract business logic to `lib/` helpers. Reference impls:
`src/shared/entities/meetings/dal/server/crud.ts`,
`src/shared/modules/proposals/core/dal/server/crud.ts`. Full hook contract:
`src/trpc/DOCS.md`.

---

## Step 6: Compose into the entity router

`src/trpc/routers/<entity>.router/` — procedures defined once, one plain leaf per file, pure `index.ts`. (The old `createEntityRouter` factory + `EntityToolkit` were removed in the tRPC Standardization Epic; rules: `src/trpc/DOCS.md#procedures-defined-once`, `#one-leaf-shape`, `#pure-composition-index`.)

```ts
// procedures.ts — pre-scoped procedures, defined ONCE, imported by every leaf
export const proposalProcedure = agentProcedure.use(async ({ ctx, next }) => {
  const scope = resolveVisibilityScope(proposalServerSpec, { userId: ctx.session.user.id, ability: ctx.ability })
  return next({ ctx: { ...ctx, scope } })
})
export const proposalShareableProcedure = baseProcedure.use(shareableMiddleware(proposalServerSpec))
export const proposalPublicProcedure = baseProcedure

// crud.router.ts — 5 single-row operations; builds its scoped procedures inline from the spec
export const crudRouter = createCrudRouter({
  spec: proposalServerSpec,
  schemas: { ...proposalSchemas, id: z.string().uuid() },
  crud: proposalService, // REQUIRED: plain entity passes its `<entity>Crud`; the proposal module service spreads `proposalCrud`
})

// business.router.ts — entity-specific queries (list, enriched views, etc.)
export const businessRouter = createTRPCRouter({
  list: proposalProcedure.input(listSchema).query(listHandler),
  getFullView: proposalShareableProcedure.input(viewSchema).query(viewHandler),
})

// index.ts — pure composition (key order IS the tRPC path)
export const proposalsRouter = createTRPCRouter({
  crud: crudRouter,
  business: businessRouter,
  delivery: deliveryRouter, // service-layer leaf, same shape
})
```

Declare only the procedure variants the entity uses (meetings/applications need only the agent one). These are NOT custom abstractions — `proposalProcedure` IS a real tRPC procedure with full type inference and middleware composability.

---

## Step 7: Register in the app router

`src/trpc/routers/app.ts`:

```ts
export const appRouter = createTRPCRouter({
  // ...existing entries
  proposalsRouter,
})
```

---

## Step 8: Use it

```ts
// Client path segment is the registered router's variable name (from
// app.ts), not the bare entity name — `proposalsRouter`, not `proposals`.
// Agent caller — session has CASL read permission
trpc.proposalsRouter.crud.getById.useQuery({ id })
trpc.proposalsRouter.business.list.useQuery({ pagination, search })
trpc.proposalsRouter.crud.update.useMutation()
trpc.proposalsRouter.crud.duplicate.useMutation()

// Homeowner caller — shareable entity, no session
trpc.proposalsRouter.crud.getById.useQuery({ id, token: shareToken })

// Same procedure, either credential. The proposal page calls this one
// call site regardless of who the visitor is.
```

---

## Common variations

- **Enrich or derive data on create/update**: use `hooks.create.before` / `hooks.update.before` in the entity's `createCrudDal` config factory (`dal/server/crud.ts`). These run at the DAL layer before the DB write and return enriched input. Prefer config-factory hooks over handler overrides for data transformation. Never put hooks on the spec.
- **Override a CRUD handler** (last resort — bypasses hooks entirely): pass `handlers: { create: customCreateDal }` to `createCrudRouter`. The custom handler must match `CrudHandlers<TTable, TId>` for that slot. Non-overridden slots use the generic DAL defaults from `createCrudDal(spec)`.
- **Non-`id` primary key** (serial integer, custom column name, etc.): set `primaryKey` on the spec and pass `id: z.number().int()` in the schemas config. Use `EntityServerSpec<typeof table, number>` for the `TId` generic.
- **Behavior not covered by any spec field**: write it as a business procedure on the business sub-router. If the same pattern appears across 2+ entities, propose adding it as a named typed spec field — that's the promotion bar.
- **Service-layer sub-router** (email, contracts, etc.): a plain leaf — `export const deliveryRouter = createTRPCRouter({...})` importing procedures from `./procedures`, calling services and the entity's `<entity>Crud` handlers. See `proposals.router/delivery.router.ts` as the reference implementation.

---

## What NOT to do

- ❌ **Don't put callback functions or business logic in the server-spec.** The spec is data. The only function allowed is the visibility predicate (and it's a named spec field, not free-form).
- ❌ **Don't write a new `userCanSeeX` predicate in `dal/server/`.** Visibility colocates with the entity at `entities/<entity>/lib/visibility.ts`.
- ❌ **Don't hand-roll CRUD procedures.** Use `createCrudRouter()`. If the factory's output isn't sufficient, you almost certainly want a business procedure, not a custom CRUD slot.
- ❌ **Don't write `if (ctx.ability.can('manage', 'all')) ...` inline.** The CRUD factory applies CASL and visibility uniformly. Reaching for the omni check inline is a smell.
- ❌ **Don't generate procedures or sub-routers from a factory** (`createXxxRouter(entity)`, toolkit params). Define procedures once in `procedures.ts`; CRUD is its own `crud.router.ts` leaf via `createCrudRouter()`.
- ❌ **Don't define entity-name strings in `domains/permissions/`.** Identity lives in `entities/<entity>/lib/constants.ts` and is *imported* by `permissions/abilities.ts`. Inverting this creates circular logic and breaks the "entity owns its identity" rule.

---

## See also

- [ADR-0002](../adr/0002-entity-server-system.md) — the architecture decision record this how-to implements.
- [ADR-0001](../adr/0001-entity-action-system.md) — the UI-side counterpart (Entity Action System). Naming and forcing-function patterns are intentionally mirrored.
- [`docs/ubiquitous-language.md`](../ubiquitous-language.md) — canonical entity vocabulary; every entity name added here should reflect the glossary.
