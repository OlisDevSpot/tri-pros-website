# CASL Phase 6 — Owned Sub-Entity Cutovers + Homeowner Invariant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the built-but-dead child bridge in `resolveActorScope` onto the two structurally-owned Tier-2 children (`customer-notes`, `applications`), harden project-media (the last unscoped media router) onto CASL, flip proposal-media off the last legacy straggler, and lock agent-first precedence on the shareable seam.

**Architecture:** Every entity owned by a parent declares an engine-agnostic `parent: { spec, fk }` on its `EntityServerSpec`. Both the legacy engine (`resolveEffectiveScope` → `bridgeToParent`) and the CASL engine (`resolveActorScope` → `verbOnly AND fk IN (SELECT parent.pk WHERE resolveActorScope(parent))`) read that field, so *declaring* `parent` is safe regardless of which resolver a procedure currently calls. Tier-2 children stay on the legacy factory in Phase 6 (their CASL flip = the shared-factory flip = Phase 7); declaring `parent` now is what makes that Phase-7 flip non-leaky. Project-media must bridge via CASL immediately (its parent `projects` has no legacy `visibility` fn, so a legacy bridge would throw).

**Tech Stack:** TypeScript, tRPC v11, Drizzle ORM (Postgres/Neon), CASL, Zod.

**Spec:** `docs/superpowers/specs/2026-08-20-casl-phase-6-owned-children-design.md`

## Global Constraints

- **No test runner.** Verification is `pnpm tsc && pnpm lint` (green) + uncommitted `scripts/tmp-*.ts` probe scripts + `git grep` gates. NEVER `pnpm build`. NEVER add a `.test.ts`.
- **Every probe script** starts with `import './lib/load-env'` as its first line and lives at `scripts/tmp-*.ts` (uncommitted, deleted at end of the phase).
- **Commit only on explicit user approval.** Stage by explicit path — never `git add -A`, never stage `CLAUDE.local.md`.
- **Stay in `.worktrees/issue-285`** on branch `refactor/285-refactor-permissions-casl-scope-compiler`. No PR, no push. The whole permissions overhaul merges to `main` once, at Phase 9.
- **Two engines coexist** until Phase 8. Legacy resolver = `resolveVisibilityScope` / `resolveEffectiveScope` / `isVisible`. CASL resolver = `resolveTrpcActorScope` / `resolveActorScope` / `canAccess`. They share the identical `(spec, {userId, ability})` signature — swaps are semantic, not typed, so the compiler cannot catch a wrong-engine regression. Verify by probe.
- **`resolveActorScope` compiles `read` only** (child branch hardcodes `read`). Phase 6 touches reads only; action-aware mutation scope is Grill C / Phase 7.
- Commit messages (when approved) end with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: Tier-2 bridge — `applications` → `Meeting`

