import type { MeetingPipelineStage, ProposalPipelineStage } from '@/features/agent-dashboard/constants/pipeline-stages'

import { TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'

import { MEETING_ALLOWED_DRAG_TRANSITIONS, PROPOSAL_ALLOWED_DRAG_TRANSITIONS } from '@/features/agent-dashboard/constants/pipeline-stages'
import { db } from '@/shared/db'
import { proposals } from '@/shared/db/schema'
import { meetings } from '@/shared/db/schema/meetings'

export type MovePipelineItemParams = {
  type: 'proposal'
  pipelineItemId: string
  fromStage: ProposalPipelineStage
  toStage: ProposalPipelineStage
  userId: string
} | {
  type: 'meeting'
  pipelineItemId: string
  fromStage: MeetingPipelineStage
  toStage: MeetingPipelineStage
  userId: string
}

export async function movePipelineItem(params: MovePipelineItemParams): Promise<void> {
  const { type } = params

  if (type === 'proposal') {
    const { pipelineItemId, fromStage, toStage, userId } = params
    const allowedTargets = PROPOSAL_ALLOWED_DRAG_TRANSITIONS[fromStage]
    if (!allowedTargets.includes(toStage)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Transition from ${fromStage} to ${toStage} is not allowed`,
      })
    }

    if (fromStage === 'proposal_sent' && toStage === 'declined') {
      const result = await db
        .update(proposals)
        .set({ status: 'declined' })
        .where(and(
          eq(proposals.id, pipelineItemId),
          eq(proposals.ownerId, userId),
        ))
        .returning({ id: proposals.id })

      if (result.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Meeting not found or you do not have permission',
        })
      }

      return
    }

    if (fromStage === 'declined' && toStage === 'proposal_draft') {
      const result = await db
        .update(proposals)
        .set({ status: 'draft' })
        .where(and(
          eq(proposals.id, pipelineItemId),
          eq(proposals.ownerId, userId),
        ))
        .returning({ id: proposals.id })

      if (result.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Meeting not found or you do not have permission',
        })
      }

      return
    }
  }

  if (type === 'meeting') {
    const { pipelineItemId, fromStage, toStage, userId } = params
    const allowedTargets = MEETING_ALLOWED_DRAG_TRANSITIONS[fromStage]
    if (!allowedTargets.includes(toStage)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Transition from ${fromStage} to ${toStage} is not allowed`,
      })
    }

    // meeting_set → meeting_done: update meeting status to 'completed'
    if (fromStage === 'meeting_set' && toStage === 'meeting_done') {
      const result = await db
        .update(meetings)
        .set({ status: 'completed' })
        .where(and(
          eq(meetings.id, pipelineItemId),
          eq(meetings.ownerId, userId),
        ))
        .returning({ id: meetings.id })

      if (result.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Meeting not found or you do not have permission',
        })
      }

      return
    }
  }

  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'Unhandled transition',
  })
}
