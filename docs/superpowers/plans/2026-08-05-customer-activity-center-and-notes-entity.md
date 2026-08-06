# Customer Activity Center + `customer-notes` Entity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `customer_notes` into a first-class Entity Server System entity with generic CRUD + Entity-Action edit/delete, then rebuild the customer-profile Activity timeline (click-through, author, grouping, filters, aggregated views, stage-safe colors).

**Architecture:** New `entities/customer-notes/` mirrors the `applications` entity (`createCrudDal` + `createEntityRouter`/`createCrudRouter`); author-or-admin authorization lives in `server-spec` hooks; the hand-coded `addNote` path is deleted and repointed to `crud.create`; the timeline UI is rebuilt as small co-located components driven by pure `lib/` derivations.

**Tech Stack:** Next.js 15, tRPC + TanStack Query, Drizzle (Postgres/Neon), CASL, Tailwind v4, shadcn/ui, `motion/react`, RHF + Zod.

## Global Constraints

- **No unit-test runner exists** (no vitest/jest; only Playwright as a dep). The per-task cycle is: implement → `pnpm tsc` (expect no errors) → `pnpm lint` (expect clean on touched files) → for **pure lib functions**, exercise via a throwaway script in the scratchpad dir and delete it → commit. UI behavior is verified in-app (dashboard is auth-gated; use the Playwright dev session route `/api/dev/playwright-session`, per `docs/codebase-conventions/dev-auth-route.md`). Never run `pnpm build`.
- **DAL is the only module that imports `db`** for writes (Rule 19); all note writes go through the entity CRUD factory.
- **No manual `updatedAt`** in `.set()` (`.$onUpdate()` handles it); **no raw `sql NOW()`** for timestamps.
- **Visibility predicate signature is the object form** `({ userId, ability }: VisibilityScope) => SQL` (the docs showing `(userId) =>` are stale — being fixed in Task 12).
- **Client tRPC path is the router's registered variable name**: `trpc.customerNotesRouter.crud.*`.
- **Highlight** uses `outline-2 outline-primary -outline-offset-2` (never `ring` — clipped by the modal scroll).
- **Stage colors are fixed semantics** (red/yellow/green/purple/blue); timeline event colors stay neutral + Cobalt `primary` only.
- **Commit trailer** on every commit: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Work on `main`, stage explicitly by path, never `git add -A`.
- Spec: `docs/superpowers/specs/2026-08-05-customer-activity-center-and-notes-entity-design.md`.

## File Structure

**New entity — `src/shared/entities/customer-notes/`**
- `lib/constants.ts` — `CUSTOMER_NOTE` identity constant
- `lib/visibility.ts` — child-of-customer scope predicate
- `lib/assert-note-author.ts` — author-or-admin guard (pure)
- `lib/server-spec.ts` — `customerNoteServerSpec` + `customerNoteSchemas` + hooks
- `dal/server/crud.ts` — `customerNoteCrud`
- `constants/note-actions.ts` — `NOTE_ACTIONS`
- `hooks/use-customer-note-actions.ts` — optimistic create/update/delete mutations
- `hooks/use-customer-note-action-configs.ts` — action configs + `useConfirm` + author gate

**tRPC**
- `src/trpc/routers/customer-notes.router/index.ts` — entity router (crud only)
- `src/trpc/routers/app.ts` — mount `customerNotesRouter`
- `src/shared/domains/permissions/abilities.ts` — register `CUSTOMER_NOTE` + agent grants

**Removed / repointed**
- `src/trpc/routers/customers.router/business.router.ts` — remove `addNote`
- `src/shared/entities/customers/dal/server/mutations.ts` — remove `addCustomerNote`
- intake note-write (`customer-intake.service.ts`) → `customerNoteCrud.create`

**Read path**
- `src/features/customer-pipelines/dal/server/get-customer-profile.ts` — author `leftJoin`
- `src/shared/entities/customers/types.ts` — widen `notes` type

**Timeline UI — `src/shared/entities/customers/`**
- `lib/build-timeline-events.ts` *(already edited; finalize author)*
- `lib/bucket-timeline-events.ts` *(new, pure)*
- `constants/timeline-event-config.ts` *(already edited)*
- `constants/timeline-view.ts` *(new)*
- `components/timeline/timeline-event-item.tsx` *(rebuilt)*
- `components/timeline/timeline-filter-chips.tsx` *(new)*
- `components/timeline/customer-timeline.tsx` *(rebuilt)*
- `components/timeline/quick-note-input.tsx` *(rebuilt)*
- `components/profile/customer-profile-modal-content.tsx` + `customer-profile-overview.tsx` — nav wiring

**Docs (Task 12)**
- `src/shared/entities/customers/DOCS.md`, `docs/adr/0001-entity-action-system.md`, `docs/how-to/add-an-entity.md`, `src/trpc/DOCS.md`

---

## Phase 1 — `customer-notes` entity + security fix

### Task 1: Entity scaffolding (spec, visibility, author guard, CRUD DAL)

