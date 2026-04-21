'use client'

import type { TimeRangeKey } from '@/features/lead-sources-admin/constants/time-ranges'

import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { BASE_TIME_RANGE_CHIPS, DEFAULT_RANGE_KEY } from '@/features/lead-sources-admin/constants/time-ranges'
import { buildChipsWithYears } from '@/features/lead-sources-admin/lib/resolve-time-range'
import { FormConfigEditor } from '@/features/lead-sources-admin/ui/components/form-config-editor'
import { IntakeUrlCard } from '@/features/lead-sources-admin/ui/components/intake-url-card'
import { LeadSourceCustomersSection } from '@/features/lead-sources-admin/ui/components/lead-source-customers-section'
import { LeadSourceDetailHeader } from '@/features/lead-sources-admin/ui/components/lead-source-detail-header'
import { PerformanceStrip } from '@/features/lead-sources-admin/ui/components/performance-strip'
import { TimeRangeChips } from '@/features/lead-sources-admin/ui/components/time-range-chips'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useTRPC } from '@/trpc/helpers'

interface LeadSourceDetailProps {
  leadSourceId: string
}

export function LeadSourceDetail({ leadSourceId }: LeadSourceDetailProps) {
  const trpc = useTRPC()
  const [rangeKey, setRangeKey] = useState<TimeRangeKey>(DEFAULT_RANGE_KEY)

  const sourceQuery = useQuery(
    trpc.leadSourcesRouter.getById.queryOptions({ id: leadSourceId }),
  )
  const yearsQuery = useQuery(
    trpc.leadSourcesRouter.getYearsWithActivity.queryOptions(),
  )

  const chips = useMemo(
    () => buildChipsWithYears(BASE_TIME_RANGE_CHIPS, yearsQuery.data ?? []),
    [yearsQuery.data],
  )
  const activeChip = chips.find(c => c.key === rangeKey) ?? chips[0]!

  if (sourceQuery.isLoading || !sourceQuery.data) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  const source = sourceQuery.data

  return (
    <div className="flex flex-col gap-8 p-6">
      <LeadSourceDetailHeader source={source} />

      <section aria-label="Performance" className="flex flex-col gap-4 border-t border-border/40 pt-6">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Performance
          </h3>
          <TimeRangeChips chips={chips} value={activeChip.key} onChange={setRangeKey} />
        </div>
        <PerformanceStrip leadSourceId={source.id} chip={activeChip} />
      </section>

      <section aria-label="Intake URL" className="flex flex-col gap-3 border-t border-border/40 pt-6">
        <IntakeUrlCard leadSourceId={source.id} slug={source.slug} token={source.token} />
      </section>

      <section aria-label="Form configuration" className="flex flex-col gap-4 border-t border-border/40 pt-6">
        <FormConfigEditor leadSourceId={source.id} initial={source.formConfigJSON} />
      </section>

      <section aria-label="Customers" className="border-t border-border/40 pt-6">
        <LeadSourceCustomersSection leadSourceId={source.id} />
      </section>
    </div>
  )
}
