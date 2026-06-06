'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { EnrolledLeadRow } from '@/features/campaigns-admin/ui/components/enrolled-lead-row'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { useTRPC } from '@/trpc/helpers'

interface EnrolledLeadsListProps {
  sourceSlug: string
}

/**
 * Active enrolled leads for a source with row + bulk Disqualify (the manual
 * "stop calling / bad lead" exit — decision #18). Bulk disqualify is confirmed.
 */
export function EnrolledLeadsList({ sourceSlug }: EnrolledLeadsListProps) {
  const trpc = useTRPC()
  const { disqualify, disqualifyBulk, removeFromCampaign } = useCampaignMutations()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [ConfirmBulkDialog, confirmBulk] = useConfirm({
    title: 'Disqualify selected leads?',
    message: 'They stop being called and are removed from the campaign. They can be re-enrolled later.',
  })

  const leadsQuery = useQuery(
    trpc.voipCampaignsRouter.listEnrolledLeads.queryOptions({ sourceSlug }),
  )

  const busy = disqualify.isPending || disqualifyBulk.isPending || removeFromCampaign.isPending

  function toggleSelect(customerId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(customerId)
      }
      else {
        next.delete(customerId)
      }
      return next
    })
  }

  async function handleBulkDisqualify() {
    const ok = await confirmBulk()
    if (!ok) {
      return
    }
    disqualifyBulk.mutate(
      { customerIds: [...selected] },
      { onSuccess: () => setSelected(new Set()) },
    )
  }

  if (leadsQuery.isLoading) {
    return <Skeleton className="h-24 w-full" />
  }

  const leads = leadsQuery.data ?? []
  if (leads.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border/50 px-3 py-6 text-center text-sm text-muted-foreground">
        No enrolled leads for this source.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <ConfirmBulkDialog />
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Enrolled leads
          {' '}
          <span className="tabular-nums">
            (
            {leads.length}
            )
          </span>
        </h3>
        {selected.size > 0 && (
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-xs"
            disabled={busy}
            onClick={handleBulkDisqualify}
          >
            Disqualify selected (
            {selected.size}
            )
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {leads.map(lead => (
          <EnrolledLeadRow
            key={lead.customerId}
            lead={lead}
            selected={selected.has(lead.customerId)}
            busy={busy}
            onToggleSelect={toggleSelect}
            onDisqualify={customerId => disqualify.mutate({ customerId })}
            onRemove={customerId => removeFromCampaign.mutate({ customerId })}
          />
        ))}
      </div>
    </div>
  )
}
