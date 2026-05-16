# How to Add an Entity

Step-by-step procedure for adding a new business entity to the tRPC layer under the Entity Server System (ADR-0002).

**Read first**: [`docs/adr/0002-entity-server-system.md`](../adr/0002-entity-server-system.md) for the *why*. This document is the *how*.

## Two flavors

- **Core entity** — independent identity, gets its own tRPC router. Has its own CASL subject and visibility predicate. Examples: Customer, Meeting, Proposal, Project.
- **Nested entity** — owned by a core entity, exposed only via the parent's router. Inherits CASL + visibility from the parent unless overridden. Examples: ProposalLineItem (owned by Proposal), MeetingParticipant (owned by Meeting).

The discriminant in the typed spec is `parentEntity: null | EntityName`. TypeScript refuses to compile the spec if you set the wrong combination of fields for the branch.

---

## Step 1: Decide where it lives

**If the entity has UI components / hooks / schemas of its own** → `src/shared/entities/<entity>/lib/` (flat Single Unit).

**If the entity is a nested entity with no UI surface** (purely a data table accessed through the parent) → put its files alongside the parent's `core/` subdir:

```
src/shared/entities/proposals/
  core/                          ← the Proposal entity
    lib/
    components/
    ...
  line-items/                    ← nested entity, no UI
    lib/
```

If the entity family doesn't yet have nested entities, the parent's stuff is flat (`entities/proposals/lib/`, etc.). The first nested addition triggers a one-time restructure into the `core/` + `<nested>/` shape. See `feedback-entity-organization.md` in agent memory.

---

## Step 2: Declare the entity name

`src/shared/entities/<entity>/[core/|<nested>/]lib/constants.ts`:

```ts
export const PROPOSAL_LINE_ITEM = 'ProposalLineItem' as const
```

Then in `src/shared/domains/permissions/abilities.ts`, import it and add to `ENTITY_NAMES`:

```ts
import { PROPOSAL_LINE_ITEM } from '@/shared/entities/proposals/line-items/lib/constants'

export const ENTITY_NAMES = [
  CUSTOMER,
  MEETING,
  PROPOSAL,
  PROJECT,
  PROPOSAL_LINE_ITEM,    // ← add here
] as const

export type EntityName = (typeof ENTITY_NAMES)[number]
```

If your entity needs its own CASL rules (i.e. its `caslSubject` differs from any parent), add rules per role in `defineAbilitiesFor`. Nested entities that inherit don't need this.

---

## Step 3: Write the visibility predicate (core entities only)

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

Nested entities skip this — visibility is auto-derived as "join to parent via `parentRef` and apply parent's predicate." Override only when you need different semantics.

---

## Step 4: Write the server-spec

### Core entity

```ts
// src/shared/entities/proposals/core/lib/server-spec.ts
import { PROPOSAL } from './constants'
import { proposalVisibility } from './visibility'
import { proposalsTable } from '@/shared/db/schema'
import { createInsertSchema, createUpdateSchema, createSelectSchema } from 'drizzle-zod'

export const proposalServerSpec = {
  entityName: PROPOSAL,
  parentEntity: null,
  caslSubject: PROPOSAL,
  visibility: proposalVisibility,
  table: proposalsTable,
  schemas: {
    insert: createInsertSchema(proposalsTable),
    update: createUpdateSchema(proposalsTable),
    select: createSelectSchema(proposalsTable),
  },
  // Optional spec fields — named typed config for cross-entity patterns:
  shareable: { tokenColumn: 'token' },
  update: {
    jsonbMergeColumns: [
      proposalsTable.formMetaJSON,
      proposalsTable.projectJSON,
      proposalsTable.fundingJSON,
    ],
  },
  list: {
    searchColumns: [proposalsTable.title],
    sortableColumns: {
      createdAt: proposalsTable.createdAt,
      title: proposalsTable.title,
    },
    defaultSort: { column: 'createdAt', dir: 'desc' },
  },
} satisfies CoreEntitySpec
```

### Nested entity

```ts
// src/shared/entities/proposals/line-items/lib/server-spec.ts
import { PROPOSAL, PROPOSAL_LINE_ITEM } from '../../core/lib/constants'
import { proposalLineItemsTable } from '@/shared/db/schema'

export const proposalLineItemServerSpec = {
  entityName: PROPOSAL_LINE_ITEM,
  parentEntity: PROPOSAL,                                       // discriminant: non-null
  parentRef: { foreignKey: proposalLineItemsTable.proposalId },
  table: proposalLineItemsTable,
  schemas: { insert: ..., update: ..., select: ... },
  // No caslSubject — inherits PROPOSAL's rules via parent chain
  // No visibility — derived as "join to proposals via parentRef, apply proposalVisibility"
  // Optional: override either field locally if this nested entity has genuinely different rules
} satisfies NestedEntitySpec
```

