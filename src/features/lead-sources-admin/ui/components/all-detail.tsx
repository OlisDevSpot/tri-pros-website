'use client'

import type { TimeRangeChip } from '@/features/lead-sources-admin/constants/time-ranges'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { parseAsStringEnum, useQueryState } from 'nuqs'
import { useMemo, useState } from 'react'

import { useEntranceMotion } from '@/features/lead-sources-admin/lib/use-entrance-motion'
import { AllAnalyticsPanel } from '@/features/lead-sources-admin/ui/components/all-analytics-panel'
import { AllCustomersSection } from '@/features/lead-sources-admin/ui/components/all-customers-section'
import { PerformanceStrip } from '@/features/lead-sources-admin/ui/components/performance-strip'
import { SourceTabTrigger } from '@/features/lead-sources-admin/ui/components/source-tab-trigger'
import { Button } from '@/shared/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Tabs, TabsContent, TabsList } from '@/shared/components/ui/tabs'
import { useTRPC } from '@/trpc/helpers'

const ALL_TABS = ['customers', 'analytics'] as const
type AllTab = (typeof ALL_TABS)[number]

interface PickableSource {
  id: string
  slug: string
  name: string
}

interface AllDetailProps {
  sourceCount: number
  activeChip: TimeRangeChip
  range: { from?: string, to?: string }
  /**
   * The list of lead sources used to populate the attribution picker. The
   * aggregate "All" view has no inherent attribution, so the user must
   * explicitly pick a source before the add-customer sheet opens — otherwise
   * the router silently defaults to `manual`, which historically caused
   * misattributed records.
   */
  sources: PickableSource[]
  onAddCustomer: (source: { slug: string, name: string }) => void
}

/**
 * Aggregate pane shown when the "All" pseudo-row is selected. Mirrors the
 * per-source detail layout (header → metric strip + tabs row → tab content)
 * minus the Settings tab and source-mutation actions, since "All" is not a
 * real lead source. URL state for `?tab` is shared with source-detail; the
 * enum parser falls back to 'customers' when an invalid value (e.g.
 * 'settings') is carried over from a per-source view.
 */
export function AllDetail({ sourceCount, activeChip, range, sources, onAddCustomer }: AllDetailProps) {
  const trpc = useTRPC()
  const entrance = useEntranceMotion()
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsStringEnum([...ALL_TABS]).withDefault('customers'),
  )
  const [pickerOpen, setPickerOpen] = useState(false)

  const sortedSources = useMemo(
    () => [...sources].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [sources],
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
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" className="h-11 gap-1.5 sm:h-8">
                <PlusIcon className="size-4" />
                Add customer
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0">
              <Command>
                <CommandInput placeholder="Pick a lead source…" />
                <CommandList>
                  <CommandEmpty>No lead sources found.</CommandEmpty>
                  <CommandGroup heading="Attribute new customer to">
                    {sortedSources.map(source => (
                      <CommandItem
                        key={source.id}
                        // Filter on both name and slug so 'manual', 'fb', etc.
                        // match without needing the user to type the display name.
                        value={`${source.name} ${source.slug}`}
                        onSelect={() => {
                          setPickerOpen(false)
                          onAddCustomer({ slug: source.slug, name: source.name })
                        }}
                      >
                        <span className="truncate">{source.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
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
