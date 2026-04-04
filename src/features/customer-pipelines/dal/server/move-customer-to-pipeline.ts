import type { MeetingPipeline } from '@/shared/types/enums/pipelines'

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema/meetings'

/**
 * Moves all of a customer's non-project meetings to a target pipeline.
 * Only affects meetings with no projectId (project meetings stay in "projects" pipeline).
 */
export async function moveCustomerToPipeline(
  customerId: string,
  pipeline: MeetingPipeline,
): Promise<void> {
  await db
    .update(meetings)
    .set({ pipeline })
    .where(and(
      eq(meetings.customerId, customerId),
      isNull(meetings.projectId),
    ))
}
