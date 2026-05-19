# Delivery Router Migration Design

> Migrates `proposals.router/delivery.router.ts` to the entity toolkit pattern,
> relocates proposal-view DAL functions, creates the first meetings entity DAL
> function, and cleans up notification service DB violations where in scope.

## Context

The delivery router is the first service-layer sub-router on the proposals entity
to be migrated to the entity toolkit. It currently uses `agentProcedure`/`baseProcedure`
directly, imports deprecated `getProposal`/`updateProposal` from `shared/dal/server/proposals/api.ts`,
and calls `deriveOutcomeOnProposalSent` which has a direct `db` import violation.

This design establishes the pattern that all remaining service-layer sub-routers
(contracts, etc.) and service migrations will follow.

## Principles Applied

1. **Services never import `db`** — they access data through DAL functions with
   `SYSTEM_CONTEXT` or a passed-in context. Some services are pure formatters/dispatchers
   (emailService), others compose DAL + external APIs (contractService).
2. **Procedures orchestrate** — the tRPC procedure body is the orchestration point.
   It calls services, CRUD DAL (via handlers), cross-entity DAL, and dispatches jobs.
3. **Generic CRUD for simple updates** — `handlers.update(ctx, { id, data })` for any
   field update. No ad-hoc wrapper functions like `updateProposalStatus`.
4. **`ctx: ScopedContext = SYSTEM_CONTEXT`** — DAL functions accept context from their
   caller. `SYSTEM_CONTEXT` is the default (full access). tRPC procedures pass scoped `ctx`,
   services thread through whatever context their caller provides, jobs use `SYSTEM_CONTEXT`.
5. **`@migration` comments for sequencing gaps** — when a dependency entity (meetings)
   hasn't migrated yet, implement the correct pattern with a migration comment
   explaining what changes when the dependency lands.

## Delivery Router: Factory Pattern

### Before (static import)

```ts
// proposals.router/index.ts
import { deliveryRouter } from './delivery.router'

export const proposalsRouter = createEntityRouter(proposalServerSpec, (entity) =>
  createTRPCRouter({
    crud: ...,
    business: ...,
    delivery: deliveryRouter,  // plain router, no entity toolkit
  })
)
```

### After (factory receiving entity toolkit)

```ts
// proposals.router/index.ts
import { createDeliveryRouter } from './delivery.router'

export const proposalsRouter = createEntityRouter(proposalServerSpec, (entity) =>
  createTRPCRouter({
    crud: ...,
    business: ...,
    delivery: createDeliveryRouter(entity),  // receives toolkit
  })
)
```

The delivery router factory receives the entity toolkit and uses `entity.authedProcedure`,
`entity.publicProcedure`, and `entity.spec` for its procedures.

## Procedure Designs

### sendProposalEmail

**Procedure type:** `entity.authedProcedure` (agent + scope)

