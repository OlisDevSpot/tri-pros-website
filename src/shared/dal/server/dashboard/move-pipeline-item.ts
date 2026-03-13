import type { MeetingPipelineStage } from '@/features/agent-dashboard/constants/pipeline-stages'

import { TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'

import { MEETING_ALLOWED_DRAG_TRANSITIONS } from '@/features/agent-dashboard/constants/pipeline-stages'
import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema/meetings'

export interface MoveMeetingParams {
  meetingId: string
  fromStage: MeetingPipelineStage
  toStage: MeetingPipelineStage
  userId: string
}

export async function moveMeetingPipelineItem(params: MoveMeetingParams): Promise<void> {
  const { meetingId, fromStage, toStage, userId } = params

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
        eq(meetings.id, meetingId),
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

  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'Unhandled transition',
  })
}
