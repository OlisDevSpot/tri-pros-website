'use client'

import type { TimeRangeChip } from '@/features/lead-sources-admin/constants/time-ranges'

import { useQuery } from '@tanstack/react-query'
import { parseAsStringEnum, useQueryState } from 'nuqs'
import { useEffect } from 'react'

import { LeadSourceAnalyticsPlaceholder } from '@/features/lead-sources-admin/ui/components/lead-source-analytics-placeholder'
import { LeadSourceCustomersPanel } from '@/features/lead-sources-admin/ui/components/lead-source-customers-panel'
import { LeadSourceDetailHeader } from '@/features/lead-sources-admin/ui/components/lead-source-detail-header'
import { LeadSourcePerformanceStrip } from '@/features/lead-sources-admin/ui/components/lead-source-performance-strip'
import { LeadSourceSettingsPanel } from '@/features/lead-sources-admin/ui/components/lead-source-settings-panel'
import { MobileBackButton } from '@/features/lead-sources-admin/ui/components/mobile-back-button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

const SOURCE_TABS = ['customers', 'analytics', 'settings'] as const
type SourceTab = (typeof SOURCE_TABS)[number]

interface SourceDetailProps {
  leadSourceId: string
  activeChip: TimeRangeChip
  range: { from?: string, to?: string }
  onAddCustomer: (source: { slug: string, name: string }) => void
  /** Pops back to the list on mobile. Button hidden on lg+. */
  onBack?: () => void
}

export function SourceDetail({ leadSourceId, activeChip, range, onAddCustomer, onBack }: SourceDetailProps) {
  const trpc = useTRPC()
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsStringEnum([...SOURCE_TABS]).withDefault('customers'),
  )

  // Backward compat: redirect ?tab=overview to ?tab=customers so old bookmarks
  // land on the new default tab.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tab') === 'overview') {
      void setTab('customers', { history: 'replace' })
    }
  }, [setTab])

  const sourceQuery = useQuery(
    trpc.leadSourcesRouter.getById.queryOptions({ id: leadSourceId }),
  )

  const statsQuery = useQuery(
    trpc.leadSourcesRouter.getStats.queryOptions({
      id: leadSourceId,
      from: range.from,
      to: range.to,
    }),
  )

  const countsQuery = useQuery(
    trpc.leadSourcesRouter.getStatusCounts.queryOptions({ id: leadSourceId }),
  )

  if (sourceQuery.isLoading || !sourceQuery.data) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  const source = sourceQuery.data
  const customerCountLabel = countsQuery.data?.all

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 sm:gap-6 sm:p-6">
      {onBack && <MobileBackButton label="All sources" onClick={onBack} />}
      <LeadSourceDetailHeader
        source={source}
        onJumpToSettings={() => setTab('settings', { history: 'push' })}
      />

      <section aria-label="Performance">
        <LeadSourcePerformanceStrip
          stats={statsQuery.data}
          chip={activeChip}
          isLoading={statsQuery.isLoading}
        />
      </section>

      <Tabs
        value={tab}
        onValueChange={v => setTab(v as SourceTab, { history: 'replace' })}
        className="flex min-h-0 flex-1 flex-col gap-4"
      >
        <TabsList
          className={cn(
            'h-auto w-full justify-start gap-4 rounded-none border-b border-border/40 bg-transparent p-0',
          )}
        >
          <TabsTrigger
            value="customers"
            className={cn(
              'rounded-none border-b-2 border-transparent bg-transparent px-2 py-3 text-sm font-medium text-muted-foreground shadow-none',
              'data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none',
            )}
          >
            Customers
            {customerCountLabel != null && (
              <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                {customerCountLabel}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className={cn(
              'rounded-none border-b-2 border-transparent bg-transparent px-2 py-3 text-sm font-medium text-muted-foreground shadow-none',
              'data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none',
            )}
          >
            Analytics
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className={cn(
              'rounded-none border-b-2 border-transparent bg-transparent px-2 py-3 text-sm font-medium text-muted-foreground shadow-none',
              'data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none',
            )}
          >
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="flex min-h-0 flex-1 flex-col">
          <LeadSourceCustomersPanel
            leadSourceId={source.id}
            onAddCustomer={() => onAddCustomer({ slug: source.slug, name: source.name })}
          />
        </TabsContent>

        <TabsContent value="analytics" className="flex min-h-0 flex-1 flex-col">
          <LeadSourceAnalyticsPlaceholder />
        </TabsContent>

        <TabsContent value="settings" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <LeadSourceSettingsPanel source={source} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