Declare `parent` on the applications spec, delete `applicationVisibility`, and equivalence-gate the swap. Resolver stays legacy (both `createCrudRouter` in `applications.router/crud.router.ts` and the per-entity `applicationProcedure` in `applications.router/procedures.ts` call `resolveVisibilityScope` → `resolveEffectiveScope`, which now takes the `bridgeToParent` branch off the parent's still-live `meetingVisibility`).

**Files:**
- Modify: `src/shared/entities/applications/lib/server-spec.ts`
- Delete: `src/shared/entities/applications/lib/visibility.ts`
- Probe: `scripts/tmp-phase6-applications-equiv.ts` (uncommitted)

**Interfaces:**
- Consumes: `meetingServerSpec` (`@/shared/entities/meetings/lib/server-spec`), `applications` table (`@/shared/db/schema`), `EntityServerSpec.parent` field (`{ spec: EntityServerSpec, fk: PgColumn }`).
- Produces: `applicationServerSpec` now carries `parent: { spec: meetingServerSpec, fk: applications.meetingId }` and NO `visibility`. Consumed unchanged by `applicationProcedure`, `crud.router.ts`, `draft.router.ts`, `business.router.ts`.

- [ ] **Step 1: Write the equivalence probe (the failing check)**

Create `scripts/tmp-phase6-applications-equiv.ts`:

```ts
import './lib/load-env'

import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { applications, meetings } from '@/shared/db/schema'
import { resolveEffectiveScope } from '@/shared/dal/server/lib/scope'
import { applicationServerSpec } from '@/shared/entities/applications/lib/server-spec'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import { userParticipatesInMeeting } from '@/shared/entities/meetings/dal/server/participants'

const AGENT_ID = '00000000-0000-0000-0000-0000000000a1'
const ability = defineAbilitiesFor({ id: AGENT_ID, role: 'agent' })

// ACTUAL: the post-parent legacy resolution (own=none for a child, so bridge only).
const actual = resolveEffectiveScope(applicationServerSpec, { userId: AGENT_ID, ability })

// EXPECTED: the exact set the deleted `applicationVisibility` denoted, expressed
// as the parent bridge (meeting participation on the application's meeting).
const expected = inArray(
  applications.meetingId,
  db.select({ id: meetings.id }).from(meetings)
    .where(userParticipatesInMeeting(AGENT_ID, meetings.id)),
)

const toStr = (frag: any) => db.select({ id: applications.id }).from(applications)
  .where(and(eq(applications.id, sql`'x'`), frag)).toSQL()

console.log('ACTUAL  :', toStr(actual).sql)
console.log('EXPECTED:', toStr(expected).sql)
console.log('MATCH   :', toStr(actual).sql === toStr(expected).sql)
```

- [ ] **Step 2: Run the probe against the PRE-change spec to see current shape**

Run: `pnpm tsx scripts/tmp-phase6-applications-equiv.ts`
Expected: prints an `ACTUAL` that is the OLD own-fragment (`userParticipatesInMeeting(userId, applications.meetingId)`, correlated on `applications`) and `MATCH: false` — the shapes differ because the spec still declares `visibility`, not `parent`. This confirms the probe distinguishes the two forms.

- [ ] **Step 3: Declare `parent`, drop `visibility` on the spec**

In `src/shared/entities/applications/lib/server-spec.ts`:
- Remove the import line `import { applicationVisibility } from '@/shared/entities/applications/lib/visibility'`.
- Add `import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'`.
- In `applicationServerSpec`, replace the line `visibility: applicationVisibility,` with:

```ts
  parent: { spec: meetingServerSpec, fk: applications.meetingId },
```

(`applications` is already imported at the top of the file.)

- [ ] **Step 4: Delete the visibility fn**

```bash
git rm src/shared/entities/applications/lib/visibility.ts
```

- [ ] **Step 5: Re-run the probe — expect equivalence**

Run: `pnpm tsx scripts/tmp-phase6-applications-equiv.ts`
Expected: `MATCH: true`. Now `resolveEffectiveScope` takes the `bridgeToParent` branch, emitting `applications.meeting_id IN (SELECT meetings.id WHERE <meeting participation>)` — set-equal to the deleted `applicationVisibility`. Clean equivalence, no role changes.

- [ ] **Step 6: tsc + lint + grep gate**

Run: `pnpm tsc && pnpm lint`
Expected: green.
Run: `git grep -n "applicationVisibility" -- src`
Expected: zero hits.

- [ ] **Step 7: Commit (ONLY after user approval)**

```bash
git add -- src/shared/entities/applications/lib/server-spec.ts
git rm --cached src/shared/entities/applications/lib/visibility.ts 2>/dev/null || true
git commit -m "refactor(permissions): bridge applications to Meeting parent (Phase 6)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

(Do NOT stage `scripts/tmp-*.ts`.)

---

### Task 2: Tier-2 bridge — `customer-notes` → `Customer` + dispatcher CASL grants

Same parent-declaration move for customer-notes, PLUS the required dispatcher CASL grants. Unlike applications this is an **intentional dispatcher widening** (the parent `customerVisibility` has a leads-pool branch the deleted `customerNoteVisibility` deliberately dropped) — user-ratified 2026-08-20. The dispatcher grant is not optional: without it, the Phase-7 CASL factory flip would compute `verbOnly(dispatcher,'read','CustomerNote')` → `sql\`false\`` → deny-all, silently revoking the feature.

**Files:**
- Modify: `src/shared/entities/customer-notes/lib/server-spec.ts`
- Modify: `src/shared/domains/permissions/abilities.ts` (dispatcher case)
- Delete: `src/shared/entities/customer-notes/lib/visibility.ts`
- Probe: `scripts/tmp-phase6-notes-equiv.ts` (uncommitted)

**Interfaces:**
- Consumes: `customerServerSpec` (already imported in the notes spec), `customerNotes` table (already imported), `EntityServerSpec.parent`.
- Produces: `customerNoteServerSpec` carries `parent: { spec: customerServerSpec, fk: customerNotes.customerId }` and NO `visibility`. The create/update/delete hooks are UNTOUCHED (they reference `customerServerSpec` / `customerNoteCrud` / `assertNoteAuthorOrAdmin`, never `customerNoteVisibility`). Dispatcher ability gains `can('read','CustomerNote')` + `can('create','CustomerNote')`.

- [ ] **Step 1: Write the equivalence + widening probe**

Create `scripts/tmp-phase6-notes-equiv.ts`:

```ts
import './lib/load-env'

import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customerNotes, customers } from '@/shared/db/schema'
import { resolveEffectiveScope } from '@/shared/dal/server/lib/scope'
import { customerNoteServerSpec } from '@/shared/entities/customer-notes/lib/server-spec'
import { customerVisibility } from '@/shared/entities/customers/lib/visibility'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'

const AGENT_ID = '00000000-0000-0000-0000-0000000000a1'
const DISPATCH_ID = '00000000-0000-0000-0000-0000000000d1'
const agent = defineAbilitiesFor({ id: AGENT_ID, role: 'agent' })
const dispatcher = defineAbilitiesFor({ id: DISPATCH_ID, role: 'dispatcher' })

const toStr = (frag: any) => db.select({ id: customerNotes.id }).from(customerNotes)
  .where(and(eq(customerNotes.id, sql`1`), frag)).toSQL().sql

// Expected agent bridge = customerId IN (SELECT customers WHERE customerVisibility(agent))
const agentBridge = inArray(
  customerNotes.customerId,
  db.select({ id: customers.id }).from(customers).where(customerVisibility({ userId: AGENT_ID, ability: agent })),
)
const dispatchBridge = inArray(
  customerNotes.customerId,
  db.select({ id: customers.id }).from(customers).where(customerVisibility({ userId: DISPATCH_ID, ability: dispatcher })),
)

console.log('AGENT actual  :', toStr(resolveEffectiveScope(customerNoteServerSpec, { userId: AGENT_ID, ability: agent })))
console.log('AGENT expected:', toStr(agentBridge))
console.log('DISPATCH actual  :', toStr(resolveEffectiveScope(customerNoteServerSpec, { userId: DISPATCH_ID, ability: dispatcher })))
console.log('DISPATCH expected:', toStr(dispatchBridge))
// The dispatcher SQL must contain the derived-leads-pipeline predicate (widening),
// NOT the userCanSeeCustomer participation EXISTS.
console.log('DISPATCH widened (contains pipeline predicate):', toStr(dispatchBridge).includes('pipeline_stage') || toStr(dispatchBridge) !== toStr(agentBridge))
```

- [ ] **Step 2: Run the probe against the PRE-change spec**

Run: `pnpm tsx scripts/tmp-phase6-notes-equiv.ts`
Expected: `AGENT actual` currently emits the OLD own-fragment (`userCanSeeCustomer(userId, customer_notes.customer_id)`), which differs from `AGENT expected` (the bridge form). Confirms the probe sees the pre-change shape.

- [ ] **Step 3: Declare `parent`, drop `visibility` on the notes spec**

In `src/shared/entities/customer-notes/lib/server-spec.ts`:
- Remove `import { customerNoteVisibility } from './visibility'`.
- In `customerNoteServerSpec`, replace `visibility: customerNoteVisibility,` with:

```ts
  parent: { spec: customerServerSpec, fk: customerNotes.customerId },
```

(`customerServerSpec` and `customerNotes` are already imported; the hooks block is unchanged.)

- [ ] **Step 4: Delete the notes visibility fn**

```bash
git rm src/shared/entities/customer-notes/lib/visibility.ts
```

- [ ] **Step 5: Add dispatcher CASL grants**

In `src/shared/domains/permissions/abilities.ts`, inside `case 'dispatcher':` (after the `can('read', 'CustomerLeadAttribution')` line, mirroring the agent block's note grants), add:

```ts
      // Notes: dispatchers work the leads pool and author/read notes on those
      // leads, exactly like an agent (user-ratified 2026-08-20). Row scope flows
      // from the Customer parent bridge (dispatcher's leads-pool Customer scope).
      // update/delete stay author-or-admin on the imperative hook until Grill C
      // moves "own note" to a CASL {authorId} condition — no update/delete here.
      can('read', 'CustomerNote')
      can('create', 'CustomerNote')
```

- [ ] **Step 6: Re-run the probe — expect agent equivalence + dispatcher widening**

Run: `pnpm tsx scripts/tmp-phase6-notes-equiv.ts`
Expected: `AGENT actual === AGENT expected` (both the bridge form, participation-only — identical). `DISPATCH actual === DISPATCH expected`, and `DISPATCH widened: true` — the dispatcher SQL is the leads-pipeline predicate, NOT participation. This is the ratified widening. Confirm a non-leads customer's notes stay excluded (the dispatcher bridge is bounded to the derived leads pool).

- [ ] **Step 7: tsc + lint + grep gate**

Run: `pnpm tsc && pnpm lint`
Expected: green.
Run: `git grep -n "customerNoteVisibility" -- src`
Expected: zero hits.

- [ ] **Step 8: Commit (ONLY after user approval)**

```bash
git add -- src/shared/entities/customer-notes/lib/server-spec.ts src/shared/domains/permissions/abilities.ts
git rm --cached src/shared/entities/customer-notes/lib/visibility.ts 2>/dev/null || true
git commit -m "refactor(permissions): bridge customer-notes to Customer parent + dispatcher note grants (Phase 6)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Scoped media DAL ops + service methods (`moveMediaPhase`, `setHeroImage`)

De-inline the two raw-`db` project-media mutations into `media-ops.ts` as scoped, table-parameterized ops matching the existing `listMediaByOwner`/`reorderMedia` idiom (each composes `requireResolvedScope(ctx.scope)`, so out-of-scope ids match nothing). Add thin `mediaService` methods that ring them, so the router keeps zero DAL/`db` imports for these.

**Files:**
- Modify: `src/shared/entities/media-files/dal/server/media-ops.ts`
- Modify: `src/shared/services/media/media.service.ts`
- Probe: `scripts/tmp-phase6-media-ops.ts` (uncommitted)

**Interfaces:**
- Consumes: `ScopedContext`, `requireResolvedScope`, `dalDbOperation`, `ThrowableDalError` (`@/shared/dal/server/types`), `mediaPhases` (`@/shared/constants/enums/media`), Drizzle `and`/`eq`/`inArray`.
- Produces:
  - `moveMediaPhase(table: PhasedMediaTable, ctx: ScopedContext, ids: number[], phase: MediaPhase): Promise<DalReturn<void>>`
  - `setHeroImage(table: HeroMediaTable, ownerColumn: PgColumn, ctx: ScopedContext, id: number, isHero: boolean): Promise<DalReturn<void>>`
  - `mediaService.movePhase(store, ctx, ids, phase): Promise<DalReturn<void>>`
  - `mediaService.setHero(store, ctx, id, isHero): Promise<DalReturn<void>>`
  - `MediaPhase = (typeof mediaPhases)[number]`

- [ ] **Step 1: Add the two scoped ops to `media-ops.ts`**

Extend the imports at the top of `src/shared/entities/media-files/dal/server/media-ops.ts`:

```ts
import { and, asc, eq, inArray } from 'drizzle-orm'

import { dalDbOperation, requireResolvedScope } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { mediaPhases } from '@/shared/constants/enums/media'
```

(`asc`/`eq` are already imported; add `inArray`. Add the `ThrowableDalError` and `mediaPhases` imports.)

Add below `reorderMedia`:

```ts
export type MediaPhase = (typeof mediaPhases)[number]

/** Media table that carries a `phase` column (project media). */
interface PhasedMediaTable extends PgTable {
  id: PgColumn
  phase: PgColumn
}

/** Media table that carries an `isHeroImage` column (project media). */
interface HeroMediaTable extends PgTable {
  id: PgColumn
  isHeroImage: PgColumn
}

/**
 * Set `phase` on the given rows in ONE scoped UPDATE. `id IN (ids) AND ctx.scope`
 * means out-of-scope ids simply match nothing — no per-row authz probe, no throw.
 * Empty input is a no-op. Replaces the router's old per-id unscoped loop.
 */
export function moveMediaPhase(
  table: PhasedMediaTable,
  ctx: ScopedContext,
  ids: number[],
  phase: MediaPhase,
): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    if (ids.length === 0) {
      return
    }
    await db.update(table).set({ phase }).where(and(inArray(table.id, ids), requireResolvedScope(ctx.scope)))
  })
}

