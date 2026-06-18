'use client'

import { useQuery } from '@tanstack/react-query'
import { RefreshCwIcon } from 'lucide-react'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { SourcePolicyRow } from '@/features/campaigns-admin/ui/components/setup/source-policy-row'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { useTRPC } from '@/trpc/helpers'

/**
 * CloudTalk identity + per-source policy panel. Resync button, then a read-only
 * synced-campaigns readout (campaigns are pools — no source column), then the
 * editable per-source policy table (default campaign + enabled + autoEnroll).
 * Lives at the top of the Campaigns Control Center.
 */
export function CloudtalkSyncCard() {
  const trpc = useTRPC()
  const { resync, setSourcePolicy } = useCampaignMutations()

  const campaignsQuery = useQuery(trpc.voipCampaignsRouter.listCampaigns.queryOptions())
  const summariesQuery = useQuery(trpc.voipCampaignsRouter.getSourceCampaignSummaries.queryOptions())

  const campaigns = campaignsQuery.data ?? []
  const summaries = summariesQuery.data ?? []

  const busy = resync.isPending || setSourcePolicy.isPending

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">CloudTalk Sync &amp; Per-Source Policy</CardTitle>
          <CardDescription>
            Pull campaigns from CloudTalk, then set each lead source&apos;s default campaign, enable VoIP, and auto-enroll.
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
      <CardContent className="flex flex-col gap-6">
        {/* ── Synced campaigns (read-only) ─────────────────────────────── */}
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-foreground">Synced campaigns</h3>
          {campaignsQuery.isLoading
            ? <Skeleton className="h-24 w-full" />
            : campaigns.length === 0
              ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No campaigns synced yet. Run Resync to pull campaigns from CloudTalk.
                  </p>
                )
              : (
                  <div aria-label="Synced campaigns" className="overflow-x-auto" role="region" tabIndex={0}>
                    <Table className="min-w-120">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campaign</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Membership tag</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {campaigns.map(campaign => (
                          <TableRow key={campaign.id}>
                            <TableCell className="font-medium text-foreground">{campaign.ctCampaignName}</TableCell>
                            <TableCell>
                              <Badge variant={campaign.ctStatus === 'active' ? 'default' : 'secondary'}>
                                {campaign.ctStatus === 'active' ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{campaign.ctMembershipTag}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
        </section>

        {/* ── Per-source policy (editable) ─────────────────────────────── */}
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-foreground">Per-source policy</h3>
          {summariesQuery.isLoading
            ? <Skeleton className="h-24 w-full" />
            : summaries.length === 0
              ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">No lead sources found.</p>
                )
              : (
                  <div aria-label="Per-source policy" className="overflow-x-auto" role="region" tabIndex={0}>
                    <Table className="min-w-160">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source</TableHead>
                          <TableHead>Default campaign</TableHead>
                          <TableHead>Enabled</TableHead>
                          <TableHead>Auto-enroll</TableHead>
                          <TableHead>Eligible / Enrolled</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summaries.map(source => (
                          <SourcePolicyRow
                            key={source.sourceSlug}
                            source={source}
                            campaigns={campaigns}
                            busy={busy}
                            onPatch={(sourceSlug, patch) => setSourcePolicy.mutate({ sourceSlug, patch })}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
        </section>
      </CardContent>
    </Card>
  )
}
