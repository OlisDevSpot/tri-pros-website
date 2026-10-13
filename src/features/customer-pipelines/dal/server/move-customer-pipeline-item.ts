import type { Pipeline } from '@/shared/constants/enums/pipelines'

import type { ScopedContext } from '@/shared/dal/server/types'

import type { FreshPipelineStage } from '@/shared/domains/pipelines/constants/fresh-pipeline'

import { TRPCError } from '@trpc/server'
import { and, asc, desc, eq, gt, isNull, sql } from 'drizzle-orm'

import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema/meetings'
import { projects } from '@/shared/db/schema/projects'
import { proposals } from '@/shared/db/schema/proposals'
import { FRESH_ALLOWED_DRAG_TRANSITIONS } from '@/shared/domains/pipelines/constants/fresh-pipeline'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
import { projectCrud } from '@/shared/modules/projects/core/dal/server/crud'
import { projectServerSpec } from '@/shared/modules/projects/core/server-spec'
import { proposalCrud } from '@/shared/modules/proposals/core/dal/server/crud'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'

interface MoveParams {
  customerId: string
  fromStage: string
  toStage: string
  pipeline: Pipeline
  ctx: ScopedContext
}

export async function moveCustomerPipelineItem({
  customerId,
  fromStage,
  toStage,
  pipeline,
  ctx,
}: MoveParams): Promise<void> {
  // Leads pipeline: update customers.pipelineStage through customerCrud so any
  // future spec.hooks.update.* fires consistently. The user must be able to see
  // the customer (meeting-participation visibility) for the write to land.
  if (pipeline === 'leads') {
    dalVerifySuccess(
      await customerCrud.update(ctx, {
        id: customerId,
        data: { pipelineStage: toStage },
      }),
    )
    return
  }

  // Rehash/dead pipelines: no intra-stage dragging supported yet
  if (pipeline === 'rehash' || pipeline === 'dead') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Stage dragging is not yet supported for the rehash/dead pipelines',
    })
  }

  // Projects pipeline: the card shows the customer's newest project, so that is the one the drag moves.
  if (pipeline === 'projects') {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.customerId, customerId), permit(ctx, 'update', projectServerSpec).sql))
      .orderBy(desc(projects.createdAt))
      .limit(1)

    if (!project) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No project found for this customer',
      })
    }

    dalVerifySuccess(await projectCrud.update(ctx, { id: project.id, data: { pipelineStage: toStage } }))
    return
  }

  // Fresh pipeline: same logic as before
  const freshFromStage = fromStage as FreshPipelineStage
  const freshToStage = toStage as FreshPipelineStage
  const allowed = FRESH_ALLOWED_DRAG_TRANSITIONS[freshFromStage]
  if (!allowed.includes(freshToStage)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Transition from ${fromStage} to ${toStage} is not allowed`,
    })
  }

  if (
    (fromStage === 'needs_confirmation' && toStage === 'meeting_confirmed')
    || (fromStage === 'meeting_confirmed' && toStage === 'needs_confirmation')
  ) {
    const [nextMeeting] = await db
      .select({ id: meetings.id })
      .from(meetings)
      .where(and(
        eq(meetings.customerId, customerId),
        permit(ctx, 'read', meetingServerSpec).sql,
        eq(meetings.pipeline, 'fresh'),
        isNull(meetings.projectId),
        eq(meetings.meetingOutcome, 'not_set'),
        gt(meetings.scheduledFor, sql`now()`),
      ))
      .orderBy(asc(meetings.scheduledFor))
      .limit(1)

    if (!nextMeeting) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No upcoming meeting found for this customer',
      })
    }

    dalVerifySuccess(
      await meetingCrud.update(ctx, {
        id: nextMeeting.id,
        data: { confirmedAt: toStage === 'meeting_confirmed' ? new Date().toISOString() : null },
      }),
    )

    return
  }

  if (toStage === 'meeting_completed') {
    const customerMeetings = await db
      .select({ id: meetings.id })
      .from(meetings)
      .where(and(
        eq(meetings.customerId, customerId),
        permit(ctx, 'read', meetingServerSpec).sql,
        eq(meetings.meetingOutcome, 'not_set'),
      ))
      .orderBy(meetings.createdAt)
      .limit(1)

    if (customerMeetings.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No in-progress meeting found for this customer',
      })
    }

    dalVerifySuccess(
      await meetingCrud.update(ctx, {
        id: customerMeetings[0].id,
        data: { meetingOutcome: 'follow_up_needed' },
      }),
    )

    return
  }

  if (fromStage === 'proposal_sent' && toStage === 'declined') {
    const sentProposals = await db
      .select({ id: proposals.id })
      .from(proposals)
      .innerJoin(meetings, eq(meetings.id, proposals.meetingId))
      .where(and(
        eq(meetings.customerId, customerId),
        permit(ctx, 'update', proposalServerSpec).sql,
        eq(proposals.status, 'sent'),
      ))

    if (sentProposals.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No sent proposals found for this customer',
      })
    }

    for (const p of sentProposals) {
      dalVerifySuccess(
        await proposalCrud.update(ctx, {
          id: p.id,
          data: { status: 'declined' },
        }),
      )
    }

    return
  }

  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'Unhandled transition',
  })
}