/**
 * Toggle a row's `isHeroImage`. A scoped `getById` authorizes the caller and
 * yields the owner id; when promoting to hero, the project-wide unset is bounded
 * to that authorized owner (precursor-proven visible), then the target row is set
 * behind `id = ? AND ctx.scope`. An invisible/missing row is a not-found — no
 * existence leak, no partial unset.
 */
export function setHeroImage(
  table: HeroMediaTable,
  ownerColumn: PgColumn,
  ctx: ScopedContext,
  id: number,
  isHero: boolean,
): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select({ owner: ownerColumn })
      .from(table)
      .where(and(eq(table.id, id), requireResolvedScope(ctx.scope)))
      .limit(1)
    if (!row) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    await db.transaction(async (tx) => {
      if (isHero) {
        await tx.update(table).set({ isHeroImage: false }).where(eq(ownerColumn, row.owner))
      }
      await tx.update(table).set({ isHeroImage: isHero }).where(and(eq(table.id, id), requireResolvedScope(ctx.scope)))
    })
  })
}
```

- [ ] **Step 2: Add the `mediaService` ring methods**

In `src/shared/services/media/media.service.ts`:
- Extend the media-ops import:

```ts
import { listMediaByOwner, moveMediaPhase, reorderMedia, setHeroImage } from '@/shared/entities/media-files/dal/server/media-ops'
import type { MediaPhase } from '@/shared/entities/media-files/dal/server/media-ops'
```

- Add these methods to the `mediaService` object (next to `reorder`):

```ts
  /** Scoped phase move — out-of-scope ids match nothing (no probe). */
  async movePhase(store: MediaStore, ctx: ScopedContext, ids: number[], phase: MediaPhase): Promise<DalReturn<void>> {
    return moveMediaPhase(store.table, ctx, ids, phase)
  },

  /** Scoped hero toggle — getById authorizes; project-wide unset bounded to the owner. */
  async setHero(store: MediaStore, ctx: ScopedContext, id: number, isHero: boolean): Promise<DalReturn<void>> {
    return setHeroImage(store.table, store.ownerColumn, ctx, id, isHero)
  },
