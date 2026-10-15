'use client'

import type { CustomerWithProfile } from '@/shared/entities/customers/dal/server/queries'

import { Badge } from '@/shared/components/ui/badge'

export type KeyInsightField = 'triggerEvent' | 'decisionTimeline' | 'outcomePriority' | 'householdType' | 'timeInHome' | 'yearBuilt'

interface Props {
  customer: Pick<CustomerWithProfile, KeyInsightField> | null | undefined
  fields?: readonly KeyInsightField[]
}

function formatInsight(field: KeyInsightField, value: string): string {
  switch (field) {
    case 'outcomePriority':
      return `Priority: ${value}`
    case 'timeInHome':
      return `${value} in home`
    case 'yearBuilt':
      return `Built ${value}`
    default:
      return value
  }
}

export function CustomerProfileKeyInsights({ customer, fields = ['triggerEvent', 'decisionTimeline', 'outcomePriority', 'householdType'] }: Props) {
  if (!customer) {
    return null
  }

  const insights = fields.flatMap((field) => {
    const value = customer[field]
    return value != null ? [formatInsight(field, String(value))] : []
  })

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
