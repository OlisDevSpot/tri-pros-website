'use client'

import type { TimeRangeChip } from '@/features/lead-sources-admin/constants/time-ranges'

import { useQuery } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { parseAsStringEnum, useQueryState } from 'nuqs'

import { FormConfigEditor } from '@/features/lead-sources-admin/ui/components/form-config-editor'
import { IntakeUrlCard } from '@/features/lead-sources-admin/ui/components/intake-url-card'
import { LeadSourceCustomersSection } from '@/features/lead-sources-admin/ui/components/lead-source-customers-section'
import { LeadSourceDetailHeader } from '@/features/lead-sources-admin/ui/components/lead-source-detail-header'
import { PerformanceStrip } from '@/features/lead-sources-admin/ui/components/performance-strip'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { useTRPC } from '@/trpc/helpers'

const SOURCE_TABS = ['overview', 'customers'] as const
type SourceTab = (typeof SOURCE_TABS)[number]

interface SourceDetailProps {
  leadSourceId: string
  activeChip: TimeRangeChip
  range: { from?: string, to?: string }
  onAddCustomer: (source: { slug: string, name: string }) => void
}

export function SourceDetail({ leadSourceId, activeChip, range, onAddCustomer }: SourceDetailProps) {
  const trpc = useTRPC()
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsStringEnum([...SOURCE_TABS]).withDefault('overview'),
  )

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

  if (sourceQuery.isLoading || !sourceQuery.data) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  const source = sourceQuery.data

  return (
    <div className="flex flex-col gap-6 p-6">
      <LeadSourceDetailHeader source={source} />

      <Tabs value={tab} onValueChange={v => setTab(v as SourceTab, { history: 'replace' })}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-8 pt-4">
          <section aria-label="Performance" className="flex flex-col gap-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Performance
            </h3>
            <PerformanceStrip
              stats={statsQuery.data}
              chip={activeChip}
              isLoading={statsQuery.isLoading}
            />
          </section>

          <section aria-label="Intake URL" className="flex flex-col gap-3 border-t border-border/40 pt-6">
            <IntakeUrlCard leadSourceId={source.id} slug={source.slug} token={source.token} />
          </section>

          <section aria-label="Form configuration" className="flex flex-col gap-4 border-t border-border/40 pt-6">
            <FormConfigEditor leadSourceId={source.id} initial={source.formConfigJSON} />
          </section>
        </TabsContent>

        <TabsContent value="customers" className="flex flex-col gap-4 pt-4">
          <div className="flex items-center justify-end">
            <Button
              size="sm"
              onClick={() => onAddCustomer({ slug: source.slug, name: source.name })}
              className="gap-1.5"
            >
              <PlusIcon className="size-4" />
              Add customer
            </Button>
          </div>
          <LeadSourceCustomersSection leadSourceId={source.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
