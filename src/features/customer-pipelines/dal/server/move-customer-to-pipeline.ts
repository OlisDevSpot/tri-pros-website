import type { MeetingPipeline } from '@/shared/constants/enums/pipelines'

import { and, eq, isNull } from 'drizzle-orm'

import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema/meetings'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'

/**
 * Moves all of a customer's non-project meetings to a target pipeline.
 * Only affects meetings with no projectId (project meetings stay in "projects" pipeline).
 *
 * Routes through `meetingCrud.update` so the entity's update hook fires
 * per row — `pipeline` isn't itself a GCal-affecting field, but the hook
 * also broadcasts an Ably refresh so open meeting cards repaint. The
 * caller (`customer-pipelines.router.ts:moveCustomerToPipeline`) gates
 * on `manage:CustomerPipeline` (super-admin only), so SYSTEM_CONTEXT is
 * appropriate here.
 */
export async function moveCustomerToPipeline(
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
    dalVerifySuccess(await meetingCrud.update(SYSTEM_CONTEXT, { id: m.id, data: { pipeline } }))
  }
}