**Flow:**
1. Call `emailService.sendProposalEmail(params)` — pure service, no DB
2. Call `handlers.update(ctx, { id, data: { status: 'sent', sentAt } })` — generic CRUD
3. Read the updated proposal to get `meetingId` (from step 2's return value)
4. Call `deriveOutcomeOnProposalSent(SYSTEM_CONTEXT, { meetingId })` — cross-entity DAL
5. Dispatch `syncContractDraftJob` — async QStash job

**Notes:**
- Step 2 uses the procedure's `ctx` (scoped) — agent can only update proposals they have visibility on.
- Step 4 uses `SYSTEM_CONTEXT` because the meeting outcome derivation is a system-level
  side-effect, not gated by the agent's proposal visibility. `@migration(meetings-entity-router)` comment.
- The `ownerKey` pattern from the old code is deleted — scope middleware replaces it.

### recordView

**Procedure type:** `entity.publicProcedure` (no auth — homeowner viewing)

**Flow:**
1. Call `handlers.getById(SYSTEM_CONTEXT, { id: input.proposalId })` — fetch proposal
2. Verify `proposal.token === input.token` — manual token check (publicProcedure has no scope)
3. Call `recordProposalView(input)` — entity DAL mutation
4. Fire-and-forget `sendViewNotificationJob.dispatch(...)` with pre-assembled params

**Notes:**
- Uses `SYSTEM_CONTEXT` for getById because publicProcedure has no session/scope.
  Token validation is manual — this is correct for a public endpoint where the token
  IS the authorization. The shareable middleware isn't used here because recordView
  doesn't need session-or-token branching — it's always token-only.
- The notification job payload includes all data the notification service needs
  (`proposalOwnerId`, `proposalLabel`, `customerName`, etc.) — no DB lookups in
  the notification path.

### getProposalViews

**Procedure type:** `entity.authedProcedure` (agent + scope)

**Flow:**
1. Call `getProposalViews({ proposalId })` — entity DAL query
2. Return stats

## DAL Changes

### Relocate: proposal-views → entity DAL

**From:** `shared/dal/server/proposals/proposal-views.ts`
**To:** Split across entity DAL files

`entities/proposals/dal/server/mutations.ts` — add:
```ts
export async function recordProposalView(
  input: InsertProposalView
): Promise<DalReturn<ProposalView>> {
  return dalDbOperation(async () => {
    const [view] = await db.insert(proposalViews).values(input).returning()
    if (!view) throw new ThrowableDalError({ type: 'create-failed' })
    return view
  })
}
```

`entities/proposals/dal/server/queries.ts` — add:
```ts
export async function getProposalViews(
  input: { proposalId: string }
): Promise<DalReturn<ProposalViewStats>> {
  return dalDbOperation(async () => {
    const views = await db.select().from(proposalViews)
      .where(eq(proposalViews.proposalId, input.proposalId))
      .orderBy(desc(proposalViews.viewedAt))

    return {
      totalViews: views.length,
      lastViewedAt: views[0]?.viewedAt ?? null,
      emailViews: views.filter(v => v.source === 'email').length,
      directViews: views.filter(v => v.source === 'direct').length,
      views,
    }
  })
}
```

**Delete:** `shared/dal/server/proposals/proposal-views.ts` after migration.

### New: meetings entity DAL

`entities/meetings/dal/server/mutations.ts` — create:
```ts
// @migration(meetings-entity-router)
// This is the first meetings entity DAL function. It follows the DalReturn +
// ScopedContext pattern from day one so no re-work is needed when meetings
// gets its full entity router migration. Currently called with SYSTEM_CONTEXT
// from the proposals delivery router (cross-entity side-effect).

const OVERWRITABLE_OUTCOMES = ['not_set', 'proposal_created'] as const

export async function deriveOutcomeOnProposalSent(
  ctx: ScopedContext,
  input: { meetingId: string }
): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    await db.update(meetings)
      .set({ meetingOutcome: 'proposal_sent' })
      .where(and(
        eq(meetings.id, input.meetingId),
        inArray(meetings.meetingOutcome, OVERWRITABLE_OUTCOMES),
      ))
  })
}
```

**Delete:** `entities/meetings/lib/derive-outcome-on-proposal-sent.ts` after migration.

## Service Layer Changes

### emailService — no changes
Already pure. No `db` imports. Receives params, formats, dispatches via Resend.

### notificationService — partial cleanup

**`notifyProposalViewed`:**
- Push path: already pure (calls `sendPushToUser` with params). No change.
- Email path: gated behind `userOptedInToProposalViewedEmail = false` (disabled).
  The `db` import for user email lookup is dead code for now. Remove the dead email
  path and add `@migration(user-email-preferences)` comment noting it returns when
  issue #188 ships — at which point the caller passes `ownerEmail` in params.

**Meeting notification methods (`notifyMeetingParticipantAdded`, `notifyMeetingScheduledTimeChanged`):**
- These are called by the meetings router, NOT the delivery router. Out of scope.
- Add `@migration(meetings-entity-router)` comments explaining:
  - Once the meetings router migrates, callers pass pre-assembled params (customer name,
    address, scheduled time, recipient list).
  - The `db` imports are removed and these methods become pure formatters + dispatchers.
- Do NOT change behavior — the meetings router hasn't migrated and still depends
  on the current signatures.

**After this migration, `notificationService` still imports `db`** but only for
the meeting methods (out of scope). The `db` import gets a top-level `@migration`
comment explaining it will be removed when meetings router migrates.

## Files Changed

| File | Action |
|------|--------|
| `src/trpc/routers/proposals.router/delivery.router.ts` | Rewrite: factory pattern, entity toolkit |
| `src/trpc/routers/proposals.router/index.ts` | Update: `createDeliveryRouter(entity)` call |
| `src/shared/entities/proposals/dal/server/mutations.ts` | Add: `recordProposalView` |
| `src/shared/entities/proposals/dal/server/queries.ts` | Add: `getProposalViews`, `ProposalViewStats` type |
| `src/shared/entities/meetings/dal/server/mutations.ts` | Create: `deriveOutcomeOnProposalSent` |
| `src/shared/services/notification.service.ts` | Cleanup: remove dead email path from `notifyProposalViewed`, add `@migration` comments |
| `src/shared/services/upstash/jobs/send-view-notification.ts` | No change (already calls notificationService) |
| `src/shared/entities/meetings/lib/derive-outcome-on-proposal-sent.ts` | Delete |
| `src/shared/dal/server/proposals/proposal-views.ts` | Delete |

## Files NOT Changed (explicitly deferred)

| File | Reason |
|------|--------|
| `contracts.router.ts` | Separate design — service-layer concern (Zoho Sign orchestration) |
| `contract.service.ts` | Blocked on contracts router design |
| `pdf.service.ts` | Blocked on contracts router design |
| `src/app/api/proposals/[proposalId]/summary/route.ts` | Separate migration |
| `src/shared/services/upstash/jobs/sync-zoho-sign-status.ts` | Separate migration |
| `src/shared/dal/server/proposals/api.ts` | Cannot delete yet — still has consumers |

## Post-Implementation

After this design is implemented:
1. Update ADR-0002 with the delivery router as a reference implementation for service-layer sub-routers
2. Update the session handoff doc with current state
3. Brainstorm the next migration target (contracts router + contract.service + pdf.service)

## Migration Comment Convention

All migration comments follow this format:

```ts
// @migration(<dependency-identifier>)
// <What the current code does and why it deviates from the target pattern.>
// <What it becomes when the dependency lands.>
// <What to delete when migrating.>
```

This makes them greppable (`@migration(meetings-entity-router)`) and gives future
sessions enough context to migrate without reading the full ADR.