---

## Step 5: Compose into the entity router (core entities only)

`src/trpc/routers/<entity>.router/index.ts`:

```ts
import { createEntityRouter } from '@/trpc/lib/create-entity-router'
import { proposalServerSpec } from '@/shared/entities/proposals/core/lib/server-spec'
import { proposalBusinessRouter } from './business'
import { proposalDeliveryRouter } from './delivery'

export const proposalsRouter = createEntityRouter(proposalServerSpec, {
  business: proposalBusinessRouter,
  delivery: proposalDeliveryRouter,
})
```

The CRUD sub-router is auto-plugged. Plugins are `(spec) => Router` factories:

```ts
// src/trpc/routers/proposals.router/business.ts
import { z } from 'zod'
import { createTRPCRouter, agentProcedure } from '@/trpc/init'
import { createCrudHandlers } from '@/trpc/lib/create-crud-handlers'
import type { ProposalServerSpec } from '@/shared/entities/proposals/core/lib/server-spec'

export const proposalBusinessRouter = (spec: ProposalServerSpec) => {
  const handlers = createCrudHandlers(spec)

  return createTRPCRouter({
    duplicateWithSnapshot: agentProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const source = await handlers.getById(ctx, { id: input.id })
        // ...custom snapshot logic, then call handlers.create
      }),
  })
}
```

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

## Nested entities: how parent routers consume them

Nested entities have no router of their own. The parent router imports their L0 handlers and composes them into business procedures:

```ts
// inside proposalBusinessRouter
import { proposalLineItemServerSpec } from '@/shared/entities/proposals/line-items/lib/server-spec'

export const proposalBusinessRouter = (spec: ProposalServerSpec) => {
  const proposalHandlers = createCrudHandlers(spec)
  const lineItemHandlers = createCrudHandlers(proposalLineItemServerSpec)

  return createTRPCRouter({
    addLineItem: agentProcedure
      .input(z.object({ proposalId: z.string().uuid(), data: lineItemInsertSchema }))
      .mutation(({ ctx, input }) => lineItemHandlers.create(ctx, input)),

    updateLineItem: agentProcedure
      .input(z.object({ id: z.string().uuid(), data: lineItemUpdateSchema }))
      .mutation(({ ctx, input }) => lineItemHandlers.update(ctx, input)),
  })
}
```

The nested entity's CASL and visibility are inherited via the parent chain — no `assertOwnership` helper needed. If the user can't see the parent proposal, they can't operate on its line items.

---

## Common variations

- **Suppress a CRUD slot**: `createCrudRouter(spec, { exclude: ['delete'] })`. The handler is still generated at L0 (so business procedures can still call it internally) but it's not surfaced in the public tRPC router.
- **Non-`id` primary key** (serial integer, custom column name, etc.): set `primaryKey` on the spec. The factory derives the id schema from `spec.schemas.select.shape[spec.primaryKey]`. The consumer-facing input field is always normalized to `id`; the factory maps to the actual column name internally.
- **Behavior not covered by any spec field**: write it as a business procedure that calls `handlers.<slot>` internally. Do NOT add it as a CRUD override. If the same pattern appears across 2+ entities, propose adding it as a named typed spec field — that's the promotion bar.

---

## What NOT to do

- ❌ **Don't put callback functions or business logic in the server-spec.** The spec is data. The only function allowed is the visibility predicate (and it's a named spec field, not free-form).
- ❌ **Don't write a new `userCanSeeX` predicate in `dal/server/`.** Visibility colocates with the entity at `entities/<entity>/lib/visibility.ts`.
- ❌ **Don't hand-roll CRUD procedures.** Use the factory. If the factory's output isn't sufficient, you almost certainly want a business procedure, not a custom CRUD slot.
- ❌ **Don't write `if (ctx.ability.can('manage', 'all')) ...` inline.** The L0 factory applies CASL and visibility uniformly. Reaching for the omni check inline is a smell.
- ❌ **Don't expose a CRUD router for a nested entity.** `createCrudRouter` refuses to compile when `spec.parentEntity !== null`. If you find yourself wanting one, the entity is probably a core entity in disguise — reconsider the model.
- ❌ **Don't define entity-name strings in `domains/permissions/`.** Identity lives in `entities/<entity>/lib/constants.ts` and is *imported* by `permissions/abilities.ts`. Inverting this creates circular logic and breaks the "entity owns its identity" rule.

---

## See also

- [ADR-0002](../adr/0002-entity-server-system.md) — the architecture decision record this how-to implements.
- [ADR-0001](../adr/0001-entity-action-system.md) — the UI-side counterpart (Entity Action System). Naming and forcing-function patterns are intentionally mirrored.
- [`docs/domain/ubiquitous-language.md`](../domain/ubiquitous-language.md) — canonical entity vocabulary; every entity name added here should reflect the glossary.
