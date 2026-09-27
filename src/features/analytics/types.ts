import type { CustomerFact } from '@/shared/entities/customers/dal/server/analytics-facts'
import type { MeetingFact } from '@/shared/entities/meetings/dal/server/analytics-facts'
import type { SaleFact } from '@/shared/modules/proposals/core/dal/server/analytics-facts'

export interface AnalyticsFacts {
  customers: CustomerFact[]
  meetings: MeetingFact[]
  sales: SaleFact[]
}
