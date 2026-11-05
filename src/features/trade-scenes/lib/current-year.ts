import { businessToday } from '@/shared/lib/business-time'

// Pacific time, so the year turns when the business's does.
export function currentYear(): number {
  return Number(businessToday().slice(0, 4))
}
