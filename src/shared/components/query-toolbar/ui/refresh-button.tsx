'use client'

import { RefreshCw } from 'lucide-react'

import { useQueryToolbarContext } from '@/shared/components/query-toolbar/lib/context'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

export function QueryToolbarRefreshButton() {
  const { query } = useQueryToolbarContext()
  const { refresh, isFetching } = query
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => void refresh()}
      disabled={isFetching}
      aria-label="Refresh"
      className="h-11 w-11 lg:h-9 lg:w-9 px-0 shrink-0 touch-manipulation"
    >
      <RefreshCw
        className={cn(
          'size-4 opacity-80 motion-safe:transition-transform',
          isFetching && 'motion-safe:animate-spin motion-reduce:opacity-50',
        )}
        aria-hidden
      />
      <span className="sr-only">Refresh</span>
    </Button>
  )
}