```

- [ ] **Step 3: Write a scoped-behavior probe**

Create `scripts/tmp-phase6-media-ops.ts`:

```ts
import './lib/load-env'

import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { mediaFiles } from '@/shared/db/schema'
import { requireResolvedScope } from '@/shared/dal/server/lib/helpers'
import { resolveActorScope } from '@/shared/dal/server/lib/resolve-actor-scope'
import { mediaFileServerSpec } from '@/shared/entities/media-files/lib/server-spec'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import { userActor } from '@/shared/domains/permissions/scope/actor'

const AGENT_ID = '00000000-0000-0000-0000-0000000000a1'
const agent = userActor(AGENT_ID, defineAbilitiesFor({ id: AGENT_ID, role: 'agent' }))
const scope = resolveActorScope(mediaFileServerSpec, agent)

// The scoped movePhase UPDATE the DAL will emit for an agent.
const q = db.update(mediaFiles).set({ phase: 'uncategorized' })
  .where(and(inArray(mediaFiles.id, [1, 2]), requireResolvedScope(scope)))
console.log('AGENT scoped movePhase SQL:', q.toSQL().sql)
console.log('has project bridge:', q.toSQL().sql.includes('project_id'))
```

- [ ] **Step 4: Run tsc + lint + probe**

Run: `pnpm tsc && pnpm lint`
Expected: green.
Run: `pnpm tsx scripts/tmp-phase6-media-ops.ts`
Expected: the UPDATE's WHERE contains `project_id IN (SELECT ... )` — the child bridge is present, so an agent's phase-move can only touch media on projects they can see.

- [ ] **Step 5: Commit (ONLY after user approval)**

```bash
git add -- src/shared/entities/media-files/dal/server/media-ops.ts src/shared/services/media/media.service.ts
git commit -m "refactor(media): add scoped moveMediaPhase + setHeroImage DAL ops (Phase 6)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Project-media router hardening — `projectMediaProcedure` + de-inline + `canAccess`

The security core of Phase 6. Add a CASL child-scoped procedure, swap every `agentProcedure` in the project media router to it, route `movePhase`/`toggleHero` through the Task-3 service methods (deleting all raw `db` mutations), and gate the raw-read precursors with `canAccess`. After this the router has **zero** raw-`db` mutations and zero unscoped IDORs; only `listImportableProposalMedia`'s cross-entity read query survives (gated), its *shape* deferred to Phase 7.

**Files:**
- Modify: `src/trpc/routers/projects.router/procedures.ts`
- Modify: `src/trpc/routers/projects.router/media.router.ts`
- Probe: `scripts/tmp-phase6-project-media-scope.ts` (uncommitted)

