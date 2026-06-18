'use client'

import { useQuery } from '@tanstack/react-query'
import { SearchIcon } from 'lucide-react'
import { useState } from 'react'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { SourcePolicyRow } from '@/features/campaigns-admin/ui/components/setup/source-policy-row'
import { Card, CardContent, CardDescription, CardHeader } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { useTRPC } from '@/trpc/helpers'

/**
 * Editable per-source policy table — the surface that grows. Default campaign +
 * Enabled + Auto-enroll per lead source, with a name search and a sticky header
 * (sticks within the Setup tab's single scroll region — no nested scroll). A
 * source is "Live" when enabled + auto-enroll + a default are all set; that is
 * the tab's one primary-color moment. see docs/ui-design-playbook.md
 */
export function SourcePolicyCard() {
  const trpc = useTRPC()
  const { setSourcePolicy } = useCampaignMutations()
  const [query, setQuery] = useState('')

  const campaignsQuery = useQuery(trpc.voipCampaignsRouter.listCampaigns.queryOptions())
  const summariesQuery = useQuery(trpc.voipCampaignsRouter.getSourceCampaignSummaries.queryOptions())
  const campaigns = campaignsQuery.data ?? []
  const summaries = summariesQuery.data ?? []

  const normalized = query.trim().toLowerCase()
  const visible = normalized
    ? summaries.filter(source => source.name.toLowerCase().includes(normalized))
    : summaries

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground">Per-source policy</h2>
          <CardDescription>
            Set each source&apos;s default campaign, enable VoIP, and arm auto-enroll. A source goes
            {' '}
            <span className="font-medium text-foreground">Live</span>
            {' '}
            when it is enabled, auto-enroll is on, and a default campaign is set.
          </CardDescription>
        </div>
        <div className="relative w-full sm:w-64">
          <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search sources…"
            aria-label="Search lead sources by name"
            autoComplete="off"
            spellCheck={false}
            className="h-9 pl-8"
          />
        </div>
      </CardHeader>
      <CardContent>
        {summariesQuery.isLoading
          ? <Skeleton className="h-40 w-full" />
          : summaries.length === 0
            ? (
                <p className="py-4 text-sm text-muted-foreground">
                  No lead sources yet. Sources appear here once they exist in Lead Sources.
                </p>
              )
            : visible.length === 0
              ? (
                  <p className="py-4 text-sm text-muted-foreground">{`No sources match “${query.trim()}”.`}</p>
                )
              : (
                  // No overflow wrapper: an overflow ancestor would capture the
                  // header's position:sticky. The thead sticks to the Setup tab's
                  // scroll region instead.
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead>Default campaign</TableHead>
                        <TableHead className="text-center">Enabled</TableHead>
                        <TableHead className="text-center">Auto-enroll</TableHead>
                        <TableHead className="text-right">Eligible / Enrolled</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody aria-live="polite">
                      {visible.map(source => (
                        <SourcePolicyRow
                          key={source.sourceSlug}
                          source={source}
                          campaigns={campaigns}
                          busy={setSourcePolicy.isPending}
                          onPatch={(sourceSlug, patch) => setSourcePolicy.mutate({ sourceSlug, patch })}
                        />
                      ))}
                    </TableBody>
                  </Table>
                )}
      </CardContent>
    </Card>
  )
}
