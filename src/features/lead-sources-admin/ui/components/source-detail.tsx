'use client'

import type { TimeRangeChip } from '@/features/lead-sources-admin/constants/time-ranges'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { parseAsStringEnum, useQueryState } from 'nuqs'
import { useEffect } from 'react'

import { LeadSourceAnalyticsPanel } from '@/features/lead-sources-admin/ui/components/lead-source-analytics-panel'
import { LeadSourceCustomersSection } from '@/features/lead-sources-admin/ui/components/lead-source-customers-section'
import { LeadSourceDetailHeader } from '@/features/lead-sources-admin/ui/components/lead-source-detail-header'
import { LeadSourcePerformanceStrip } from '@/features/lead-sources-admin/ui/components/lead-source-performance-strip'
import { LeadSourceSettingsPanel } from '@/features/lead-sources-admin/ui/components/lead-source-settings-panel'
import { MobileBackButton } from '@/features/lead-sources-admin/ui/components/mobile-back-button'
import { SourceTabTrigger } from '@/features/lead-sources-admin/ui/components/source-tab-trigger'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Tabs, TabsContent, TabsList } from '@/shared/components/ui/tabs'
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

  const searchParams = useSearchParams()

  // Backward compat: redirect ?tab=overview to ?tab=customers so old bookmarks
  // land on the new default tab.
  useEffect(() => {
    if (searchParams?.get('tab') === 'overview') {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- setTab is from nuqs useQueryState, not React useState
      void setTab('customers', { history: 'replace' })
    }
  }, [searchParams, setTab])

  const sourceQuery = useQuery(
    trpc.leadSourcesRouter.getById.queryOptions({ id: leadSourceId }),
  )

  const statsQuery = useQuery({
    ...trpc.leadSourcesRouter.getStats.queryOptions({
      id: leadSourceId,
      from: range.from,
      to: range.to,
    }),
    placeholderData: keepPreviousData,
  })

  const countsQuery = useQuery({
    ...trpc.leadSourcesRouter.getStatusCounts.queryOptions({ id: leadSourceId }),
    placeholderData: keepPreviousData,
  })

  if (sourceQuery.isLoading || !sourceQuery.data) {
    return (
      <div className="flex flex-col gap-6 px-4 pt-4 sm:px-5 sm:pt-5">
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
    <div className="flex h-full min-h-0 flex-col gap-4 px-4 pt-4 sm:gap-5 sm:px-5 sm:pt-5">
      {onBack && <MobileBackButton label="All sources" onClick={onBack} />}
      <LeadSourceDetailHeader
        source={source}
        onJumpToSettings={() => setTab('settings', { history: 'push' })}
        onAddCustomer={() => onAddCustomer({ slug: source.slug, name: source.name })}
      />

      <Tabs
        value={tab}
        onValueChange={v => setTab(v as SourceTab, { history: 'replace' })}
        className="flex min-h-0 flex-1 flex-col gap-4"
      >
        {/*
          Single row pairing the headline metric (focal point) with the tab
          switcher. items-end + a shared `border-b border-border/40` keeps the
          tabs underline aligned with the divider that runs full-width on
          desktop. `-mb-px` on TabsList lets the active trigger's `border-b-2`
          cover the divider precisely. On mobile the row stacks (metric
          on top, tabs below) and the divider is owned by the wrapper.
        */}
        <div className="flex shrink-0 flex-col items-stretch gap-3 border-b border-border/40 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <section aria-label="Performance" className="pb-1 sm:pb-0">
            <LeadSourcePerformanceStrip
              stats={statsQuery.data}
              chip={activeChip}
              isLoading={statsQuery.isLoading}
            />
          </section>
          <TabsList
            className="-mb-px h-auto justify-start gap-4 self-start overflow-x-auto rounded-none bg-transparent p-0 sm:self-end"
          >
            <SourceTabTrigger value="customers">
              Customers
              {customerCountLabel != null && (
                <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                  {customerCountLabel}
                </span>
              )}
            </SourceTabTrigger>
            <SourceTabTrigger value="analytics">
              Analytics
            </SourceTabTrigger>
            <SourceTabTrigger value="settings">
              Settings
            </SourceTabTrigger>
          </TabsList>
        </div>

        <TabsContent value="customers" className="flex min-h-0 flex-1 flex-col">
          <LeadSourceCustomersSection leadSourceId={source.id} />
        </TabsContent>

        <TabsContent value="analytics" className="flex min-h-0 flex-1 flex-col">
          <LeadSourceAnalyticsPanel
            leadSourceId={leadSourceId}
            chip={activeChip}
            from={range.from}
            to={range.to}
          />
        </TabsContent>

        <TabsContent value="settings" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <LeadSourceSettingsPanel source={source} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
