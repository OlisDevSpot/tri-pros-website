'use client'

import { BarChart3Icon } from 'lucide-react'

import { EmptyState } from '@/shared/components/states/empty-state'

export function LeadSourceAnalyticsPlaceholder() {
  return (
    <EmptyState
      title="Coming soon"
      description="Funnel breakdown, weekly trend, and cohort analysis. The headline metrics above and the Customers tab cover the daily questions in the meantime."
    >
      <BarChart3Icon size={48} className="text-muted-foreground/50" />
    </EmptyState>
  )
}
