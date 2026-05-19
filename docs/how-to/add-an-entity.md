# How to Add an Entity

Step-by-step procedure for adding a new business entity to the tRPC layer under the Entity Server System (ADR-0002).

**Read first**: [`docs/adr/0002-entity-server-system.md`](../adr/0002-entity-server-system.md) for the *why*. This document is the *how*.

Every entity is a top-level `EntityServerSpec` with its own CASL subject and visibility predicate. Entity-internal relations (junction tables, append-only logs) live as business plugin procedures on the parent's L2 router, not as their own entities.

---

## Step 1: Decide where it lives

**If the entity has UI components / hooks / schemas of its own** → `src/shared/entities/<entity>/lib/` (flat Single Unit).

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
import { and, eq, or, exists } from 'drizzle-orm'
import { proposals, meetings } from '@/shared/db/schema'

export const proposalVisibility = (userId: string) =>
  or(
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
```

---

## Step 4: Write the server-spec

```ts
// src/shared/entities/proposals/lib/server-spec.ts
import { PROPOSAL } from './constants'
import { proposalVisibility } from './visibility'
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

## Step 5: Compose into the entity router

`src/trpc/routers/<entity>.router/index.ts`:

```ts
import z from 'zod'
import { createEntityRouter } from '@/trpc/lib/create-entity-router'
import { createCrudRouter } from '@/trpc/lib/create-crud-router'
import { createTRPCRouter } from '@/trpc/init'
import { proposalSchemas, proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'

export const proposalsRouter = createEntityRouter(proposalServerSpec, (entity) =>
  createTRPCRouter({
    // CRUD sub-router — 5 single-row operations with full client type inference.
    // Custom handlers override create/duplicate with entity-specific business logic.
    crud: createCrudRouter({
      spec: proposalServerSpec,
      schemas: { ...proposalSchemas, id: z.string().uuid() },
      authedProcedure: entity.authedProcedure,
      shareableProcedure: entity.shareableProcedure,
      handlers: { create: customCreateDal, duplicate: customDuplicateDal },
    }),

    // Business sub-router — entity-specific queries (list, enriched views, etc.)
    business: createTRPCRouter({
      list: entity.authedProcedure.input(listSchema).query(listHandler),
      getFullView: entity.shareableProcedure.input(viewSchema).query(viewHandler),
    }),

    // Service-layer sub-router — receives entity toolkit via factory.
    delivery: createDeliveryRouter(entity),
  })
)
```

The factory function receives an **entity toolkit** with pre-configured tRPC procedures:

| Member | What it is | Middleware chain |
|--------|-----------|-----------------|
| `entity.authedProcedure` | Agent-only, scope resolved | `agentProcedure.use(scopeMiddleware(spec))` |
| `entity.shareableProcedure` | Token-or-session, auto-resolves scope | `baseProcedure.use(shareableMiddleware(spec))` |
| `entity.publicProcedure` | No auth required | `baseProcedure` (pass-through) |
| `entity.spec` | The spec itself | For sub-routers that need it |

CRUD is NOT on the toolkit — call `createCrudRouter()` directly in the factory for full type inference. These are NOT custom abstractions — `entity.authedProcedure` IS a real tRPC procedure with full type inference and middleware composability.

---

## Step 6: Register in the app router

`src/trpc/routers/app.ts`:

```ts
export const appRouter = createTRPCRouter({
  // ...existing entries
  proposalsRouter,
})
```

---

## Step 7: Use it

```ts
// Agent caller — session has CASL read permission
trpc.proposals.crud.getById.useQuery({ id })
trpc.proposals.crud.list.useQuery({ pagination, search })
trpc.proposals.crud.update.useMutation()
trpc.proposals.business.duplicateWithSnapshot.useMutation()

// Homeowner caller — shareable entity, no session
trpc.proposals.crud.getById.useQuery({ id, token: shareToken })

// Same procedure, either credential. The proposal page calls this one
// call site regardless of who the visitor is.
```

---

## Common variations

- **Override a CRUD handler**: pass `handlers: { create: customCreateDal }` to `createCrudRouter`. The custom handler must match `CrudHandlers<TTable, TId>` for that slot. Non-overridden slots use the generic DAL defaults from `createCrudDal(spec)`.
- **Non-`id` primary key** (serial integer, custom column name, etc.): set `primaryKey` on the spec and pass `id: z.number().int()` in the schemas config. Use `EntityServerSpec<typeof table, number>` for the `TId` generic.
- **Behavior not covered by any spec field**: write it as a business procedure on the business sub-router. If the same pattern appears across 2+ entities, propose adding it as a named typed spec field — that's the promotion bar.
- **Service-layer sub-router** (email, contracts, etc.): declare as a factory function `createDeliveryRouter(entity: EntityToolkit<TTable>)` that receives the entity toolkit and returns a tRPC router. Sub-routers get DAL handlers via `createCrudDal(spec)` directly. See `delivery.router.ts` as the reference implementation.

---

## What NOT to do

- ❌ **Don't put callback functions or business logic in the server-spec.** The spec is data. The only function allowed is the visibility predicate (and it's a named spec field, not free-form).
- ❌ **Don't write a new `userCanSeeX` predicate in `dal/server/`.** Visibility colocates with the entity at `entities/<entity>/lib/visibility.ts`.
- ❌ **Don't hand-roll CRUD procedures.** Use `createCrudRouter()`. If the factory's output isn't sufficient, you almost certainly want a business procedure, not a custom CRUD slot.
- ❌ **Don't write `if (ctx.ability.can('manage', 'all')) ...` inline.** The CRUD factory applies CASL and visibility uniformly. Reaching for the omni check inline is a smell.
- ❌ **Don't put `crud()` on the entity toolkit.** Call `createCrudRouter()` directly in the factory function — this is how type inference flows through. Toolkit is for pre-scoped procedures only.
- ❌ **Don't define entity-name strings in `domains/permissions/`.** Identity lives in `entities/<entity>/lib/constants.ts` and is *imported* by `permissions/abilities.ts`. Inverting this creates circular logic and breaks the "entity owns its identity" rule.

---

## See also

- [ADR-0002](../adr/0002-entity-server-system.md) — the architecture decision record this how-to implements.
- [ADR-0001](../adr/0001-entity-action-system.md) — the UI-side counterpart (Entity Action System). Naming and forcing-function patterns are intentionally mirrored.
- [`docs/domain/ubiquitous-language.md`](../domain/ubiquitous-language.md) — canonical entity vocabulary; every entity name added here should reflect the glossary.