**Interfaces:**
- Consumes: `mediaFileServerSpec`, `projectServerSpec`, `resolveTrpcActorScope`, `canAccess` (`@/shared/dal/server/lib/resolve-actor-scope`), `mediaService.movePhase`/`setHero` (Task 3), `ctx.actor` (present on every `agentProcedure` via `protectedProcedure`).
- Produces: `projectMediaProcedure` (agent-scoped to the media child bridge).

- [ ] **Step 1: Add `projectMediaProcedure`**

In `src/trpc/routers/projects.router/procedures.ts`, add the import and the procedure beside `projectProcedure`:

```ts
import { mediaFileServerSpec } from '@/shared/entities/media-files/lib/server-spec'
// ...existing projectServerSpec + resolveTrpcActorScope imports...

/**
 * Agent-scoped to the project-media CHILD entity: `ctx.scope` is the parent
 * bridge `projectId IN (SELECT projects.id WHERE <CASL project read scope>)`
 * (null for omni). CASL, NOT legacy — `projectServerSpec` has no legacy
 * `visibility` fn, so a legacy bridge would throw. Dispatchers have no
 * `read Project` grant → verbOnly denies → they see zero project media.
 */
export const projectMediaProcedure = agentProcedure.use(async ({ ctx, next }) =>
  next({ ctx: { ...ctx, scope: resolveTrpcActorScope(mediaFileServerSpec, { userId: ctx.session.user.id, ability: ctx.ability }) } }))
```

- [ ] **Step 2: Rewire `media.router.ts` imports**

In `src/trpc/routers/projects.router/media.router.ts`:
- Add: `import { canAccess } from '@/shared/dal/server/lib/resolve-actor-scope'`
- Add: `import { mediaFileServerSpec } from '@/shared/entities/media-files/lib/server-spec'`
- Add: `import { projectServerSpec } from '@/shared/entities/projects/lib/server-spec'`
- Add: `import { projectMediaProcedure } from './procedures'`
- Change the schema import to drop the now-unused `mediaFiles` table (movePhase/toggleHero no longer touch it):
  `import { insertMediaFilesSchema, meetings, proposalMediaFiles, proposals } from '@/shared/db/schema'`
- Change the init import to drop `agentProcedure` (no longer used after the swap):
  `import { createTRPCRouter } from '../../init'`
- Delete the top-of-file `// TODO(1f): inline db ...` comment.

(`db`, `and`, `eq`, `inArray`, `like`, `TRPCError` all stay — `listImportableProposalMedia` and `importFromProposal` still use them.)

- [ ] **Step 3: Swap procedures + de-inline `movePhase`**

Replace every `agentProcedure` in the router with `projectMediaProcedure`. For `movePhase`, replace the raw transaction body:

```ts
  movePhase: projectMediaProcedure
    .input(z.object({
      ids: z.array(z.number()).min(1),
      phase: z.enum(mediaPhases),
    }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await mediaService.movePhase(projectMediaStore, ctx, input.ids, input.phase))
    }),
```

- [ ] **Step 4: De-inline `toggleHero`**

```ts
  toggleHero: projectMediaProcedure
    .input(z.object({
      id: z.number(),
      isHeroImage: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await mediaService.setHero(projectMediaStore, ctx, input.id, input.isHeroImage))
    }),
```

- [ ] **Step 5: Gate `getUploadUrl` (close the live IDOR)**

Add `ctx` to the handler and a project probe before building the upload target:

```ts
  getUploadUrl: projectMediaProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      phase: z.enum(mediaPhases),
      filename: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!(await canAccess(projectServerSpec, ctx.actor, input.projectId))) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }
      const { uploadUrl, pathKey, bucket } = await mediaService.buildUploadTarget(projectMediaStore, {
        ownerId: input.projectId,
        filename: input.filename,
        mimeType: input.mimeType,
        extra: { phase: input.phase },
      })
      const publicUrl = `${R2_PUBLIC_DOMAINS[bucket] ?? ''}/${pathKey}`
      return { uploadUrl, pathKey, publicUrl }
    }),
```

- [ ] **Step 6: Gate `retryOptimization` on the child (thread `ctx`)**

```ts
  retryOptimization: projectMediaProcedure
    .input(z.object({ mediaFileId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!(await canAccess(mediaFileServerSpec, ctx.actor, input.mediaFileId))) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Media file not found' })
      }
      await mediaService.retryOptimization(projectMediaStore, input.mediaFileId)
      return { success: true }
    }),
```

- [ ] **Step 7: Gate `listImportableProposalMedia` + `importFromProposal` on the destination project**

For `listImportableProposalMedia`, swap to `projectMediaProcedure`, add `ctx`, and gate before the query:

```ts
  listImportableProposalMedia: projectMediaProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!(await canAccess(projectServerSpec, ctx.actor, input.projectId))) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }
      const rows = await db
        .select({ /* ...unchanged... */ })
        // ...unchanged cross-entity read (shape deferred to Phase 7)...
    }),
```

For `importFromProposal`, add the same destination-project gate at the top of the handler (its source authz — the `meetings.projectId` join — stays):

```ts
  importFromProposal: projectMediaProcedure
    .input(z.object({ projectId: z.string().uuid(), proposalMediaFileIds: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!(await canAccess(projectServerSpec, ctx.actor, input.projectId))) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }
      // ...unchanged source-select + copy loop...
    }),
```

(`create`, `delete`, `reorder`, `rename`, `bulkDelete` already thread `ctx` into `mediaService` — they only need `agentProcedure` → `projectMediaProcedure` so `ctx.scope` is the child bridge instead of `null`.)

- [ ] **Step 8: Write the role-scope probe**

