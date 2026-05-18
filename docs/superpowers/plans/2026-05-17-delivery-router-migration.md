# Delivery Router Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `delivery.router.ts` to the entity toolkit pattern, relocate proposal-view DAL, create the first meetings entity DAL function, and clean up notification service DB violations.

**Architecture:** The delivery router becomes a factory function receiving the entity toolkit. Procedures orchestrate: they call pure services (email, notification), generic CRUD DAL for updates, cross-entity DAL for side-effects, and dispatch async jobs. No direct `db` imports outside DAL.

**Tech Stack:** tRPC, Drizzle ORM, Zod, QStash (Upstash), Resend, web-push

**Spec:** `docs/superpowers/specs/2026-05-17-delivery-router-migration-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/shared/entities/meetings/dal/server/mutations.ts` | Create | First meetings entity DAL — `deriveOutcomeOnProposalSent` |
| `src/shared/entities/proposals/dal/server/mutations.ts` | Modify | Add `recordProposalView` |
| `src/shared/entities/proposals/dal/server/queries.ts` | Modify | Add `getProposalViews` + `ProposalViewStats` type |
| `src/trpc/routers/proposals.router/delivery.router.ts` | Rewrite | Factory pattern with entity toolkit |
| `src/trpc/routers/proposals.router/index.ts` | Modify | Wire `createDeliveryRouter(entity)` |
| `src/shared/services/notification.service.ts` | Modify | Remove dead email path, add `@migration` comments |
| `src/shared/entities/meetings/lib/derive-outcome-on-proposal-sent.ts` | Delete | Replaced by DAL function |
| `src/shared/dal/server/proposals/proposal-views.ts` | Delete | Replaced by entity DAL functions |

---

## Task 1: Create meetings entity DAL — `deriveOutcomeOnProposalSent`

**Files:**
- Create: `src/shared/entities/meetings/dal/server/mutations.ts`

- [ ] **Step 1: Create the meetings DAL mutations file**

```ts
// src/shared/entities/meetings/dal/server/mutations.ts

// ─── Meetings Business Mutations ────────────────────────────────────────────
// @migration(meetings-entity-router)
// This is the first meetings entity DAL function. It follows the DalReturn +
// ScopedContext pattern from day one so no re-work is needed when meetings
// gets its full entity router migration. Currently called with SYSTEM_CONTEXT
// from the proposals delivery router (cross-entity side-effect).
// When the meetings entity router migrates, this file becomes the canonical
// meetings mutations module alongside a queries.ts sibling.

import type { DalReturn, ScopedContext } from '@/shared/dal/server/lib/types'

import { and, eq, inArray } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema'

const OVERWRITABLE_OUTCOMES = ['not_set', 'proposal_created'] as const

/**
 * Conditionally flips a meeting's outcome to `proposal_sent`.
 *
 * Only overwrites outcomes that represent "nothing decided yet" (`not_set`,
 * `proposal_created`). Manually-set outcomes and terminal derived outcomes
 * (`converted_to_project`) are preserved.
 *
 * This is a business mutation (conditional WHERE) — not expressible as
 * generic CRUD. The condition is intentional: it prevents overwriting
 * meaningful outcomes when a second proposal is sent on the same meeting.
 */
export async function deriveOutcomeOnProposalSent(
  _ctx: ScopedContext,
  input: { meetingId: string },
): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    await db
      .update(meetings)
      .set({ meetingOutcome: 'proposal_sent' })
      .where(and(
        eq(meetings.id, input.meetingId),
        inArray(meetings.meetingOutcome, [...OVERWRITABLE_OUTCOMES]),
      ))
  })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit 2>&1 | head -20`
Expected: No errors related to the new file.

- [ ] **Step 3: Commit**

```bash
git add src/shared/entities/meetings/dal/server/mutations.ts
git commit -m "refactor(meetings): create first meetings entity DAL with deriveOutcomeOnProposalSent"
```

---

## Task 2: Add `recordProposalView` to entity DAL

**Files:**
- Modify: `src/shared/entities/proposals/dal/server/mutations.ts`

