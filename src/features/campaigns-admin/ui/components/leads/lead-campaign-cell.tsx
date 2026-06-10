'use client'

import type { LeadTableRow } from '@/features/campaigns-admin/ui/lib/leads-columns'

import { useQuery } from '@tanstack/react-query'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { useTRPC } from '@/trpc/helpers'

const REMOVE_VALUE = '__remove__'

export function LeadCampaignCell({ row }: { row: LeadTableRow }) {
  const trpc = useTRPC()
  const { enroll, switchCampaign, removeFromCampaign } = useCampaignMutations()
  const { data } = useQuery(trpc.voipCampaignsRouter.listCampaigns.queryOptions())
  const campaigns = data ?? []

  const isEnrolled = row.status === 'enrolled'
  const current = row.campaignId ?? undefined

  function handleChange(next: string) {
    if (next === REMOVE_VALUE) {
      removeFromCampaign.mutate({ customerId: row.customerId })
      return
    }
    if (isEnrolled) {
      switchCampaign.mutate({ customerId: row.customerId, toCampaignId: next })
      return
    }
    enroll.mutate({ customerId: row.customerId, campaignId: next })
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className="h-8 w-44 text-sm">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {campaigns.map(c => (
          <SelectItem key={c.id} value={c.id}>{c.ctCampaignName}</SelectItem>
        ))}
        {isEnrolled && (
          <SelectItem value={REMOVE_VALUE}>Remove from campaign</SelectItem>
        )}
      </SelectContent>
    </Select>
  )
}
