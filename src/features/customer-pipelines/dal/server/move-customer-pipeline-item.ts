import type { CustomerPipelineStage } from '@/features/customer-pipelines/constants/active-pipeline-stages'

import { TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'

import { ACTIVE_ALLOWED_DRAG_TRANSITIONS } from '@/features/customer-pipelines/constants/active-pipeline-stages'
import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema/meetings'
import { proposals } from '@/shared/db/schema/proposals'

interface MoveParams {
  customerId: string
  fromStage: CustomerPipelineStage
  toStage: CustomerPipelineStage
  userId: string
}

export async function moveCustomerPipelineItem({ customerId, fromStage, toStage, userId }: MoveParams): Promise<void> {
  const allowed = ACTIVE_ALLOWED_DRAG_TRANSITIONS[fromStage]
  if (!allowed.includes(toStage)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Transition from ${fromStage} to ${toStage} is not allowed`,
    })
  }

  if (
    (fromStage === 'meeting_scheduled' && toStage === 'meeting_in_progress')
    || (fromStage === 'meeting_in_progress' && toStage === 'meeting_completed')
    || (fromStage === 'follow_up_scheduled' && toStage === 'meeting_completed')
  ) {
    const targetStatus = toStage === 'meeting_completed' ? 'completed' : 'in_progress'

    const customerMeetings = await db
      .select({ id: meetings.id })
      .from(meetings)
      .where(and(
        eq(meetings.customerId, customerId),
        eq(meetings.ownerId, userId),
        eq(meetings.status, 'in_progress'),
      ))
      .orderBy(meetings.createdAt)
      .limit(1)

    if (customerMeetings.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No in-progress meeting found for this customer',
      })
    }

    await db
      .update(meetings)
      .set({ status: targetStatus as 'in_progress' | 'completed' })
      .where(eq(meetings.id, customerMeetings[0].id))

    return
  }

  if (fromStage === 'proposal_sent' && toStage === 'declined') {
    const sentProposals = await db
      .select({ id: proposals.id })
      .from(proposals)
      .innerJoin(meetings, eq(meetings.id, proposals.meetingId))
      .where(and(
        eq(meetings.customerId, customerId),
        eq(proposals.ownerId, userId),
        eq(proposals.status, 'sent'),
      ))

    if (sentProposals.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No sent proposals found for this customer',
      })
    }

    for (const p of sentProposals) {
      await db
        .update(proposals)
        .set({ status: 'declined' })
        .where(eq(proposals.id, p.id))
    }

    return
  }

  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'Unhandled transition',
  })
}