- [ ] **Step 1: Add the `recordProposalView` function**

Add at the bottom of `src/shared/entities/proposals/dal/server/mutations.ts`:

```ts
// ── recordProposalView ─────────────────────────────────────────────────

import type { InsertProposalView, ProposalView } from '@/shared/db/schema/proposal-views'

import { proposalViews } from '@/shared/db/schema/proposal-views'

/**
 * Records a proposal view event. Called from the public recordView procedure
 * when a homeowner opens their proposal link.
 */
export async function recordProposalView(
  input: InsertProposalView,
): Promise<DalReturn<ProposalView>> {
  return dalDbOperation(async () => {
    const [view] = await db.insert(proposalViews).values(input).returning()
    if (!view) {
      throw new ThrowableDalError({ type: 'create-failed' })
    }
    return view
  })
}
```

Note: The existing imports at the top of the file already include `DalReturn`, `ScopedContext`, `dalDbOperation`, `ThrowableDalError`, and `db`. Add the `InsertProposalView`, `ProposalView`, and `proposalViews` imports to the existing import block.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/entities/proposals/dal/server/mutations.ts
git commit -m "refactor(proposals): add recordProposalView to entity DAL"
```

---

## Task 3: Add `getProposalViews` to entity DAL

**Files:**
- Modify: `src/shared/entities/proposals/dal/server/queries.ts`

- [ ] **Step 1: Add the `ProposalViewStats` type and `getProposalViews` function**

Add at the bottom of `src/shared/entities/proposals/dal/server/queries.ts`:

```ts
// ── getProposalViews ───────────────────────────────────────────────────

import type { ProposalView } from '@/shared/db/schema/proposal-views'

export interface ProposalViewStats {
  totalViews: number
  lastViewedAt: string | null
  emailViews: number
  directViews: number
  views: ProposalView[]
}

/**
 * Returns view stats for a proposal — total count, last viewed, breakdown
 * by source, and the raw view records ordered most-recent-first.
 */
