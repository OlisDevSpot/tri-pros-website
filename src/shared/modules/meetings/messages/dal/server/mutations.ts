import type { MeetingMessage } from '@/shared/db/schema/meeting-messages'
import type { MeetingMessageChannel, MeetingMessageKind } from '@/shared/modules/meetings/messages/constants/kinds'

import { eq } from 'drizzle-orm'

import { db } from '@/shared/db'
import { meetingMessages } from '@/shared/db/schema/meeting-messages'

type AutomaticKind = Extract<MeetingMessageKind, 'day_before_reminder' | 'rep_confirmation' | 'visit_cancellation'>

interface AutomaticRowInput {
  meetingId: string
  kind: AutomaticKind
  channel: MeetingMessageChannel
  forScheduledFor: string
}

/**
 * Claims an automatic send for one meeting time. Null means another delivery got there first: the
 * partial unique index is the only thing between at-least-once delivery and a double text.
 */
export async function claimAutomaticSend(input: AutomaticRowInput): Promise<MeetingMessage | null> {
  const [row] = await db
    .insert(meetingMessages)
    .values({ ...input, status: 'pending' })
    .onConflictDoNothing()
    .returning()
  return row ?? null
}

/** Records why a run did not send; null when a row for this time already exists. */
export async function recordAutomaticSkip(input: AutomaticRowInput & { reason: string }): Promise<MeetingMessage | null> {
  const { reason, ...rest } = input
  const [row] = await db
    .insert(meetingMessages)
    .values({ ...rest, status: 'skipped', reason })
    .onConflictDoNothing()
    .returning()
  return row ?? null
}

export async function setMeetingMessageOutcome(id: string, outcome: {
  status: 'sent' | 'failed' | 'skipped'
  reason: string | null
  voipMessageId?: string | null
  emailProviderId?: string | null
}): Promise<void> {
  await db.update(meetingMessages).set(outcome).where(eq(meetingMessages.id, id))
}
