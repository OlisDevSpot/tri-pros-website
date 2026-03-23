'use client'

import type { CustomerProfileData } from '@/features/customer-pipelines/types'

import { CalendarIcon, DollarSignIcon, EyeIcon, FileTextIcon } from 'lucide-react'

import { CustomerProfileDetails } from '@/features/customer-pipelines/ui/components/customer-profile-details'
import { CustomerRecordingPlayer } from '@/features/customer-pipelines/ui/components/customer-recording-player'
import { StatCard } from '@/features/customer-pipelines/ui/components/stat-card'

interface Props {
  data: CustomerProfileData
}

export function CustomerProfileOverview({ data }: Props) {
  const totalValue = data.allProposals.reduce((sum, p) => sum + (p.value ?? 0), 0)
  const totalViews = data.allProposals.reduce((sum, p) => sum + p.viewCount, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={CalendarIcon} label="Meetings" value={data.meetings.length} />
        <StatCard icon={FileTextIcon} label="Proposals" value={data.allProposals.length} />
        <StatCard icon={DollarSignIcon} label="Total Value" value={`$${totalValue.toLocaleString()}`} />
        <StatCard icon={EyeIcon} label="Total Views" value={totalViews} />
      </div>

      <CustomerRecordingPlayer customerId={data.customer.id} />
      <CustomerProfileDetails customer={data.customer} />
    </div>
  )
}
