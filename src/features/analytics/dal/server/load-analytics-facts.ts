import type { AnalyticsFacts } from '@/features/analytics/types'
import type { DalReturn } from '@/shared/dal/server/types'

import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { listCustomerFacts } from '@/shared/entities/customers/dal/server/analytics-facts'
import { listMeetingFacts } from '@/shared/entities/meetings/dal/server/analytics-facts'
import { listSaleFacts } from '@/shared/modules/proposals/core/dal/server/analytics-facts'

export async function loadAnalyticsFacts(): Promise<DalReturn<AnalyticsFacts>> {
  return dalDbOperation(async () => {
    const [customers, meetings, sales] = await Promise.all([listCustomerFacts(), listMeetingFacts(), listSaleFacts()])
    return {
      customers: dalVerifySuccess(customers),
      meetings: dalVerifySuccess(meetings),
      sales: dalVerifySuccess(sales),
    }
  })
}
