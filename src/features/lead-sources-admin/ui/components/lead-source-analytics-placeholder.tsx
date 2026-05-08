'use client'

import { BarChart3Icon } from 'lucide-react'

export function LeadSourceAnalyticsPlaceholder() {
  return (
    <div className="flex h-full min-h-70 flex-col items-center justify-center gap-3 rounded-lg border border-border/40 px-6 py-10 text-center">
      <BarChart3Icon aria-hidden="true" className="size-8 text-muted-foreground/50" />
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-foreground">Coming soon</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Funnel breakdown, weekly trend, and cohort analysis. The headline metrics above and the Customers tab cover the daily questions in the meantime.
        </p>
      </div>
    </div>
  )
}