Create `scripts/tmp-phase6-project-media-scope.ts`:

```ts
import './lib/load-env'

import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { mediaFiles } from '@/shared/db/schema'
import { requireResolvedScope } from '@/shared/dal/server/lib/helpers'
import { resolveActorScope } from '@/shared/dal/server/lib/resolve-actor-scope'
import { mediaFileServerSpec } from '@/shared/entities/media-files/lib/server-spec'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import { userActor } from '@/shared/domains/permissions/scope/actor'

function scopeSql(role: 'agent' | 'dispatcher' | 'super-admin') {
  const id = `00000000-0000-0000-0000-0000000000${role[0]}1`
  const actor = userActor(id, defineAbilitiesFor({ id, role }))
  const scope = resolveActorScope(mediaFileServerSpec, actor)
  if (scope === null) {
    return 'NULL (allow-all)'
  }
  return db.select({ id: mediaFiles.id }).from(mediaFiles).where(requireResolvedScope(scope)).toSQL().sql
}

console.log('AGENT      :', scopeSql('agent'))       // project bridge (participation OR ownerId)
console.log('DISPATCHER :', scopeSql('dispatcher'))  // must be a deny (false) — no read Project grant
console.log('SUPERADMIN :', scopeSql('super-admin')) // NULL (allow-all)
```

- [ ] **Step 9: Run tsc + lint + probe**

Run: `pnpm tsc && pnpm lint`
Expected: green.
Run: `pnpm tsx scripts/tmp-phase6-project-media-scope.ts`
Expected: AGENT → a `project_id IN (SELECT ...)` bridge; DISPATCHER → a `false` predicate (deny-all, no project book); SUPERADMIN → `NULL (allow-all)`.

- [ ] **Step 10: Grep gate — no raw mutations, no legacy probes left**

Run: `git grep -n "agentProcedure" -- src/trpc/routers/projects.router/media.router.ts`
Expected: zero hits.
Run: `git grep -nE "db\.(update|insert|delete|transaction)" -- src/trpc/routers/projects.router/media.router.ts`
Expected: zero hits (all mutations now ring `mediaService`; only `db.select` reads remain).
Run: `git grep -n "isVisible\|resolveVisibilityScope" -- src/trpc/routers/projects.router/media.router.ts`
Expected: zero hits.

- [ ] **Step 11: Commit (ONLY after user approval)**

```bash
git add -- src/trpc/routers/projects.router/procedures.ts src/trpc/routers/projects.router/media.router.ts
git commit -m "refactor(permissions): scope project-media via CASL projectMediaProcedure + close IDORs (Phase 6)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Proposal-media — CASL flip + `isVisible` → `canAccess`

Flip the lone legacy straggler. `proposalMediaProcedure` moves from `resolveVisibilityScope` to `resolveTrpcActorScope`, and the two legacy `isVisible` probes in the proposal media router become `canAccess`. Safe: Phase 1 proved Proposal CASL ≡ legacy `proposalVisibility`; the child bridge recurses to CASL `read Proposal` (`$participatesViaMeeting(meetingId)`). After this, **no** legacy `resolveVisibilityScope`/`isVisible` remains in either media router.

**Files:**
- Modify: `src/trpc/routers/proposals.router/procedures.ts`
- Modify: `src/trpc/routers/proposals.router/media.router.ts`
- Probe: `scripts/tmp-phase6-proposal-media-equiv.ts` (uncommitted)

**Interfaces:**
- Consumes: `resolveTrpcActorScope` (already imported in `proposals.router/procedures.ts`), `canAccess`, `ctx.actor`.
- Produces: `proposalMediaProcedure` now CASL-scoped. The `assertProposalVisible` / retryOptimization probes use `canAccess`.

- [ ] **Step 1: Equivalence probe (legacy vs CASL scope for proposal media)**

Create `scripts/tmp-phase6-proposal-media-equiv.ts`:

```ts
import './lib/load-env'

import { db } from '@/shared/db'
import { proposalMediaFiles } from '@/shared/db/schema'
import { requireResolvedScope } from '@/shared/dal/server/lib/helpers'
import { resolveEffectiveScope } from '@/shared/dal/server/lib/scope'
import { resolveActorScope } from '@/shared/dal/server/lib/resolve-actor-scope'
import { proposalMediaServerSpec } from '@/shared/entities/proposal-media-files/lib/server-spec'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import { userActor } from '@/shared/domains/permissions/scope/actor'

const AGENT_ID = '00000000-0000-0000-0000-0000000000a1'
const ability = defineAbilitiesFor({ id: AGENT_ID, role: 'agent' })

const legacy = resolveEffectiveScope(proposalMediaServerSpec, { userId: AGENT_ID, ability })
const casl = resolveActorScope(proposalMediaServerSpec, userActor(AGENT_ID, ability))

const toStr = (frag: any) => db.select({ id: proposalMediaFiles.id }).from(proposalMediaFiles)
  .where(requireResolvedScope(frag)).toSQL().sql

console.log('LEGACY:', toStr(legacy))
console.log('CASL  :', toStr(casl))
console.log('EQUIVALENT:', toStr(legacy) === toStr(casl))
```

- [ ] **Step 2: Run the probe (pre-change baseline)**

Run: `pnpm tsx scripts/tmp-phase6-proposal-media-equiv.ts`
Expected: both print a `proposal_id IN (SELECT proposals.id WHERE <meeting participation>)` bridge. `EQUIVALENT: true` (Phase-1 CASL≡legacy for Proposal, folded through the identical child bridge). If it prints `false`, STOP and reconcile before flipping — do not proceed.

- [ ] **Step 3: Flip `proposalMediaProcedure` to CASL**

In `src/trpc/routers/proposals.router/procedures.ts`, change the `proposalMediaProcedure` body from:

```ts
  const scope = resolveVisibilityScope(proposalMediaServerSpec, { userId: ctx.session.user.id, ability: ctx.ability })
