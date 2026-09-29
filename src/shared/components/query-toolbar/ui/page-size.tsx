'use client'

import { useQueryToolbarContext } from '@/shared/components/query-toolbar/lib/context'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { cn } from '@/shared/lib/utils'

interface PageSizeProps {
  className?: string
}

export function QueryToolbarPageSize({ className }: PageSizeProps) {
  const { pageSize, pageSizeOptions, setPageSize } = useQueryToolbarContext()
  if (!pageSizeOptions || pageSizeOptions.length <= 1) {
    return null
  }
  return (
    // `lg:order-last` keeps this at the right edge regardless of where the auto-injected ChipRail sits in source order.
    <div className={cn('hidden lg:flex items-center gap-1.5 ml-auto lg:order-last', className)}>
      <span className="text-xs text-muted-foreground">Rows</span>
      <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
        <SelectTrigger className="h-9 w-17.5" aria-label="Rows per page">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {pageSizeOptions.map(size => (
            <SelectItem key={size} value={String(size)}>
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
