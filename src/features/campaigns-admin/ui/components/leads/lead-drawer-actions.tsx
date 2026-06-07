'use client'

import type { CampaignLeadRow } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { SwitchCampaignPopover } from '@/features/campaigns-admin/ui/components/leads/switch-campaign-popover'
import { Button } from '@/shared/components/ui/button'
import { useConfirm } from '@/shared/hooks/use-confirm'

export function LeadDrawerActions({ row }: { row: CampaignLeadRow }) {
  const { disqualify, enroll, markDnc, removeDnc, removeFromCampaign } = useCampaignMutations()
  const [ConfirmDialog, confirm] = useConfirm({ message: 'Apply this action to the lead?', title: 'Confirm' })
  const id = row.customerId

  return (
    <>
      <ConfirmDialog />
      <div className="flex flex-wrap gap-2">
        {row.status === 'eligible' && (
          <Button onClick={() => enroll.mutate({ customerId: id })} size="sm">Enroll</Button>
        )}
        {row.status === 'removed' && (
          <Button onClick={() => enroll.mutate({ customerId: id })} size="sm">Re-enroll</Button>
        )}
        {row.status === 'enrolled' && (
          <SwitchCampaignPopover currentCampaignId={row.campaignId} customerId={id} />
        )}
        {row.status === 'enrolled' && (
          <Button onClick={() => removeFromCampaign.mutate({ customerId: id })} size="sm" variant="outline">Remove</Button>
        )}
        {row.status !== 'dnc' && (
          <Button
            className="text-amber-700 dark:text-amber-400"
            onClick={async () => {
              if (await confirm()) {
                disqualify.mutate({ customerId: id })
              }
            }}
            size="sm"
            variant="ghost"
          >
            Disqualify
          </Button>
        )}
        {row.status !== 'dnc'
          ? (
              <Button
                className="text-red-600"
                onClick={async () => {
                  if (await confirm()) {
                    markDnc.mutate({ customerIds: [id] })
                  }
                }}
                size="sm"
                variant="ghost"
              >
                Mark DNC
              </Button>
            )
          : (
              <Button onClick={() => removeDnc.mutate({ customerId: id })} size="sm" variant="outline">Clear DNC</Button>
            )}
      </div>
    </>
  )
}
