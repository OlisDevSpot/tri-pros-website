'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { useTRPC } from '@/trpc/helpers'

interface SwitchCampaignPopoverProps {
  currentCampaignId: string | null
  customerId: string
}

export function SwitchCampaignPopover({ currentCampaignId, customerId }: SwitchCampaignPopoverProps) {
  const trpc = useTRPC()
  const { switchCampaign } = useCampaignMutations()
  const [open, setOpen] = useState(false)
  const [toCampaignId, setToCampaignId] = useState<string | null>(null)
  const { data } = useQuery(trpc.voipCampaignsRouter.listCampaigns.queryOptions())
  const campaigns = (data ?? []).filter(c => c.id !== currentCampaignId)

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">Switch campaign</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-72 flex-col gap-3">
        <Select onValueChange={setToCampaignId} value={toCampaignId ?? undefined}>
          <SelectTrigger><SelectValue placeholder="Move to…" /></SelectTrigger>
          <SelectContent>
            {campaigns.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.ctCampaignName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
