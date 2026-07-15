'use client'

import type { CustomerWithProfile } from '@/shared/entities/customers/dal/server/queries'

import { Badge } from '@/shared/components/ui/badge'

interface Props {
  customer: Pick<CustomerWithProfile, 'triggerEvent' | 'decisionTimeline' | 'outcomePriority' | 'householdType'> | null | undefined
}

export function CustomerProfileKeyInsights({ customer }: Props) {
  if (!customer) {
    return null
  }

  const insights = [
    customer.triggerEvent != null && String(customer.triggerEvent),
    customer.decisionTimeline != null && String(customer.decisionTimeline),
    customer.outcomePriority != null && `Priority: ${String(customer.outcomePriority)}`,
    customer.householdType != null && String(customer.householdType),
  ].filter(Boolean) as string[]

  if (insights.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {insights.map(insight => (
        <Badge key={insight} variant="secondary" className="text-xs">
          {insight}
        </Badge>
      ))}
    </div>
  )
}
