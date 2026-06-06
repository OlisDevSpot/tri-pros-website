import type { DalReturn } from '@/shared/dal/server/types'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { binaWebhookLogs } from '@/shared/db/schema'

export async function insertBinaWebhookLog(input: {
  ghlEventType: string
  ghlResourceId: string | null
  payload: Record<string, unknown>
}): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    await db.insert(binaWebhookLogs).values({
      ghlEventType: input.ghlEventType,
      ghlLocationId: null,
      ghlResourceId: input.ghlResourceId,
      payload: input.payload,
      matchedTrades: null,
      processedAt: null,
    })
  })
}
