'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { useTRPC } from '@/trpc/helpers'

interface EnrollAllPopoverProps {
  defaultCampaignId: string | null
  eligibleCount: number
  sourceSlug: string
}

export function EnrollAllPopover({ defaultCampaignId, eligibleCount, sourceSlug }: EnrollAllPopoverProps) {
  const trpc = useTRPC()
  const { enrollAll } = useCampaignMutations()
  const [campaignId, setCampaignId] = useState<string | null>(defaultCampaignId)
  const [open, setOpen] = useState(false)

  const { data } = useQuery(trpc.voipCampaignsRouter.listCampaigns.queryOptions())
  const campaigns = data ?? []

  const disabled = eligibleCount === 0

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        <Button
          className="w-full"
          disabled={disabled}
          size="sm"
        >
          {`Enroll all eligible (${eligibleCount})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="flex w-72 flex-col gap-3"
      >
        <p className="text-sm font-medium">Pick a campaign</p>
        <Select
          value={campaignId ?? undefined}
          onValueChange={setCampaignId}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select campaign…" />
          </SelectTrigger>
          <SelectContent>
            {campaigns.map(c => (
              <SelectItem
                key={c.id}
                value={c.id}
              >
                {c.ctCampaignName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          disabled={!campaignId || enrollAll.isPending}
          size="sm"
          onClick={() => {
            if (!campaignId) {
              return
            }

            enrollAll.mutate({ campaignId, sourceSlug })
            setOpen(false)
          }}
        >
          {enrollAll.isPending ? 'Queuing…' : 'Enroll all'}
        </Button>
      </PopoverContent>
    </Popover>
  )
}