**Files:**
- Create: `src/shared/entities/customer-notes/lib/constants.ts`
- Create: `src/shared/entities/customer-notes/lib/visibility.ts`
- Create: `src/shared/entities/customer-notes/lib/assert-note-author.ts`
- Create: `src/shared/entities/customer-notes/lib/server-spec.ts`
- Create: `src/shared/entities/customer-notes/dal/server/crud.ts`

**Interfaces:**
- Produces: `CUSTOMER_NOTE`, `customerNoteVisibility`, `assertNoteAuthorOrAdmin(note, ctx)`, `customerNoteServerSpec`, `customerNoteSchemas`, `customerNoteCrud`.
- Consumes: `createCrudDal` (`@/shared/dal/server/lib/create-crud-dal`), `customerCrud` (`@/shared/entities/customers/dal/server/crud`), `userCanSeeCustomer` / `leadsPoolVisibility` (`@/shared/entities/customers/dal/server/visibility`), `ThrowableDalError`, `VisibilityScope`, `ScopedContext`, `EntityServerSpec` (`@/shared/dal/server/types`).

- [ ] **Step 1: constants.ts**
```ts
/** Entity-name constant. Source of truth for `EntityName` / `AppSubject`. */
export const CUSTOMER_NOTE = 'CustomerNote' as const
```

