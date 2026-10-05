'use client'

import { ErrorState } from '@/shared/components/states/error-state'
import { Button } from '@/shared/components/ui/button'

interface Props {
  onRetry: () => void
  /** `section`: a compact inline row for a boundary that wraps one module of a page, not the page. */
  variant?: 'page' | 'section'
}

export function HydrationErrorFallback({ onRetry, variant = 'page' }: Props) {
  if (variant === 'section') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground" role="alert">
        <span>This section failed to load.</span>
        <Button variant="ghost" size="sm" onClick={onRetry}>Try again</Button>
      </div>
    )
  }
  return (
    <div className="flex size-full flex-col items-center justify-center gap-3 rounded-lg border p-8">
      <ErrorState className="border-none" title="Something went wrong" description="The data for this page failed to load." />
      <Button variant="outline" onClick={onRetry}>Try again</Button>
    </div>
  )
}
