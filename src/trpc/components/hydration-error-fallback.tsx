'use client'

import { ErrorState } from '@/shared/components/states/error-state'
import { Button } from '@/shared/components/ui/button'

interface Props {
  onRetry: () => void
}

export function HydrationErrorFallback({ onRetry }: Props) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-3 rounded-lg border p-8">
      <ErrorState className="border-none" title="Something went wrong" description="The data for this page failed to load." />
      <Button variant="outline" onClick={onRetry}>Try again</Button>
    </div>
  )
}
