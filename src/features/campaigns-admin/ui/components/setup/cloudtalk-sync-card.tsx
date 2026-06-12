'use client'

import { useQuery } from '@tanstack/react-query'
import { RefreshCwIcon } from 'lucide-react'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { CampaignBindingRow } from '@/features/campaigns-admin/ui/components/setup/campaign-binding-row'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { useTRPC } from '@/trpc/helpers'

/**
 * Global CloudTalk identity panel: a Resync button + the synced-campaigns
 * table with a per-source "set as default" control for each campaign.
 * Lives at the top of the Campaigns Control Center.
 */
export function CloudtalkSyncCard() {
  const trpc = useTRPC()
  const { resync, setDefaultCampaign } = useCampaignMutations()

  const campaignsQuery = useQuery(trpc.voipCampaignsRouter.listCampaigns.queryOptions())
  const summariesQuery = useQuery(trpc.voipCampaignsRouter.getSourceCampaignSummaries.queryOptions())

  const campaigns = campaignsQuery.data ?? []
  const summaries = summariesQuery.data ?? []
  const sourceOptions = summaries.map(s => ({ sourceSlug: s.sourceSlug, name: s.name }))
  // sourceSlug → its default campaign id (to render the per-row default switch).
  const defaultBySlug = new Map(summaries.map(s => [s.sourceSlug, s.defaultCampaignId]))

  const busy = resync.isPending || setDefaultCampaign.isPending

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">CloudTalk Sync &amp; Campaigns</CardTitle>
          <CardDescription>
            Pull campaigns from CloudTalk, then pick a source to set each campaign as its default.
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          disabled={resync.isPending}
          onClick={() => resync.mutate()}
        >
          <RefreshCwIcon aria-hidden="true" className={resync.isPending ? 'size-4 animate-spin' : 'size-4'} />
          {resync.isPending ? 'Resyncing…' : 'Resync from CloudTalk'}
        </Button>
      </CardHeader>
      <CardContent>
        {campaignsQuery.isLoading
          ? <Skeleton className="h-32 w-full" />
          : campaigns.length === 0
            ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No campaigns synced yet. Run Resync to pull campaigns from CloudTalk.
                </p>
              )
            : (
                <div aria-label="Synced campaigns" className="overflow-x-auto" role="region" tabIndex={0}>
                  <Table className="min-w-160">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Membership tag</TableHead>
                        <TableHead>Source (for default)</TableHead>
                        <TableHead>Default</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns.map(campaign => (
                        <CampaignBindingRow
                          key={campaign.id}
                          campaign={campaign}
                          sources={sourceOptions}
                          defaultBySlug={defaultBySlug}
                          busy={busy}
                          onToggleDefault={(sourceSlug, campaignId, makeDefault) =>
                            setDefaultCampaign.mutate({ sourceSlug, campaignId: makeDefault ? campaignId : null })}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
      </CardContent>
    </Card>
  )
}
