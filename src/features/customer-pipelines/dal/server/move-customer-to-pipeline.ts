import type { MeetingPipeline } from '@/shared/constants/enums/pipelines'
import type { ScopedContext } from '@/shared/dal/server/types'

import { and, eq, isNull } from 'drizzle-orm'

import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema/meetings'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'

/**
 * Moves all of a customer's non-project meetings to a target pipeline; project meetings stay where they are.
 * Through `meetingCrud.update` so the update hook fires per row and open meeting cards repaint.
 * The caller is gated to `manage CustomerPipeline`, so the acting user reaches every meeting.
 */
export async function moveCustomerToPipeline(
  ctx: ScopedContext,
  customerId: string,
  pipeline: MeetingPipeline,
): Promise<void> {
  const meetingIds = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(and(
      eq(meetings.customerId, customerId),
      isNull(meetings.projectId),
    ))

  for (const m of meetingIds) {
    dalVerifySuccess(await meetingCrud.update(ctx, { id: m.id, data: { pipeline } }))
  }
}
