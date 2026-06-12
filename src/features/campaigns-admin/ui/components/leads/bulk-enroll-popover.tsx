'use client'

import type { VoipCampaign } from '@/shared/entities/voip-campaigns/types'

import { useState } from 'react'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { CampaignSelect } from '@/features/campaigns-admin/ui/components/shared/campaign-select'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'

interface BulkEnrollPopoverProps {
  campaigns: VoipCampaign[]
  onDone: () => void
  selectedIds: string[]
}

export function BulkEnrollPopover({ campaigns, onDone, selectedIds }: BulkEnrollPopoverProps) {
  const { enrollSelected } = useCampaignMutations()
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
        >
          {`Enroll selected (${selectedIds.length})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="flex w-72 flex-col gap-3"
      >
        <p className="text-sm font-medium">Enroll into campaign</p>
        <CampaignSelect
          campaigns={campaigns}
          onChange={setCampaignId}
          value={campaignId ?? undefined}
        />
        <Button
          disabled={!campaignId || enrollSelected.isPending}
          size="sm"
          onClick={() => {
            if (!campaignId) {
              return
            }

            enrollSelected.mutate(
              { campaignId, customerIds: selectedIds },
              {
                onSuccess: () => {
                  setOpen(false)
                  onDone()
                },
              },
            )
          }}
        >
          {enrollSelected.isPending ? 'Enrolling…' : 'Enroll'}
        </Button>
      </PopoverContent>
    </Popover>
  )
}
