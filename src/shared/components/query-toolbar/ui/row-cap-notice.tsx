'use client'

import { useQueryToolbarContext } from '@/shared/components/query-toolbar/lib/context'
import { formatTotalCount } from '@/shared/lib/pagination-format'
import { cn } from '@/shared/lib/utils'

interface RowCapNoticeProps {
  className?: string
}

/** A date window returns at most `cap` rows; say so instead of dropping the rest silently. */
export function QueryToolbarRowCapNotice({ className }: RowCapNoticeProps) {
  const { query } = useQueryToolbarContext()
  // While pending, `total` still counts the previous key's rows.
  if (query.window.kind !== 'date' || query.window.isPending || query.total <= query.window.cap) {
    return null
  }
  return (
    <p role="status" className={cn('text-xs text-muted-foreground', className)}>
      {`Showing ${formatTotalCount(query.window.cap)} of ${formatTotalCount(query.total)}`}
    </p>
  )
}
