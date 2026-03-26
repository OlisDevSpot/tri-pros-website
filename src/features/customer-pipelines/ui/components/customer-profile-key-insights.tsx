'use client'

import type { CustomerProfile } from '@/shared/entities/customers/schemas'

import { Badge } from '@/shared/components/ui/badge'

interface Props {
  profile: CustomerProfile | null | undefined
}

export function CustomerProfileKeyInsights({ profile }: Props) {
  if (!profile || Object.keys(profile).length === 0) {
    return null
  }

  const insights = [
    profile.triggerEvent != null && String(profile.triggerEvent),
    profile.decisionTimeline != null && String(profile.decisionTimeline),
    profile.outcomePriority != null && `Priority: ${String(profile.outcomePriority)}`,
    profile.householdType != null && String(profile.householdType),
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
