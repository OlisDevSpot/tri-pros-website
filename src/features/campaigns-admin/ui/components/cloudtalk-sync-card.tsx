'use client'

import { useQuery } from '@tanstack/react-query'
import { RefreshCwIcon } from 'lucide-react'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { CampaignBindingRow } from '@/features/campaigns-admin/ui/components/campaign-binding-row'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { useTRPC } from '@/trpc/helpers'

/**
 * Global CloudTalk identity panel: a Resync button + the synced-campaigns
 * binding table (bind each campaign to a lead source, mark a source's default).
 * Lives at the top of the Campaigns Control Center.
 */
export function CloudtalkSyncCard() {
  const trpc = useTRPC()
  const { resync, bindCampaignToSource, setDefaultCampaign } = useCampaignMutations()

  const campaignsQuery = useQuery(trpc.voipCampaignsRouter.listCampaigns.queryOptions())
  const summariesQuery = useQuery(trpc.voipCampaignsRouter.getSourceCampaignSummaries.queryOptions())

  const campaigns = campaignsQuery.data ?? []
  const summaries = summariesQuery.data ?? []
  const sourceOptions = summaries.map(s => ({ sourceSlug: s.sourceSlug, name: s.name }))
  // sourceSlug → its default campaign id (to render the per-row default switch).
  const defaultBySlug = new Map(summaries.map(s => [s.sourceSlug, s.defaultCampaignId]))

  const busy = resync.isPending || bindCampaignToSource.isPending || setDefaultCampaign.isPending

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">CloudTalk Sync &amp; Binding</CardTitle>
          <CardDescription>
            Pull campaigns from CloudTalk, then bind each to a lead source and pick its default.
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          disabled={resync.isPending}
          onClick={() => resync.mutate()}
        >
          <RefreshCwIcon className={resync.isPending ? 'size-4 animate-spin' : 'size-4'} />
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Membership tag</TableHead>
                      <TableHead>Lead source</TableHead>
                      <TableHead>Default</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map(campaign => (
                      <CampaignBindingRow
                        key={campaign.id}
                        campaign={campaign}
                        sources={sourceOptions}
                        isDefault={
                          campaign.sourceSlug != null
                          && defaultBySlug.get(campaign.sourceSlug) === campaign.id
                        }
                        busy={busy}
                        onBind={(campaignId, sourceSlug) =>
                          bindCampaignToSource.mutate({ campaignId, sourceSlug })}
                        onToggleDefault={(sourceSlug, campaignId, makeDefault) =>
                          setDefaultCampaign.mutate({ sourceSlug, campaignId: makeDefault ? campaignId : null })}
                      />
                    ))}
                  </TableBody>
                </Table>
              )}
      </CardContent>
    </Card>
  )
}
