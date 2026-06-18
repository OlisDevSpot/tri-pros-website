'use client'

import { useQuery } from '@tanstack/react-query'
import { RefreshCwIcon } from 'lucide-react'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { useTRPC } from '@/trpc/helpers'

/**
 * Read-only readout of the CloudTalk campaigns we've synced, plus the Resync
 * trigger. Campaigns are pools (no source column here) — the source→campaign
 * binding lives in the per-source policy table. CT status uses a quiet dot +
 * label, not a primary badge, to keep the single primary moment for "Live"
 * sources in the policy table. see docs/ui-design-playbook.md
 */
export function SyncedCampaignsCard() {
  const trpc = useTRPC()
  const { resync } = useCampaignMutations()

  const campaignsQuery = useQuery(trpc.voipCampaignsRouter.listCampaigns.queryOptions())
  const campaigns = campaignsQuery.data ?? []

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground">Synced campaigns</h2>
          <CardDescription>Pulled from CloudTalk. Resync after adding a campaign there.</CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-2"
          disabled={resync.isPending}
          onClick={() => resync.mutate()}
        >
          <RefreshCwIcon aria-hidden="true" className={resync.isPending ? 'size-4 motion-safe:animate-spin' : 'size-4'} />
          {resync.isPending ? 'Resyncing…' : 'Resync'}
        </Button>
      </CardHeader>
      <CardContent>
        {campaignsQuery.isLoading
          ? <Skeleton className="h-24 w-full" />
          : campaigns.length === 0
            ? (
                <p className="py-4 text-sm text-muted-foreground">
                  No campaigns synced yet. Resync to pull them from CloudTalk.
                </p>
              )
            : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Membership tag</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((campaign) => {
                      const isActive = campaign.ctStatus === 'active'
                      return (
                        <TableRow key={campaign.id}>
                          <TableCell className="font-medium text-foreground">{campaign.ctCampaignName}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5 text-sm">
                              <span
                                aria-hidden="true"
                                className={isActive ? 'size-1.5 rounded-full bg-success' : 'size-1.5 rounded-full bg-muted-foreground/40'}
                              />
                              <span className={isActive ? 'text-foreground' : 'text-muted-foreground'}>
                                {isActive ? 'Active' : 'Inactive'}
                              </span>
                            </span>
                          </TableCell>
                          <TableCell>
                            <code translate="no" className="font-mono text-xs text-muted-foreground">{campaign.ctMembershipTag}</code>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
      </CardContent>
    </Card>
  )
}
