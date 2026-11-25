import { formatBusinessTime } from '@/shared/lib/business-time'

export function formatCustomerSince(createdAt: string | Date): string {
  return `Customer since ${formatBusinessTime(createdAt, { month: 'short', year: 'numeric' })}`
}
