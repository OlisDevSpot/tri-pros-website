'use client'

import type { VoipCampaign } from '@/shared/entities/voip-campaigns/types'

import { useState } from 'react'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { CampaignSelect } from '@/features/campaigns-admin/ui/components/shared/campaign-select'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'

interface EnrollAllPopoverProps {
  campaigns: VoipCampaign[]
  defaultCampaignId: string | null
  eligibleCount: number
  sourceSlug: string
}

export function EnrollAllPopover({ campaigns, defaultCampaignId, eligibleCount, sourceSlug }: EnrollAllPopoverProps) {
  const { enrollAll } = useCampaignMutations()
  const [campaignId, setCampaignId] = useState<string | null>(defaultCampaignId)
  const [open, setOpen] = useState(false)

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
        <CampaignSelect
          campaigns={campaigns}
          onChange={setCampaignId}
          value={campaignId ?? undefined}
        />
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
