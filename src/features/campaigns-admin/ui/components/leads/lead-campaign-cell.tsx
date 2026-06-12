'use client'

import type { LeadTableRow } from '@/features/campaigns-admin/ui/lib/leads-columns'
import type { VoipCampaign } from '@/shared/entities/voip-campaigns/types'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { CampaignSelect } from '@/features/campaigns-admin/ui/components/shared/campaign-select'

interface LeadCampaignCellProps {
  campaigns: VoipCampaign[]
  row: LeadTableRow
}

export function LeadCampaignCell({ campaigns, row }: LeadCampaignCellProps) {
  const { enroll, switchCampaign, removeFromCampaign } = useCampaignMutations()
  const isEnrolled = row.status === 'enrolled'

  function handleChange(next: string) {
    if (isEnrolled) {
      switchCampaign.mutate({ customerId: row.customerId, toCampaignId: next })
      return
    }
    enroll.mutate({ customerId: row.customerId, campaignId: next })
  }

  return (
    <CampaignSelect
      campaigns={campaigns}
      onChange={handleChange}
      onRemove={isEnrolled ? () => removeFromCampaign.mutate({ customerId: row.customerId }) : undefined}
      placeholder="—"
      triggerClassName="h-8 w-44 text-sm"
      value={row.campaignId ?? undefined}
    />
  )
}
