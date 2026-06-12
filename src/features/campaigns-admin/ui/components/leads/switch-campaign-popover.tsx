'use client'

import type { VoipCampaign } from '@/shared/entities/voip-campaigns/types'

import { useState } from 'react'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { CampaignSelect } from '@/features/campaigns-admin/ui/components/shared/campaign-select'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'

interface SwitchCampaignPopoverProps {
  campaigns: VoipCampaign[]
  currentCampaignId: string | null
  customerId: string
}

export function SwitchCampaignPopover({ campaigns, currentCampaignId, customerId }: SwitchCampaignPopoverProps) {
  const { switchCampaign } = useCampaignMutations()
  const [open, setOpen] = useState(false)
  const [toCampaignId, setToCampaignId] = useState<string | null>(null)

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">Switch campaign</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-72 flex-col gap-3">
        <CampaignSelect
          campaigns={campaigns}
          excludeId={currentCampaignId}
          onChange={setToCampaignId}
          placeholder="Move to…"
          value={toCampaignId ?? undefined}
        />
        <Button
          disabled={!toCampaignId || switchCampaign.isPending}
          onClick={() => {
            if (toCampaignId) {
              switchCampaign.mutate({ customerId, toCampaignId }, { onSuccess: () => setOpen(false) })
            }
          }}
          size="sm"
        >
          {switchCampaign.isPending ? 'Moving…' : 'Move'}
        </Button>
      </PopoverContent>
    </Popover>
  )
}
