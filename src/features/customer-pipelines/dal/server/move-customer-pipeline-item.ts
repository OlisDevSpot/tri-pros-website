import type { Pipeline } from '@/shared/constants/enums/pipelines'

import type { FreshPipelineStage } from '@/shared/domains/pipelines/constants/fresh-pipeline'

import { TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'

import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { meetings } from '@/shared/db/schema/meetings'
import { projects } from '@/shared/db/schema/projects'
import { proposals } from '@/shared/db/schema/proposals'
import { FRESH_ALLOWED_DRAG_TRANSITIONS } from '@/shared/domains/pipelines/constants/fresh-pipeline'

interface MoveParams {
  customerId: string
  fromStage: string
  toStage: string
  pipeline: Pipeline
  userId: string
  isOmni?: boolean
}

export async function moveCustomerPipelineItem({ customerId, fromStage, toStage, pipeline, userId, isOmni = false }: MoveParams): Promise<void> {
  // Leads pipeline: update customers.pipelineStage directly
  if (pipeline === 'leads') {
    await db
      .update(customers)
      .set({ pipelineStage: toStage })
      .where(eq(customers.id, customerId))
    return
  }

  // Rehash/dead pipelines: no intra-stage dragging supported yet
  if (pipeline === 'rehash' || pipeline === 'dead') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Stage dragging is not yet supported for the rehash/dead pipelines',
    })
  }

  // Projects pipeline: update projects.pipelineStage directly
  if (pipeline === 'projects') {
    // Find the project for this customer and update its pipelineStage
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.customerId, customerId))
      .limit(1)

    if (!project) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No project found for this customer',
      })
    }

    await db
      .update(projects)
      .set({ pipelineStage: toStage })
      .where(eq(projects.id, project.id))

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
    (fromStage === 'meeting_scheduled' && toStage === 'meeting_in_progress')
    || (fromStage === 'meeting_in_progress' && toStage === 'meeting_completed')
    || (fromStage === 'follow_up_scheduled' && toStage === 'meeting_completed')
  ) {
    const targetOutcome = toStage === 'meeting_completed' ? 'follow_up_needed' : 'not_set'

    const customerMeetings = await db
      .select({ id: meetings.id })
      .from(meetings)
      .where(and(
        eq(meetings.customerId, customerId),
        isOmni ? undefined : eq(meetings.ownerId, userId),
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

    await db
      .update(meetings)
      .set({ meetingOutcome: targetOutcome as 'not_set' | 'follow_up_needed' })
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
        isOmni ? undefined : eq(proposals.ownerId, userId),
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
