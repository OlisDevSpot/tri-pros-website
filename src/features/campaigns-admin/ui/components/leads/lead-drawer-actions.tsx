'use client'

import type { CampaignLeadRow } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'
import type { VoipCampaign } from '@/shared/entities/voip-campaigns/types'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { SwitchCampaignPopover } from '@/features/campaigns-admin/ui/components/leads/switch-campaign-popover'
import { Button } from '@/shared/components/ui/button'
import { useConfirm } from '@/shared/hooks/use-confirm'

export function LeadDrawerActions({ campaigns, row }: { campaigns: VoipCampaign[], row: CampaignLeadRow }) {
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
          <SwitchCampaignPopover campaigns={campaigns} currentCampaignId={row.campaignId} customerId={id} />
        )}
        {row.status === 'enrolled' && (
          <Button onClick={() => removeFromCampaign.mutate({ customerId: id })} size="sm" variant="outline">Remove</Button>
        )}
        {row.status !== 'dnc' && (
          <Button
            className="text-warning"
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
                className="text-destructive"
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
