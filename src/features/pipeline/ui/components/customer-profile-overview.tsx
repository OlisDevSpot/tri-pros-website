'use client'

import type { CustomerProfileData } from '@/features/pipeline/types'

import { CalendarIcon, DollarSignIcon, EyeIcon, FileTextIcon } from 'lucide-react'

import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent } from '@/shared/components/ui/card'

interface Props {
  data: CustomerProfileData
}

export function CustomerProfileOverview({ data }: Props) {
  const totalValue = data.allProposals.reduce((sum, p) => sum + (p.value ?? 0), 0)
  const totalViews = data.allProposals.reduce((sum, p) => sum + p.viewCount, 0)
  const profile = data.customer.customerProfileJSON as Record<string, unknown> | null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={CalendarIcon} label="Meetings" value={data.meetings.length} />
        <StatCard icon={FileTextIcon} label="Proposals" value={data.allProposals.length} />
        <StatCard icon={DollarSignIcon} label="Total Value" value={`$${totalValue.toLocaleString()}`} />
        <StatCard icon={EyeIcon} label="Total Views" value={totalViews} />
      </div>

      {profile && Object.keys(profile).length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Key Insights</p>
          <div className="flex flex-wrap gap-2">
            {profile.triggerEvent != null && (
              <Badge variant="secondary">{String(profile.triggerEvent)}</Badge>
            )}
            {profile.decisionTimeline != null && (
              <Badge variant="secondary">{String(profile.decisionTimeline)}</Badge>
            )}
            {profile.decisionUrgencyRating != null && (
              <Badge variant="secondary">
                {`Urgency: ${String(profile.decisionUrgencyRating)}`}
              </Badge>
            )}
            {profile.outcomePriority != null && (
              <Badge variant="secondary">
                {`Priority: ${String(profile.outcomePriority)}`}
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: typeof CalendarIcon, label: string, value: string | number }) {
  return (
    <Card>
      <CardContent className="py-3 px-4 flex items-center gap-3">
        <Icon size={18} className="text-muted-foreground shrink-0" />
        <div>
          <p className="text-lg font-bold leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}