```

to:

```ts
  const scope = resolveTrpcActorScope(proposalMediaServerSpec, { userId: ctx.session.user.id, ability: ctx.ability })
```

If `resolveVisibilityScope` is now unused in this file, remove its import (`import { resolveVisibilityScope } from '../../lib/middleware/scope-middleware'`). Update the doc-comment line noting the media child "still resolves via the legacy `resolveVisibilityScope`" to say it is now CASL-compiled.

- [ ] **Step 4: Swap the two `isVisible` probes to `canAccess`**

In `src/trpc/routers/proposals.router/media.router.ts`:
- Change the import `import { isVisible } from '@/shared/dal/server/lib/scope'` to `import { canAccess } from '@/shared/dal/server/lib/resolve-actor-scope'`.
- In `assertProposalVisible`, change the guard to:

```ts
async function assertProposalVisible(ctx: ScopedContext, proposalId: string) {
  if (!(await canAccess(proposalServerSpec, ctx.actor, proposalId))) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
  }
}
```

- In `retryOptimization`, change the probe to:

```ts
      if (!(await canAccess(proposalMediaServerSpec, ctx.actor, input.id))) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal media file not found' })
      }
```

- [ ] **Step 5: tsc + lint + grep gate**

Run: `pnpm tsc && pnpm lint`
Expected: green.
Run: `git grep -n "isVisible\|resolveVisibilityScope" -- src/trpc/routers/proposals.router/media.router.ts src/trpc/routers/proposals.router/procedures.ts`
Expected: zero hits.

- [ ] **Step 6: Commit (ONLY after user approval)**

```bash
git add -- src/trpc/routers/proposals.router/procedures.ts src/trpc/routers/proposals.router/media.router.ts
git commit -m "refactor(permissions): flip proposal-media to CASL scope + canAccess probes (Phase 6)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Shareable seam — agent-first precedence + actor-kind guard

Reorder `shareableMiddleware` so an authenticated session wins over a URL token. This makes both invariants hold — *homeowner-always-token* (no session ⇒ token) AND *agent-always-user* (session ⇒ never token) — and fixes the latent bug where a logged-in agent opening a share link is treated as a homeowner (`ability=null`), stripping agent capabilities at `contracts.router.ts:191`. This is a *tightening*: a token no longer sideways-grants an authenticated agent a row outside their CASL scope. The tokenActor *authorization* redesign (session-path `resolveEffectiveScope` remnant, `ability==null` field-gates) is Grill C — **not** touched here; Phase 6 changes precedence only.

**Files:**
- Modify: `src/trpc/lib/middleware/shareable-middleware.ts`
- Probe: none (behavioral; verified by grep + reasoning below)

**Interfaces:**
- Consumes: `tokenActor`, `userActor`, `resolveEffectiveScope`, `defineAbilitiesFor` (all already imported).
- Produces: no signature change — `shareableMiddleware(spec)` still returns the same middleware; only branch order + a guard change.

- [ ] **Step 1: Reorder to session-first**

In `src/trpc/lib/middleware/shareable-middleware.ts`, replace the middleware body (the `createMiddleware(async ({ ctx, next, getRawInput }) => { ... })` block) so the session branch is evaluated first:

```ts
  return createMiddleware(async ({ ctx, next, getRawInput }) => {
    // ── Session path (AGENT-FIRST) ───────────────────────────────────────
    // An authenticated session ALWAYS wins: a token in the URL is ignored for
    // a logged-in user. Guarantees agent-always-user (never ability=null for an
    // authenticated agent) alongside homeowner-always-token below. see spec §2.4
    if (ctx.session) {
      const ability = defineAbilitiesFor({
        id: ctx.session.user.id,
        role: ctx.session.user.role,
      })
      const isOmni = ability.can('manage', 'all')
      const scope = isOmni ? null : resolveEffectiveScope(spec, { userId: ctx.session.user.id, ability })
      const actor = userActor(ctx.session.user.id, ability)
      if (actor.kind !== 'user') {
        throw new Error('[shareable-middleware] session branch must yield a user actor')
      }
      return next({ ctx: { ...ctx, session: ctx.session, ability, scope, actor } })
    }

    // ── Token path (homeowner) ───────────────────────────────────────────
    // No session — a valid token IS the authorization; the honest actor is a
    // tokenActor whose reach is exactly the token-matched row(s).
    const rawInput = await getRawInput() as Record<string, unknown> | undefined
    const token = rawInput?.token as string | undefined
    if (token && tokenColumn) {
      const scope = eq(tokenColumn, token)
      const actor = tokenActor(scope, spec.caslSubject)
      if (actor.kind !== 'token') {
        throw new Error('[shareable-middleware] token branch must yield a token actor')
      }
      return next({ ctx: { ...ctx, session: ctx.session, ability: null, scope, actor } })
    }

    // ── Neither ──────────────────────────────────────────────────────────
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'A valid token or authenticated session is required',
    })
  })
```

- [ ] **Step 2: Regression grep — no authenticated "preview via token" flow**

Run: `git grep -nE "\.(useQuery|useMutation|mutate|fetch)\(" -- src | grep -i "token" | head -40`
Then inspect callers of the shareable endpoints (proposal share/contract views) for any client flow that passes a token *while the user is authenticated* and depends on being treated as a homeowner. None is expected (tokens are homeowner credentials surfaced on public/unauthenticated share pages). If one exists, STOP and report it — do not merge the reorder silently.

