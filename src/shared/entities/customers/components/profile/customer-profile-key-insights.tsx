'use client'

import type { CustomerWithProfile } from '@/shared/entities/customers/dal/server/queries'

import { Badge } from '@/shared/components/ui/badge'

const KEY_INSIGHT_FIELDS = ['triggerEvent', 'decisionTimeline', 'outcomePriority', 'householdType'] as const

type KeyInsightField = (typeof KEY_INSIGHT_FIELDS)[number]

interface Props {
  customer: Pick<CustomerWithProfile, KeyInsightField> | null | undefined
}

function formatInsight(field: KeyInsightField, value: string): string {
  return field === 'outcomePriority' ? `Priority: ${value}` : value
}

export function CustomerProfileKeyInsights({ customer }: Props) {
  if (!customer) {
    return null
  }

  const insights = KEY_INSIGHT_FIELDS.flatMap((field) => {
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