- [ ] **Step 2: visibility.ts** — scope a note through its customer. Mirror `customerVisibility` (dispatchers use the leads pool). `userCanSeeCustomer(userId, column)` takes the customer-id column; here the note's `customerId`.
```ts
import type { SQL } from 'drizzle-orm'
import type { VisibilityScope } from '@/shared/dal/server/types'

import { customerNotes } from '@/shared/db/schema/customer-notes'
import { leadsPoolVisibility, userCanSeeCustomer } from '@/shared/entities/customers/dal/server/visibility'

/** Agent-visibility predicate — a note is visible iff its customer is. see ./DOCS.md#note-authorship */
export function customerNoteVisibility({ userId, ability }: VisibilityScope): SQL {
  if (ability.can('read', 'LeadsPool')) {
    return leadsPoolVisibility()
  }
  return userCanSeeCustomer(userId, customerNotes.customerId)
}
```
> Verify `userCanSeeCustomer`'s second arg accepts a column (it's typed `SQL | unknown`); if the leads-pool branch needs the customer join, confirm `leadsPoolVisibility()` correlates on `customers.id` — if it targets `customers` directly, keep the agent branch and drop the leads-pool branch for notes (dispatchers don't edit notes). Decide during implementation and note it in DOCS.

- [ ] **Step 3: assert-note-author.ts** — pure guard.
```ts
import type { CustomerNote } from '@/shared/db/schema/customer-notes'
import type { ScopedContext } from '@/shared/dal/server/types'

import { ThrowableDalError } from '@/shared/dal/server/types'

/** Author + admins only. see ../DOCS.md#note-authorship */
export function assertNoteAuthorOrAdmin(note: CustomerNote, ctx: ScopedContext): void {
  const userId = ctx.session?.user?.id
  const isAdmin = ctx.ability?.can('manage', 'all') ?? false
  if (isAdmin) {
    return
  }
  if (!userId || note.authorId !== userId) {
    throw new ThrowableDalError({ type: 'forbidden' })
  }
}
```
> Confirm `ScopedContext` exposes `session?.user?.id` and `ability` (types.ts:31). Adjust the access path to match.

- [ ] **Step 4: server-spec.ts** — schemas + hooks.
```ts
import type { EntityServerSpec } from '@/shared/dal/server/types'

import {
  customerNotes,
  insertCustomerNoteSchema,
  selectCustomerNoteSchema,
} from '@/shared/db/schema/customer-notes'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { CUSTOMER_NOTE } from './constants'
import { assertNoteAuthorOrAdmin } from './assert-note-author'
import { customerNoteVisibility } from './visibility'

// Only `content` is mutable; customerId/authorId are immutable after create.
const updateCustomerNoteSchema = insertCustomerNoteSchema.pick({ content: true })

export const customerNoteSchemas = {
  insert: insertCustomerNoteSchema,
  update: updateCustomerNoteSchema,
}

export const customerNoteServerSpec = {
  entityName: CUSTOMER_NOTE,
  caslSubject: CUSTOMER_NOTE,
  visibility: customerNoteVisibility,
  table: customerNotes,
  schemas: {
    insert: insertCustomerNoteSchema,
    update: updateCustomerNoteSchema,
    select: selectCustomerNoteSchema,
  },
  hooks: {
    create: {
      // Probe the target customer against ctx.scope (closes the addNote gap),
      // and stamp authorId from the session (system/public writes leave it null).
      async before(input, ctx) {
        dalVerifySuccess(await customerCrud.getById(ctx, { id: input.customerId }))
        return { ...input, authorId: ctx.session?.user?.id ?? input.authorId ?? null }
      },
    },
    update: {
      async before(data, ctx, { id }) {
        const note = dalVerifySuccess(await customerNoteCrud.getById(ctx, { id: String(id) }))
        assertNoteAuthorOrAdmin(note, ctx)
        return data
      },
    },
    delete: {
      async before(id, ctx) {
        const note = dalVerifySuccess(await customerNoteCrud.getById(ctx, { id: String(id) }))
        assertNoteAuthorOrAdmin(note, ctx)
      },
    },
  },
} satisfies EntityServerSpec<typeof customerNotes>
```
> `customerNoteCrud` is defined in Step 5 (same folder). If a circular-import warning appears (server-spec ↔ crud), inline the `getById` via `createCrudDal` in a shared module or import lazily; the `applications`/`customers` specs show the accepted pattern (customers' delete hook imports `meetingCrud`). Verify `dalVerifySuccess` unwraps `DalReturn` (throws `ThrowableDalError` on failure) at `@/shared/dal/server/lib/helpers`.

- [ ] **Step 5: crud.ts**
```ts
import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { customerNoteServerSpec } from '../../lib/server-spec'

export const customerNoteCrud = createCrudDal(customerNoteServerSpec)
```

- [ ] **Step 6: Verify** — `pnpm tsc` (no errors), `pnpm lint` (clean on the 5 new files). Resolve any import-cycle by the note above.

- [ ] **Step 7: Commit**
```bash
git add src/shared/entities/customer-notes/lib src/shared/entities/customer-notes/dal
git commit -m "feat(customer-notes): entity spec, visibility, author guard, CRUD DAL

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Router registration + CASL grants

**Files:**
- Create: `src/trpc/routers/customer-notes.router/index.ts`
- Modify: `src/trpc/routers/app.ts` (imports + `createTRPCRouter({...})` object)
- Modify: `src/shared/domains/permissions/abilities.ts` (`ENTITY_NAMES` + agent grants)

**Interfaces:**
- Produces: `customerNotesRouter`; client paths `trpc.customerNotesRouter.crud.{create,update,delete,getById,duplicate}`.
- Consumes: `createEntityRouter`, `createCrudRouter` (`../../lib/...`), `customerNoteServerSpec`, `customerNoteSchemas`.

- [ ] **Step 1: customer-notes.router/index.ts** (mirror `applications.router`, crud only)
```ts
import z from 'zod'

import { customerNoteSchemas, customerNoteServerSpec } from '@/shared/entities/customer-notes/lib/server-spec'

import { createTRPCRouter } from '../../init'
import { createCrudRouter } from '../../lib/create-crud-router'
import { createEntityRouter } from '../../lib/create-entity-router'

export const customerNotesRouter = createEntityRouter(customerNoteServerSpec, (entity) => {
  return createTRPCRouter({
    crud: createCrudRouter({
      spec: customerNoteServerSpec,
      schemas: { ...customerNoteSchemas, id: z.string().uuid() },
      authedProcedure: entity.authedProcedure,
      shareableProcedure: entity.shareableProcedure,
    }),
  })
})
```

- [ ] **Step 2: app.ts** — add `import { customerNotesRouter } from './customer-notes.router'` (alpha order) and add `customerNotesRouter,` to the `createTRPCRouter({...})` object.

- [ ] **Step 3: abilities.ts** — `import { CUSTOMER_NOTE } from '@/shared/entities/customer-notes/lib/constants'`; add `CUSTOMER_NOTE,` to `ENTITY_NAMES`; in the `agent` case add:
```ts
can('read', 'CustomerNote')
can('create', 'CustomerNote')
can('update', 'CustomerNote')
can('delete', 'CustomerNote') // narrowed to author-or-admin by server-spec hooks; see customer-notes DOCS
```
> super-admin already has `manage:all`. Check whether `dispatcher`/other roles need `read` (they see customer profiles) — grant `read` to any role that opens the profile modal.

- [ ] **Step 4: Verify** — `pnpm tsc`, `pnpm lint`. Confirm `AppSubject` now includes `'CustomerNote'` (derived from `ENTITY_NAMES`), so `permission: ['update','CustomerNote']` type-checks in Task 5.

- [ ] **Step 5: Commit**
```bash
git add src/trpc/routers/customer-notes.router src/trpc/routers/app.ts src/shared/domains/permissions/abilities.ts
git commit -m "feat(customer-notes): mount entity router + CASL grants

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Delete the ad-hoc note path; repoint composer + intake

**Files:**
- Modify: `src/trpc/routers/customers.router/business.router.ts` (remove `addNote`)
- Modify: `src/shared/entities/customers/dal/server/mutations.ts` (remove `addCustomerNote`)
- Modify: intake service (`.../customer-intake.service.ts`) note-write → `customerNoteCrud.create`
- (composer repoint happens in Task 10; here just remove the server surface and fix intake + any other caller)

**Interfaces:**
- Consumes: `customerNoteCrud.create` (Task 1).

- [ ] **Step 1: Find all callers**
```bash
grep -rn "addNote\|addCustomerNote" src
```
Record every hit. Expected: `business.router.ts`, `mutations.ts`, `quick-note-input.tsx`, `customer-intake.service.ts` (via `createFromIntake`).

- [ ] **Step 2: Repoint intake** — in the intake service, replace the `addCustomerNote(...)` call with `customerNoteCrud.create(ctx, { customerId, content })` (author stays null for public intake — the `create.before` hook passes the customer probe under the intake's context; if intake runs unscoped/system, confirm the probe passes). Keep the note optional-when-empty behavior.

- [ ] **Step 3: Remove `addNote`** from `business.router.ts` and `addCustomerNote` from `mutations.ts`.

- [ ] **Step 4: Temporarily repoint the composer** so the app compiles: in `quick-note-input.tsx` change `trpc.customersRouter.business.addNote` → `trpc.customerNotesRouter.crud.create` with input `{ customerId, content }` (full composer rebuild is Task 10). If simpler, leave `quick-note-input` untouched until Task 10 and instead keep the app compiling by verifying no other prod caller of the removed procedure remains.

- [ ] **Step 5: Verify** — `grep -rn "addNote\|addCustomerNote" src` returns nothing; `pnpm tsc`, `pnpm lint`.

- [ ] **Step 6: Commit**
```bash
git add src/trpc/routers/customers.router/business.router.ts src/shared/entities/customers/dal/server/mutations.ts <intake-service> src/shared/entities/customers/components/timeline/quick-note-input.tsx
git commit -m "refactor(customer-notes): remove ad-hoc addNote; route note writes through crud.create

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2 — Author read-path

### Task 4: Join note author into the profile query + widen the type

**Files:**
- Modify: `src/features/customer-pipelines/dal/server/get-customer-profile.ts:170-174,232`
- Modify: `src/shared/entities/customers/types.ts` (`notes` field on `CustomerProfileData`)

**Interfaces:**
- Produces: `CustomerProfileData.notes: CustomerNoteWithAuthor[]` where `CustomerNoteWithAuthor = CustomerNote & { authorName: string | null, authorImage: string | null }`.

- [ ] **Step 1: Widen the type** in `types.ts` — define and export:
```ts
export type CustomerNoteWithAuthor = CustomerNote & {
  authorName: string | null
  authorImage: string | null
}
```
and change `notes: CustomerNote[]` → `notes: CustomerNoteWithAuthor[]`.

- [ ] **Step 2: Join in the query** — replace the `noteRows` select (currently `db.select().from(customerNotes)...`) with an explicit projection + null-safe `leftJoin(user)`:
```ts
import { user } from '@/shared/db/schema/auth'
// ...
const noteRows = await db
  .select({
    id: customerNotes.id,
    customerId: customerNotes.customerId,
    content: customerNotes.content,
    authorId: customerNotes.authorId,
    createdAt: customerNotes.createdAt,
    updatedAt: customerNotes.updatedAt,
    authorName: user.name,
    authorImage: user.image,
  })
  .from(customerNotes)
  .leftJoin(user, eq(user.id, customerNotes.authorId))
  .where(eq(customerNotes.customerId, customerId))
  .orderBy(desc(customerNotes.createdAt))
```
Confirm the `user` table columns (`name`, `image`) — grep `src/shared/db/schema/auth.ts`. Keep the existing customer-scope guard on the surrounding query untouched (don't widen visibility).

- [ ] **Step 3: Feed author into timeline events** — in `build-timeline-events.ts`, the `note_added` push already sets `metadata: { authorId }`; extend to `metadata: { authorId: note.authorId, authorName: note.authorName, authorImage: note.authorImage }`.

- [ ] **Step 4: Verify** — `pnpm tsc` (the widened type should ripple to `build-timeline-events` and any note consumer), `pnpm lint`.

- [ ] **Step 5: Commit**
```bash
git add src/features/customer-pipelines/dal/server/get-customer-profile.ts src/shared/entities/customers/types.ts src/shared/entities/customers/lib/build-timeline-events.ts
git commit -m "feat(customer-notes): resolve note author (name+avatar) in profile query

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3 — Note actions (Entity Action System)

### Task 5: NOTE_ACTIONS + mutation hook + action-configs hook

**Files:**
- Create: `src/shared/entities/customer-notes/constants/note-actions.ts`
- Create: `src/shared/entities/customer-notes/hooks/use-customer-note-actions.ts`
- Create: `src/shared/entities/customer-notes/hooks/use-customer-note-action-configs.ts`

**Interfaces:**
- Produces: `NOTE_ACTIONS`; `useCustomerNoteActions()` → `{ createNote, updateNote, deleteNote }` (each a TanStack `useMutation`); `useCustomerNoteActionConfigs<T>({ note, onEdit })` → `{ actions, DeleteConfirmDialog }`.
- Consumes: `EntityAction` type, `EntityActionConfig`, `useConfirm`, `useInvalidation().cross.customerProfile`, `useTRPC`.

- [ ] **Step 1: note-actions.ts**
```ts
import type { EntityAction } from '@/shared/components/entity-actions/types'

import { PencilIcon, TrashIcon } from 'lucide-react'

export const NOTE_ACTIONS = {
  edit: {
    id: 'edit',
    label: 'Edit note',
    icon: PencilIcon,
    permission: ['update', 'CustomerNote'],
  },
  delete: {
    id: 'delete',
    label: 'Delete note',
    icon: TrashIcon,
    permission: ['delete', 'CustomerNote'],
    destructive: true,
    separatorBefore: true,
  },
} as const satisfies Record<string, EntityAction>
```

- [ ] **Step 2: use-customer-note-actions.ts** — mutations with optimistic insert (create) and precise invalidation. Mirror `use-customer-actions.ts`; invalidate `getCustomerProfile` for the customer.
```ts
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

export function useCustomerNoteActions(customerId: string) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const { cross } = useInvalidation()
  const invalidate = () => qc.invalidateQueries(cross.customerProfile(customerId))

  const createNote = useMutation(
    trpc.customerNotesRouter.crud.create.mutationOptions({
      onSuccess: () => invalidate(),
      onError: err => toast.error(err.message ?? 'Failed to add note'),
    }),
  )
  const updateNote = useMutation(
    trpc.customerNotesRouter.crud.update.mutationOptions({
      onSuccess: () => invalidate(),
      onError: err => toast.error(err.message ?? 'Failed to update note'),
    }),
  )
  const deleteNote = useMutation(
    trpc.customerNotesRouter.crud.delete.mutationOptions({
      onSuccess: () => { invalidate(); toast.success('Note deleted') },
      onError: err => toast.error(err.message ?? 'Failed to delete note'),
    }),
  )

  return { createNote, updateNote, deleteNote }
}
```
> `useInvalidation()` exposes `cross.customerProfile(customerId)` (verified at use-invalidation.ts:28). Confirm it's returned publicly; if only `invalidateCustomer` is exported, add `cross` to the return or use the existing `invalidateCustomer({ customerId })` variant — but prefer the precise `cross.customerProfile` per convention (R22). Optimistic cache mutation (onMutate/onError rollback) is optional polish; wire it in this hook if desired following `pattern-optimistic-updates`.

- [ ] **Step 3: use-customer-note-action-configs.ts** — gate edit/delete by author-or-admin (client mirror), wire `useConfirm`.
```ts
'use client'

import type { JSX } from 'react'
import type { EntityActionConfig } from '@/shared/components/entity-actions/types'
import type { CustomerNoteWithAuthor } from '@/shared/entities/customers/types'

import { useMemo } from 'react'

import { authClient } from '@/shared/domains/auth/client'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { NOTE_ACTIONS } from '@/shared/entities/customer-notes/constants/note-actions'
import { useCustomerNoteActions } from './use-customer-note-actions'

interface Args {
  customerId: string
  onEdit: (note: CustomerNoteWithAuthor) => void
}

interface Result {
  actions: EntityActionConfig<CustomerNoteWithAuthor>[]
  DeleteConfirmDialog: () => JSX.Element
}

export function useCustomerNoteActionConfigs({ customerId, onEdit }: Args): Result {
  const ability = useAbility()
  const { data: session } = authClient.useSession()
  const { deleteNote } = useCustomerNoteActions(customerId)
  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: 'Delete note',
    message: 'This permanently deletes the note. This cannot be undone.',
  })

  const currentUserId = session?.user?.id
  const isAdmin = ability.can('manage', 'all')

  const actions = useMemo((): EntityActionConfig<CustomerNoteWithAuthor>[] => {
    return [
      {
        action: NOTE_ACTIONS.edit,
        onAction: (note) => onEdit(note),
      },
      {
        action: NOTE_ACTIONS.delete,
        onAction: async (note) => {
          if (!(await confirmDelete())) {
            return
          }
          deleteNote.mutate({ id: note.id })
        },
        isLoading: deleteNote.isPending,
      },
    ]
  }, [confirmDelete, deleteNote, onEdit])

  // Row-ownership gate (server enforces the same). Return no actions for
  // non-author non-admins so the menu doesn't render.
  const canManage = (note: CustomerNoteWithAuthor) =>
    isAdmin || (!!currentUserId && note.authorId === currentUserId)

  return { actions, DeleteConfirmDialog, canManage } as Result & { canManage: typeof canManage }
}
```
> Confirm `authClient.useSession()` (used in `casl-provider.tsx`) and `useAbility()` (`@/shared/domains/permissions/hooks`). The per-note `canManage` gate is applied at the render site (Task 7) to decide whether to mount the menu — cleaner than filtering inside `useMemo`. Adjust the return type accordingly (add `canManage` to `Result`).

- [ ] **Step 4: Verify** — `pnpm tsc`, `pnpm lint`.

- [ ] **Step 5: Commit**
```bash
git add src/shared/entities/customer-notes/constants src/shared/entities/customer-notes/hooks
git commit -m "feat(customer-notes): entity actions (edit/delete) with author-or-admin gate

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4 — Timeline data/logic

### Task 6: Finalize event derivation + date bucketing + view constants

**Files:**
- Modify: `src/shared/entities/customers/lib/build-timeline-events.ts` *(author metadata done in Task 4 Step 3 — verify)*
- Create: `src/shared/entities/customers/lib/bucket-timeline-events.ts`
- Create: `src/shared/entities/customers/constants/timeline-view.ts`

**Interfaces:**
- Produces: `bucketTimelineEvents(events): TimelineDateGroup[]` where `TimelineDateGroup = { label: string, events: TimelineEvent[] }`; `TIMELINE_FILTERS` (chip defs), `TIMELINE_PAGE_CAP`.
- Consumes: `TimelineEvent`, `TimelineEventCategory`, `TIMELINE_EVENT_CONFIG`, `date-fns` (`isToday`, `isYesterday`, `format`).

- [ ] **Step 1: timeline-view.ts**
```ts
import type { TimelineEventCategory } from './timeline-event-config'

export const TIMELINE_PAGE_CAP = 25

export const TIMELINE_FILTERS = [
  { id: 'all', label: 'All', category: null },
  { id: 'note', label: 'Notes', category: 'note' },
  { id: 'meeting', label: 'Meetings', category: 'meeting' },
  { id: 'proposal', label: 'Proposals', category: 'proposal' },
] as const satisfies readonly { id: string, label: string, category: TimelineEventCategory | null }[]

export type TimelineFilterId = (typeof TIMELINE_FILTERS)[number]['id']
```
> `timeline-view.ts` is a constants file — TS type export co-located is allowed (Rule 26). Move `TimelineEventCategory` import from `timeline-event-config.ts` (already exported there).

- [ ] **Step 2: bucket-timeline-events.ts** (pure)
```ts
import type { TimelineEvent } from '@/shared/entities/customers/types/timeline'

import { format, isToday, isYesterday } from 'date-fns'

export interface TimelineDateGroup {
  label: string
  events: TimelineEvent[]
}

/** Group reverse-chron events into day buckets. Input MUST be pre-sorted desc. */
export function bucketTimelineEvents(events: TimelineEvent[]): TimelineDateGroup[] {
  const groups: TimelineDateGroup[] = []
  let current: TimelineDateGroup | null = null
  let currentKey = ''

  for (const event of events) {
    const date = new Date(event.timestamp)
    const key = format(date, 'yyyy-MM-dd')
    if (key !== currentKey) {
      currentKey = key
      const label = isToday(date) ? 'Today' : isYesterday(date) ? 'Yesterday' : format(date, 'MMM d, yyyy')
      current = { label, events: [] }
      groups.push(current)
    }
    current!.events.push(event)
  }
  return groups
}
```

- [ ] **Step 3: Exercise the pure fns** — write `/tmp/claude-.../scratchpad/bucket-check.mts` importing nothing app-specific (inline a fake `TimelineEvent[]` with today/yesterday/older timestamps), run with `pnpm tsx`, assert 3 groups with correct labels/order; delete the script. (Timestamps: pass them literally — do NOT rely on `Date.now()` semantics in the script beyond constructing fixed ISO strings relative to a hardcoded "now" you print.)

- [ ] **Step 4: Verify** — `pnpm tsc`, `pnpm lint`.

- [ ] **Step 5: Commit**
```bash
git add src/shared/entities/customers/lib/bucket-timeline-events.ts src/shared/entities/customers/constants/timeline-view.ts src/shared/entities/customers/lib/build-timeline-events.ts
git commit -m "feat(timeline): date bucketing + filter/paging constants

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5 — Timeline UI

> Phase 5 components are verified by `pnpm tsc` + `pnpm lint` and then **in-app** (open a customer profile → Overview via the Playwright dev session). Provide the structure below; refine spacing/animation visually per the impeccable craft floor and `feedback-motion-patterns` (read it before adding motion).

### Task 7: Rebuild `timeline-event-item.tsx`

**Files:**
- Modify (rewrite): `src/shared/entities/customers/components/timeline/timeline-event-item.tsx`

**Interfaces:**
- Consumes: `TimelineEvent`, `TIMELINE_EVENT_CONFIG`, `useCustomerNoteActionConfigs`, `EntityActionMenu`, `Avatar`, `useCustomerNoteActions` (for inline edit save), RHF for inline edit.
- Produces: `TimelineEventItem` with props `{ event, customerId, isExpanded, onToggle, onOpenMeeting }`.

**Structure (implement, then verify in-app):**
- Props: `{ event: TimelineEvent; customerId: string; isExpanded: boolean; onToggle: (id: string) => void; onOpenMeeting: (meetingId: string) => void }`. (Global `expanded` prop is gone; expansion is per-event, driven by the container's `expandedIds` set.)
- **Rail node:** icon in a bordered chip (`grid size-[22px] place-items-center rounded-full border bg-background`) positioned on the group's rail; content indented to clear it. Color from `config.color` (already stage-safe). Render `config.label` as SR-only text for a11y.
- **Row header** is a `<button type="button" aria-expanded={isExpanded} onClick={() => onToggle(event.id)}>` containing: title (`truncate` when collapsed), an **in-row timestamp** (`formatDistanceToNow(...)`, with `title={absoluteDate}` native tooltip — drop the per-row `TooltipProvider`), and a chevron. For `proposal_viewed` with `metadata.count > 1`, append ` (viewed ${count}×)`.
- **Expanded, note events:** author row (`Avatar` from `metadata.authorImage` + `metadata.authorName ?? 'System'` + absolute time), full content (`whitespace-pre-wrap`), and — only when `canManage(event as note)` — a `<DeleteConfirmDialog />` + `<EntityActionMenu entity={note} actions={noteActions} mode="compact" />`. Edit action flips the row into an inline RHF `<Textarea>` (`zodResolver` on `{ content: z.string().min(1).max(2000) }`) that calls `updateNote.mutate({ id, data: { content } })` then exits edit mode.
- **Expanded, meeting/proposal events:** show `description`/metadata (trade/value), plus an explicit **"Open in Meetings →"** button calling `onOpenMeeting(String(event.metadata?.meetingId))` (guard when absent). Also render a hover arrow on the collapsed row for discoverability. These rows have **no** `EntityActionMenu`.
- Build note-actions via `useCustomerNoteActionConfigs({ customerId, onEdit: setEditingNote })`. Because hooks can't be conditional, call the configs hook once at the top; use the returned `canManage(note)` to decide whether to mount the menu.

- [ ] **Step 1:** Implement the component per the structure above.
- [ ] **Step 2: Verify** — `pnpm tsc`, `pnpm lint`.
- [ ] **Step 3: Commit** `git add <file>` → `feat(timeline): rebuild event item (rail node, per-event expand, note author + actions)`.

---

### Task 8: `timeline-filter-chips.tsx`

**Files:**
- Create: `src/shared/entities/customers/components/timeline/timeline-filter-chips.tsx`

**Interfaces:**
- Produces: `TimelineFilterChips` with props `{ value: TimelineFilterId; onChange: (id: TimelineFilterId) => void; counts?: Record<TimelineFilterId, number> }`.
- Consumes: `TIMELINE_FILTERS`.

- [ ] **Step 1:** Render `TIMELINE_FILTERS` as a single-select row of small toggle buttons (active = `bg-primary text-primary-foreground`, inactive = `bg-secondary`), optional count suffix. Keyboard-focusable.
- [ ] **Step 2: Verify** — `pnpm tsc`, `pnpm lint`.
- [ ] **Step 3: Commit** → `feat(timeline): category filter chips`.

---

### Task 9: Rebuild `customer-timeline.tsx` (orchestrator)

**Files:**
- Modify (rewrite): `src/shared/entities/customers/components/timeline/customer-timeline.tsx`

**Interfaces:**
- Consumes: `buildTimelineEvents`, `bucketTimelineEvents`, `TIMELINE_FILTERS`, `TIMELINE_PAGE_CAP`, `TimelineEventItem`, `TimelineFilterChips`, `QuickNoteInput`, `EmptyState` (`@/shared/components/states/...`).
- Produces: `CustomerTimeline` props `{ data, onMutationSuccess, onOpenMeeting }`.

**Structure:**
- State: `expandedIds: Set<string>`, `activeFilter: TimelineFilterId`, `showAll: boolean`.
- Header row: "Activity" title + **Expand all / Collapse all** toggle (fills/clears `expandedIds` with the currently-visible event ids).
- `QuickNoteInput` (composer).
- `TimelineFilterChips` (with per-category counts).
- Derive: `events = buildTimelineEvents(data)` → filter by `activeFilter` (category via `TIMELINE_EVENT_CONFIG[type].category`) → cap to `TIMELINE_PAGE_CAP` unless `showAll` → `bucketTimelineEvents(capped)`.
- Render date groups: each group = a label header + an `<ol>` rail containing `TimelineEventItem`s; pass `isExpanded={expandedIds.has(event.id)}`, `onToggle`, `onOpenMeeting`, `customerId`.
- If `events.length > TIMELINE_PAGE_CAP && !showAll`: a **"Show earlier activity"** button.
- Empty (`events.length === 0`): shared `EmptyState` (title "No activity yet", body nudging the composer above).

- [ ] **Step 1:** Implement per structure.
- [ ] **Step 2: Verify** — `pnpm tsc`, `pnpm lint`.
- [ ] **Step 3: Commit** → `feat(timeline): rebuild container (expand-all, filters, buckets, show-earlier, empty)`.

---

### Task 10: Rebuild `quick-note-input.tsx` (RHF composer)

**Files:**
- Modify (rewrite): `src/shared/entities/customers/components/timeline/quick-note-input.tsx`

**Interfaces:**
- Consumes: `useForm` + `zodResolver`, `useCustomerNoteActions(customerId).createNote`, `Textarea`, `Button`.
- Produces: `QuickNoteInput` props `{ customerId, onSuccess }`.

**Structure:**
- `useForm({ resolver: zodResolver(z.object({ content: z.string().min(1).max(2000) })) })`.
- `Textarea` bound via `register('content')`; Cmd/Ctrl+Enter submits (keep the handler); show a small "⌘⏎ to add" hint near the button.
- Submit → `createNote.mutate({ customerId, content }, { onSuccess: () => { reset(); onSuccess() } })`. Errors surface via the mutation's `onError` toast (Task 5); do **not** clear input on error.
- Submit button: **Cobalt primary** (`Button` default variant), label "Add note", disabled while pending or empty.

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Verify** — `pnpm tsc`, `pnpm lint`.
- [ ] **Step 3: Commit** → `feat(timeline): RHF note composer via crud.create (optimistic, primary CTA)`.

---

### Task 11: Navigation wiring (controlled Tabs + highlight)

**Files:**
- Modify: `src/shared/entities/customers/components/profile/customer-profile-modal-content.tsx`
- Modify: `src/shared/entities/customers/components/profile/customer-profile-overview.tsx`

**Interfaces:**
- Produces: `onOpenMeeting(meetingId: string)` threaded modal-content → overview → timeline.

**Structure:**
- In `customer-profile-modal-content.tsx`: lift Tabs to controlled — `const [tab, setTab] = useState(defaultTab ?? 'overview')` and `const [activeHighlightId, setActiveHighlightId] = useState<string | undefined>(highlightMeetingId)`. Pass `value={tab} onValueChange={setTab}` to `<Tabs>`. Define `const handleOpenMeeting = (meetingId: string) => { setActiveHighlightId(meetingId); setTab('meetings') }`. Pass `activeHighlightId ?? highlightMeetingId` to `CustomerMeetingsList`/`CustomerProjectsList` (they already outline on `meeting.id`). Pass `onOpenMeeting={handleOpenMeeting}` into `CustomerProfileOverview`.
- In `customer-profile-overview.tsx`: accept `onOpenMeeting` and pass to `CustomerTimeline`.

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Verify** — `pnpm tsc`, `pnpm lint`. In-app: click a proposal/meeting event → tab switches to Meetings and the parent meeting card is outlined.
- [ ] **Step 3: Commit** → `feat(timeline): click-through to Meetings tab with parent-meeting highlight`.

---

## Phase 6 — Docs

### Task 12: Business-rule record + stale-doc fixes

**Files:**
- Modify: `src/shared/entities/customers/DOCS.md` (or new `customer-notes/DOCS.md`)
- Modify: `docs/adr/0001-entity-action-system.md`
- Modify: `docs/how-to/add-an-entity.md`, `src/trpc/DOCS.md`

- [ ] **Step 1:** Add a `#note-authorship` rule: author + admins may edit/delete a customer note (enforced in `customer-notes` server-spec hooks + client action-config gate); the activity timeline is JIT-derived (not persisted). Reference it by slug from `assert-note-author.ts` and `visibility.ts`.
- [ ] **Step 2:** Amend ADR-0001 with a "Status: superseded by as-built" note — the registry/`EntitySpec`/`entityType`-prop design was not built; the shipped system is `constants/actions.ts` + `use-*-actions` + `use-*-action-configs` + `<EntityActionMenu entity actions mode />`. Point to `entities/meetings` + `entities/customer-notes` as exemplars.
- [ ] **Step 3:** Fix `add-an-entity.md` + `trpc/DOCS.md`: visibility signature `({ userId, ability }) => SQL`; client paths `trpc.<name>Router.crud.*`; refresh the migration table to note broad adoption (customers, meetings, proposals, projects, applications, customer-notes, …).
- [ ] **Step 4: Verify** — `pnpm lint` (markdown untouched by eslint; just confirm no code broke). 
- [ ] **Step 5: Commit** → `docs: note-authorship rule + amend ADR-0001 + fix add-an-entity/DOCS drift`.

---

## Self-Review

**Spec coverage:** §4.1 entity → Tasks 1–2; §4.1 authorization hooks → Task 1; §4.2 migration/security → Task 3 (+ create.before probe in Task 1); §4.3 note actions → Task 5 + render in Task 7; §4.4 author read-path → Task 4; §4.5 timeline (events/buckets/constants) → Task 6, (item) Task 7, (chips) Task 8, (container) Task 9, (composer) Task 10, (nav) Task 11; §4.6 docs → Task 12. All covered.

**Type consistency:** `customerNoteCrud` (Task 1) used in server-spec + hooks; `CustomerNoteWithAuthor` defined in Task 4, consumed in Tasks 5/7; `onOpenMeeting` signature consistent across Tasks 7/9/11; `TimelineFilterId` from Task 6 used in Tasks 8/9; `TimelineDateGroup` from Task 6 used in Task 9.

**Open verification flags (resolve during implementation, do not skip):** the server-spec ↔ crud import cycle (Task 1 Step 4 note); `useInvalidation` exposing `cross` publicly (Task 5 Step 2 note); `authClient.useSession()` + `useAbility()` exact imports (Task 5 Step 3 note); intake write under system/public context passing `create.before` (Task 3 Step 2); `user` table `name`/`image` columns (Task 4 Step 2).
