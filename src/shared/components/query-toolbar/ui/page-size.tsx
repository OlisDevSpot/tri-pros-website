'use client'

import { useQueryToolbarContext } from '@/shared/components/query-toolbar/lib/context'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { cn } from '@/shared/lib/utils'

interface PageSizeProps {
  className?: string
}

export function QueryToolbarPageSize({ className }: PageSizeProps) {
  const { query } = useQueryToolbarContext()
  const pageWindow = query.window.kind === 'page' ? query.window : undefined
  if (!pageWindow || pageWindow.pageSizeOptions.length <= 1) {
    return null
  }
  return (
    // `lg:order-last` keeps this at the right edge regardless of where the auto-injected ChipRail sits in source order.
    <div className={cn('hidden lg:flex items-center gap-1.5 ml-auto lg:order-last', className)}>
      <span className="text-xs text-muted-foreground">Rows</span>
      <Select value={String(pageWindow.pageSize)} onValueChange={v => pageWindow.setPageSize(Number(v))}>
        <SelectTrigger className="h-9 w-17.5" aria-label="Rows per page">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {pageWindow.pageSizeOptions.map(size => (
            <SelectItem key={size} value={String(size)}>
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
