'use client'

import type { AppRouterOutputs } from '@/trpc/routers/app'

import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { EnrolledLeadsList } from '@/features/campaigns-admin/ui/components/enrolled-leads-list'
import { Button } from '@/shared/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { useTRPC } from '@/trpc/helpers'

type SourceSummary = AppRouterOutputs['voipCampaignsRouter']['getSourceCampaignSummaries'][number]

interface SourceEnrollmentPanelProps {
  summary: SourceSummary
}

/**
 * Per-source enrollment controls: campaign picker (default pre-selected) +
 * Enroll all (background batch) + Unenroll all (confirmed) + the enrolled-leads
 * list with disqualify.
 */
export function SourceEnrollmentPanel({ summary }: SourceEnrollmentPanelProps) {
  const trpc = useTRPC()
  const { enrollAll, unenrollAll } = useCampaignMutations()

  const campaignsQuery = useQuery(trpc.voipCampaignsRouter.listCampaigns.queryOptions())

  // Campaigns bound to this source — the enrollment targets.
  const boundCampaigns = useMemo(
    () => (campaignsQuery.data ?? []).filter(c => c.sourceSlug === summary.sourceSlug),
    [campaignsQuery.data, summary.sourceSlug],
  )

  // Default the picker to the source's default campaign, else the first bound.
  const initialCampaignId = summary.defaultCampaignId ?? boundCampaigns[0]?.id ?? ''
  const [campaignId, setCampaignId] = useState(initialCampaignId)
  // Keep the picker valid as bound campaigns load in.
  const selectedCampaignId = boundCampaigns.some(c => c.id === campaignId)
    ? campaignId
    : (initialCampaignId || boundCampaigns[0]?.id || '')

  const [ConfirmUnenrollDialog, confirmUnenroll] = useConfirm({
    title: 'Unenroll all leads from this source?',
    message: 'Every actively-enrolled lead for this source stops being called. They can be re-enrolled later.',
  })

  async function handleUnenrollAll() {
    const ok = await confirmUnenroll()
    if (!ok) {
      return
    }
    unenrollAll.mutate({ sourceSlug: summary.sourceSlug })
  }

  const hasBoundCampaign = boundCampaigns.length > 0

  return (
    <div className="flex flex-col gap-5">
      <ConfirmUnenrollDialog />

      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">{summary.name}</h2>
        <p className="text-xs text-muted-foreground">
          <span className="tabular-nums">{summary.enrolledCount}</span>
          {' '}
          enrolled ·
          {' '}
          <span className="tabular-nums">{summary.eligibleCount}</span>
          {' '}
          eligible
        </p>
      </header>

      {hasBoundCampaign
        ? (
            <section className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Campaign
                </span>
                <Select value={selectedCampaignId} onValueChange={setCampaignId}>
                  <SelectTrigger className="h-9 w-56 text-sm">
                    <SelectValue placeholder="Select a campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {boundCampaigns.map(campaign => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.ctCampaignName}
                        {campaign.id === summary.defaultCampaignId ? ' (default)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="h-9"
                disabled={!selectedCampaignId || enrollAll.isPending}
                onClick={() => enrollAll.mutate({ sourceSlug: summary.sourceSlug, campaignId: selectedCampaignId })}
              >
                {enrollAll.isPending ? 'Queuing…' : 'Enroll all eligible'}
              </Button>
              <Button
                variant="outline"
                className="h-9"
                disabled={summary.enrolledCount === 0 || unenrollAll.isPending}
                onClick={handleUnenrollAll}
              >
                {unenrollAll.isPending ? 'Unenrolling…' : 'Unenroll all'}
              </Button>
            </section>
          )
        : (
            <p className="rounded-md border border-dashed border-border/50 px-3 py-4 text-sm text-muted-foreground">
              No campaign bound to this source yet. Bind one in the CloudTalk Sync table above to enable enrollment.
            </p>
          )}

      <EnrolledLeadsList sourceSlug={summary.sourceSlug} />
    </div>
  )
}
