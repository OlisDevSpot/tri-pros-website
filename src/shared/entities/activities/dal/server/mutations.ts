import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { InsertActivity } from '@/shared/db/schema'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { activities } from '@/shared/db/schema'

export async function createActivity(_ctx: ScopedContext, input: InsertActivity): Promise<DalReturn<typeof activities.$inferSelect>> {
  return dalDbOperation(async () => {
    const [created] = await db.insert(activities).values(input).returning()
    if (!created) {
      throw new ThrowableDalError({ type: 'create-failed' })
    }
    return created
  })
}
