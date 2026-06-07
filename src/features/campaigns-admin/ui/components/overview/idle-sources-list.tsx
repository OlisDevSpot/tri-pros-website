'use client'

import type { SourceSummary } from '@/features/campaigns-admin/lib/partition-source-summaries'

import { IdleSourceRow } from '@/features/campaigns-admin/ui/components/overview/idle-source-row'

export function IdleSourcesList({ summaries }: { summaries: SourceSummary[] }) {
  if (summaries.length === 0) {
    return null
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {`Idle · ${summaries.length} ${summaries.length === 1 ? 'source' : 'sources'}`}
      </h2>
      <div className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border">
        {summaries.map(s => (
          <IdleSourceRow
            key={s.sourceSlug}
            summary={s}
          />
        ))}
      </div>
    </section>
  )
}