- [ ] **Step 3: tsc + lint**

Run: `pnpm tsc && pnpm lint`
Expected: green.

- [ ] **Step 4: Commit (ONLY after user approval)**

```bash
git add -- src/trpc/lib/middleware/shareable-middleware.ts
git commit -m "refactor(permissions): agent-first precedence on shareable seam (Phase 6)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Phase 6 exit gate — full sweep + role E2E + cleanup

Consolidated verification that the phase's cross-cutting invariants hold, then remove the throwaway probes.

**Files:**
- Delete: all `scripts/tmp-phase6-*.ts` (uncommitted throwaways)

- [ ] **Step 1: Full `git grep` gate sweep**

Run each; all must return zero hits:

```bash
git grep -n "customerNoteVisibility" -- src
git grep -n "applicationVisibility" -- src
git grep -n "isVisible\|resolveVisibilityScope" -- src/trpc/routers/projects.router/media.router.ts src/trpc/routers/proposals.router/media.router.ts
git grep -nE "db\.(update|insert|delete|transaction)" -- src/trpc/routers/projects.router/media.router.ts
git grep -n "agentProcedure" -- src/trpc/routers/projects.router/media.router.ts
```

- [ ] **Step 2: Confirm the `parent` declarations landed**

Run: `git grep -n "parent:" -- src/shared/entities/applications/lib/server-spec.ts src/shared/entities/customer-notes/lib/server-spec.ts`
Expected: one `parent: { spec: meetingServerSpec, fk: applications.meetingId }` and one `parent: { spec: customerServerSpec, fk: customerNotes.customerId }`.

- [ ] **Step 3: Final tsc + lint**

Run: `pnpm tsc && pnpm lint`
Expected: green.

- [ ] **Step 4: Manual role E2E (dev server; `pnpm dev:mobile` if media hooks/optimize fire)**

Walk each role through the touched surfaces and confirm no false-ALLOW and no over-deny:
- **Agent**: sees/edits notes + applications on their own meetings/customers; sees/manages project media + proposal media only on projects/proposals they participate in; `getUploadUrl`/`retryOptimization`/`importFromProposal` on a non-participating project → NOT_FOUND.
- **Dispatcher**: reads/creates notes on leads-pool customers (the ratified widening); sees ZERO project media (no `read Project` grant); non-leads customer's notes hidden.
- **Super-admin**: sees everything (allow-all).
- **Homeowner (token, no session)**: reaches token-gated proposal/contract views; a logged-in agent opening the same share link is treated agent-first (full ability, token ignored) — verify the `contracts.router.ts:191` envelope path no longer 403s for an authenticated agent.

- [ ] **Step 5: Remove throwaway probes**

```bash
rm -f scripts/tmp-phase6-*.ts
```

Confirm none were staged: `git status --porcelain scripts/ | grep tmp-phase6` → no output.

- [ ] **Step 6: Report Phase 6 complete**

Summarize to the user: all acceptance criteria met (parent declared on both Tier-2 children, `*Visibility` fns deleted, dispatcher note grants added, project-media fully CASL-scoped with de-inlined `movePhase`/`toggleHero` and gated precursors, proposal-media on CASL, shareable seam agent-first). Note that the Tier-2 factory CASL flip, `listImportableProposalMedia` read-shape, tokenActor authorization redesign, and action-threading remain deferred to Phase 7 / Grill C per the spec. Await direction before starting Phase 7.

---

## Self-Review

**1. Spec coverage:**
- Spec §2.1 (Tier-2 bridge, both entities, dispatcher grant, equivalence gates) → Tasks 1 + 2. ✅
- Spec §2.2 (project-media CASL scoping, de-inline to `media-ops.ts`, `canAccess` precursors, `listImportable` gate) → Tasks 3 + 4. ✅
- Spec §2.3 (proposal-media CASL flip + `isVisible`→`canAccess`) → Task 5. ✅
- Spec §2.4 (agent-first precedence + actor-kind guard) → Task 6. ✅
- Spec §3 deferrals → carried as explicit non-goals in Task 7 Step 6 report. ✅
- Spec §4 error/edge cases → encoded in the `media-ops` ops (not-found on invisible row, empty no-op, bounded unset) + `requireResolvedScope`. ✅
- Spec §5 verification (tsc+lint, tmp probes, git grep) → each task's verify steps + Task 7. ✅
- Spec §7 ACs → Task 7 Step 6 checklist. ✅

**2. Placeholder scan:** No "TBD"/"handle errors"/"similar to". `listImportableProposalMedia`'s unchanged read body is shown as `/* ...unchanged... */` deliberately — it is an existing block gaining only a top gate; the surrounding gate code is spelled out in full. All new code (DAL ops, service methods, procedures, probes) is complete.

**3. Type consistency:** `MediaPhase = (typeof mediaPhases)[number]` defined once in `media-ops.ts` (Task 3), imported by `media.service.ts` (Task 3) and matched by the router's `z.enum(mediaPhases)` (Task 4). `moveMediaPhase`/`setHeroImage`/`mediaService.movePhase`/`mediaService.setHero` signatures are identical across the Task-3 Produces block and their Task-4 call sites. `canAccess(spec, actor, id, action='read')` used with `ctx.actor` (present on `agentProcedure` per init.ts) at every call site. `projectMediaProcedure` produced in Task 4 Step 1, consumed in Steps 3–7. No name drift.
