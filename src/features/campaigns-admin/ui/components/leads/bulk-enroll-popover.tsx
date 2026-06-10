'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { useTRPC } from '@/trpc/helpers'

interface BulkEnrollPopoverProps {
  onDone: () => void
  selectedIds: string[]
}

export function BulkEnrollPopover({ onDone, selectedIds }: BulkEnrollPopoverProps) {
  const trpc = useTRPC()
  const { enrollSelected } = useCampaignMutations()
  const { data } = useQuery(trpc.voipCampaignsRouter.listCampaigns.queryOptions())
  const campaigns = data ?? []
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