export async function getProposalViews(
  input: { proposalId: string },
): Promise<DalReturn<ProposalViewStats>> {
  return dalDbOperation(async () => {
    const views = await db
      .select()
      .from(proposalViews)
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

Note: `proposalViews` is already imported at the top of this file. Add the `ProposalView` type import and `desc` from drizzle-orm (if not already imported — check existing imports first).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/entities/proposals/dal/server/queries.ts
git commit -m "refactor(proposals): add getProposalViews to entity DAL"
```

---

## Task 4: Rewrite delivery router as factory

**Files:**
- Rewrite: `src/trpc/routers/proposals.router/delivery.router.ts`

- [ ] **Step 1: Rewrite the delivery router**

Replace the entire file with:

```ts
// src/trpc/routers/proposals.router/delivery.router.ts

// ─── Delivery Router (Entity Toolkit Pattern) ───────────────────────────────
// Service-layer sub-router for proposal delivery: send email, record view,
// get view stats. Receives the entity toolkit from the parent entity router
// factory — uses entity.authedProcedure / entity.publicProcedure for
// pre-configured auth + scope middleware.
//
// Orchestration pattern: procedure calls pure services (email, notification),
// generic CRUD DAL (handlers.update), cross-entity DAL, and dispatches jobs.
// No direct db imports. No deprecated DAL functions.

import type { PgTable } from 'drizzle-orm/pg-core'

import type { EntityToolkit } from '@/trpc/lib/create-entity-router'

import { TRPCError } from '@trpc/server'
import z from 'zod'

import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/lib/types'
import { deriveOutcomeOnProposalSent } from '@/shared/entities/meetings/dal/server/mutations'
import { recordProposalView } from '@/shared/entities/proposals/dal/server/mutations'
import { getFullView, getProposalViews } from '@/shared/entities/proposals/dal/server/queries'
import { proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'
import { emailService } from '@/shared/services/email.service'
import { sendViewNotificationJob } from '@/shared/services/upstash/jobs/send-view-notification'
import { syncContractDraftJob } from '@/shared/services/upstash/jobs/sync-contract-draft'
import { createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'

const sendEmailSchema = z.object({
  proposalId: z.string(),
  customerName: z.string(),
  email: z.email(),
  token: z.string(),
  message: z.string().optional(),
})

const recordViewSchema = z.object({
  proposalId: z.string(),
  token: z.string(),
  source: z.enum(['email', 'sms', 'direct', 'unknown']).default('unknown'),
  referer: z.string().optional(),
  userAgent: z.string().optional(),
})

export function createDeliveryRouter(entity: EntityToolkit<typeof proposalServerSpec.table>) {
  const handlers = createCrudDal(proposalServerSpec)

  return createTRPCRouter({
    sendProposalEmail: entity.authedProcedure
      .input(sendEmailSchema)
      .mutation(async ({ ctx, input }) => {
        // 1. Send email — pure service, no DB
        const { data } = await emailService.sendProposalEmail({
          proposalId: input.proposalId,
          token: input.token,
          customerName: input.customerName,
          email: input.email,
          message: input.message,
          replyTo: ctx.session.user.email,
          repName: ctx.session.user.name,
        })

        // 2. Update proposal status via generic CRUD
        const proposal = dalToTrpc(await handlers.update(ctx, {
          id: input.proposalId,
          data: { status: 'sent', sentAt: new Date().toISOString() },
        }))

        // 3. Cross-entity side-effect: derive meeting outcome
        // @migration(meetings-entity-router)
        // Uses SYSTEM_CONTEXT because this is a system-level side-effect on
        // the meetings entity, not gated by the agent's proposal visibility.
        // When meetings migrates to entity router, this call stays the same —
        // the DAL function already accepts ScopedContext.
        if (proposal.meetingId) {
          dalToTrpc(await deriveOutcomeOnProposalSent(SYSTEM_CONTEXT, { meetingId: proposal.meetingId }))
        }

        // 4. Dispatch async contract draft sync job
        // @migration(contract-service)
        // ownerKey is passed for the un-migrated contract.service. Once
        // contract.service migrates to DAL + SYSTEM_CONTEXT pattern, remove
        // ownerKey from the job payload entirely.
        const isOmni = ctx.ability.can('manage', 'all')
        const ownerKey = isOmni ? null : ctx.session.user.id
        await syncContractDraftJob.dispatch({ proposalId: input.proposalId, ownerKey })

        return { data, proposal }
      }),

    recordView: entity.publicProcedure
      .input(recordViewSchema)
      .mutation(async ({ input }) => {
        // 1. Fetch proposal with customer join — SYSTEM_CONTEXT because publicProcedure
        // has no session. Uses getFullView (not handlers.getById) because we need
        // customer.name for the notification job payload.
        const proposal = dalToTrpc(await getFullView(SYSTEM_CONTEXT, { id: input.proposalId }))
        if (!proposal) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
        }

        // 2. Manual token validation — token IS the authorization on this path
        if (proposal.token !== input.token) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid token' })
        }

        // 3. Record the view via entity DAL
        const view = dalToTrpc(await recordProposalView({
          proposalId: input.proposalId,
          source: input.source,
          referer: input.referer,
          userAgent: input.userAgent,
        }))

        // 4. Dispatch notification job (fire-and-forget) with pre-assembled params
        void sendViewNotificationJob.dispatch({
          proposalOwnerId: proposal.ownerId,
          proposalLabel: proposal.label,
          proposalId: input.proposalId,
          customerName: proposal.customer?.name ?? 'Customer',
          viewedAt: view.viewedAt,
          source: input.source,
        }).catch(() => {})
      }),

    getProposalViews: entity.authedProcedure
      .input(z.object({ proposalId: z.string() }))
      .query(async ({ input }) => {
        return dalToTrpc(await getProposalViews({ proposalId: input.proposalId }))
      }),
  })
}
```

- [ ] **Step 2: Export `EntityToolkit` type from `create-entity-router.ts`**

The `EntityToolkit` interface is currently not exported. Add `export` to it:

In `src/trpc/lib/create-entity-router.ts`, change:
```ts
interface EntityToolkit<TTable extends PgTable> {
```
to:
```ts
export interface EntityToolkit<TTable extends PgTable> {
```

- [ ] **Step 3: Verify TypeScript compiles (expect errors from parent router — fixed in next task)**

Run: `pnpm tsc --noEmit 2>&1 | head -30`
Expected: Error in `proposals.router/index.ts` about `deliveryRouter` import — this is fixed in Task 5.

---

## Task 5: Wire `createDeliveryRouter` into parent proposals router

**Files:**
- Modify: `src/trpc/routers/proposals.router/index.ts`
- Modify: `src/trpc/lib/create-entity-router.ts`

- [ ] **Step 1: Update the proposals router to call the delivery factory**

In `src/trpc/routers/proposals.router/index.ts`:

Replace:
```ts
import { deliveryRouter } from './delivery.router'
```
with:
```ts
import { createDeliveryRouter } from './delivery.router'
```

Replace:
```ts
    delivery: deliveryRouter,
```
with:
```ts
    delivery: createDeliveryRouter(entity),
```

- [ ] **Step 2: Verify TypeScript compiles clean**

Run: `pnpm tsc --noEmit 2>&1 | head -20`
Expected: Zero errors.

- [ ] **Step 3: Run lint**

Run: `pnpm lint 2>&1 | tail -20`
Expected: Zero errors (warnings acceptable if pre-existing).

- [ ] **Step 4: Commit**

```bash
git add src/trpc/routers/proposals.router/delivery.router.ts \
        src/trpc/routers/proposals.router/index.ts \
        src/trpc/lib/create-entity-router.ts
git commit -m "refactor(proposals): migrate delivery router to entity toolkit factory pattern"
```

---

## Task 6: Clean up notification service

**Files:**
- Modify: `src/shared/services/notification.service.ts`

- [ ] **Step 1: Remove dead email path from `notifyProposalViewed` and add migration comments**

In `src/shared/services/notification.service.ts`:

Replace the `notifyProposalViewed` method with:

```ts
    notifyProposalViewed: async (params: {
      proposalOwnerId: string
      proposalLabel: string
      proposalId: string
      customerName: string
      viewedAt: string
      source: string
    }) => {
      const sourceLabels: Record<string, string> = {
        email: 'Opened from email link',
        sms: 'Opened from SMS link',
        direct: 'Opened directly',
        unknown: 'Opened directly',
      }
      const sourceLabel = sourceLabels[params.source] ?? 'Opened directly'

      // Push (always sent when owner has an active subscription).
      const pushResult = await sendPushToUser(params.proposalOwnerId, {
        title: `Proposal Viewed | ${params.customerName}`,
        body: `${sourceLabel} • ${formatScheduledTime(params.viewedAt)}`,
        navigate: ROOTS.dashboard.proposals.byId(params.proposalId),
        urgency: 'high',
      })
      if (pushResult.failed > 0 || pushResult.errors.length > 0) {
        console.warn(`[notificationService] notifyProposalViewed push partial failure:`, pushResult)
      }

      // @migration(user-email-preferences)
      // Email notification for proposal views was disabled pending user
      // preference system (issue #188). When that ships:
      // 1. Caller passes `ownerEmail` in params (already available on session)
      // 2. Check user preference via DAL query or params
      // 3. Send email using ownerEmail — no db lookup needed here
    },
```

- [ ] **Step 2: Add top-level `@migration` comment for remaining `db` import**

At the top of the file, after the existing imports, add:

```ts
// @migration(meetings-entity-router)
// This service still imports `db` for the meeting notification methods
// (notifyMeetingParticipantAdded, notifyMeetingScheduledTimeChanged).
// Once the meetings router migrates to entity toolkit:
// - Callers pass pre-assembled params (customer name, address, recipients)
// - The `db` import and all direct queries are removed
// - This service becomes a pure formatter + push/email dispatcher
```

- [ ] **Step 3: Add `@migration` comments to meeting notification methods**

Before `notifyMeetingParticipantAdded`:
```ts
    // @migration(meetings-entity-router)
    // Once meetings migrates: caller passes { customerName, customerAddress,
    // scheduledFor } in params. Remove the db query below.
```

Before `notifyMeetingScheduledTimeChanged`:
```ts
    // @migration(meetings-entity-router)
    // Once meetings migrates: caller passes { recipientUserIds, customerName,
    // customerAddress } in params. Remove both db queries below.
```

- [ ] **Step 4: Remove unused imports if the email path removal eliminates any**

Check if removing the email send from `notifyProposalViewed` leaves any unused imports (`resendClient`, `RESEND_FROM`, `renderProposalViewedEmail`, the `user` schema import). If the `user` and `resendClient` imports are still used by other methods, keep them. If `renderProposalViewedEmail` is now unused, remove it.

Check: `renderProposalViewedEmail` — only used in the removed email path → remove import.
Check: `user` schema import — only used in the removed email path → remove import.
Check: `resendClient` / `RESEND_FROM` — NOT used by any remaining method in this file → remove imports.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit 2>&1 | head -20`
Expected: Zero errors.

- [ ] **Step 6: Run lint**

Run: `pnpm lint 2>&1 | tail -20`
Expected: Zero errors.

- [ ] **Step 7: Commit**

```bash
git add src/shared/services/notification.service.ts
git commit -m "refactor(notifications): remove dead email path, add @migration comments for meetings cleanup"
```

---

## Task 7: Delete old files

**Files:**
- Delete: `src/shared/entities/meetings/lib/derive-outcome-on-proposal-sent.ts`
- Delete: `src/shared/dal/server/proposals/proposal-views.ts`

- [ ] **Step 1: Verify no remaining imports of the old files**

Run: `grep -r "derive-outcome-on-proposal-sent" src/ --include="*.ts" --include="*.tsx" | grep -v "dal/server/mutations"`
Expected: Zero results (the only consumer was delivery.router, which now imports from entity DAL).

Run: `grep -r "dal/server/proposals/proposal-views" src/ --include="*.ts" --include="*.tsx"`
Expected: Zero results (the only consumer was delivery.router, which now imports from entity DAL).

- [ ] **Step 2: Delete the files**

```bash
rm src/shared/entities/meetings/lib/derive-outcome-on-proposal-sent.ts
rm src/shared/dal/server/proposals/proposal-views.ts
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit 2>&1 | head -20`
Expected: Zero errors.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "refactor: delete old derive-outcome and proposal-views files (replaced by entity DAL)"
```

---

## Task 8: Final verification

- [ ] **Step 1: Full type check**

Run: `pnpm tsc --noEmit`
Expected: Exit 0, zero errors.

- [ ] **Step 2: Full lint**

Run: `pnpm lint`
Expected: Zero errors (pre-existing warnings acceptable).

- [ ] **Step 3: Review diff for unintended changes**

Run: `git diff main --stat`
Review: Confirm only the expected files are changed. No debug logs, no leftover imports, no accidental whitespace changes in unrelated files.

- [ ] **Step 4: Verify old DAL consumer count decreased**

Run: `grep -r "from '@/shared/dal/server/proposals/api'" src/ --include="*.ts" --include="*.tsx" | wc -l`
Expected: 3 (down from 5 — `contract.service.ts`, `pdf.service.ts`, `summary/route.ts` remain as deferred consumers). The `delivery.router.ts` and implicitly `contracts.router.ts` no longer import from it (delivery was migrated; contracts still does via its own import).

Actually verify the exact remaining consumers:
Run: `grep -r "from '@/shared/dal/server/proposals/api'" src/ --include="*.ts" --include="*.tsx"`
Expected output (4 remaining — contracts.router still imports directly):
```
src/trpc/routers/proposals.router/contracts.router.ts
src/shared/services/contract.service.ts
src/shared/services/pdf.service.ts
src/app/api/proposals/[proposalId]/summary/route.ts
```

- [ ] **Step 5: Verify `@migration` comments are greppable**

Run: `grep -r "@migration" src/ --include="*.ts" --include="*.tsx"`
Expected: Hits in `entities/meetings/dal/server/mutations.ts`, `notification.service.ts`, and `delivery.router.ts`.
