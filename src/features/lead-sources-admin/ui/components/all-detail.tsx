'use client'

import type { TimeRangeChip } from '@/features/lead-sources-admin/constants/time-ranges'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { parseAsStringEnum, useQueryState } from 'nuqs'

import { useEntranceMotion } from '@/features/lead-sources-admin/lib/use-entrance-motion'
import { AllAnalyticsPanel } from '@/features/lead-sources-admin/ui/components/all-analytics-panel'
import { AllCustomersSection } from '@/features/lead-sources-admin/ui/components/all-customers-section'
import { PerformanceStrip } from '@/features/lead-sources-admin/ui/components/performance-strip'
import { SourceTabTrigger } from '@/features/lead-sources-admin/ui/components/source-tab-trigger'
import { Button } from '@/shared/components/ui/button'
import { Tabs, TabsContent, TabsList } from '@/shared/components/ui/tabs'
import { useTRPC } from '@/trpc/helpers'

const ALL_TABS = ['customers', 'analytics'] as const
type AllTab = (typeof ALL_TABS)[number]

interface AllDetailProps {
  sourceCount: number
  activeChip: TimeRangeChip
  range: { from?: string, to?: string }
  onAddCustomer: () => void
}

/**
 * Aggregate pane shown when the "All" pseudo-row is selected. Mirrors the
 * per-source detail layout (header → metric strip + tabs row → tab content)
 * minus the Settings tab and source-mutation actions, since "All" is not a
 * real lead source. URL state for `?tab` is shared with source-detail; the
 * enum parser falls back to 'customers' when an invalid value (e.g.
 * 'settings') is carried over from a per-source view.
 */
export function AllDetail({ sourceCount, activeChip, range, onAddCustomer }: AllDetailProps) {
  const trpc = useTRPC()
  const entrance = useEntranceMotion()
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsStringEnum([...ALL_TABS]).withDefault('customers'),
  )

  const statsQuery = useQuery({
    ...trpc.leadSourcesRouter.getAggregateStats.queryOptions({
      from: range.from,
      to: range.to,
    }),
    placeholderData: keepPreviousData,
  })

  const customerCountLabel = statsQuery.data?.total

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 px-4 pt-4 sm:gap-5 sm:px-5 sm:pt-5">
      <header className="flex shrink-0 items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <motion.p
            {...entrance(0, 6)}
            className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
          >
            Lead sources
            <span aria-hidden="true" className="mx-2 opacity-40">·</span>
            {`Aggregate · ${sourceCount} ${sourceCount === 1 ? 'source' : 'sources'}`}
          </motion.p>
          <motion.h2
            {...entrance(0.04, 6)}
            className="truncate text-3xl font-semibold tracking-tight text-foreground"
          >
            All sources
          </motion.h2>
        </div>
        <motion.div {...entrance(0.08, 6)} className="shrink-0">
          <Button size="sm" onClick={onAddCustomer} className="h-11 gap-1.5 sm:h-8">
            <PlusIcon className="size-4" />
            Add customer
          </Button>
        </motion.div>
      </header>

      <Tabs
        value={tab}
        onValueChange={v => setTab(v as AllTab, { history: 'replace' })}
        className="flex min-h-0 flex-1 flex-col gap-4"
      >
        <div className="flex shrink-0 flex-col items-stretch gap-3 border-b border-border/40 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <section aria-label="Aggregate performance" className="pb-1 sm:pb-0">
            <PerformanceStrip
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
          </TabsList>
        </div>

        <TabsContent value="customers" className="flex min-h-0 flex-1 flex-col">
          <AllCustomersSection />
        </TabsContent>

        <TabsContent value="analytics" className="flex min-h-0 flex-1 flex-col">
          <AllAnalyticsPanel chip={activeChip} from={range.from} to={range.to} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
