'use client'

import { useQueryToolbarContext } from '@/shared/components/query-toolbar/lib/context'
import { useToolbarInternal } from '@/shared/components/query-toolbar/lib/internal-context'
import { Input } from '@/shared/components/ui/input'
import { cn } from '@/shared/lib/utils'

interface SearchProps {
  placeholder?: string
  className?: string
}

export function QueryToolbarSearch({ placeholder, className }: SearchProps) {
  const { query } = useQueryToolbarContext()
  const { searchInput, setSearchInput } = query.filterSort
  const { entityName, searchInputRef } = useToolbarInternal()
  const effectivePlaceholder = placeholder ?? `Search ${entityName}…`
  return (
    <Input
      ref={searchInputRef}
      type="search"
      value={searchInput}
      onChange={e => setSearchInput(e.target.value)}
      placeholder={effectivePlaceholder}
      autoComplete="off"
      spellCheck={false}
      aria-label={`Search ${entityName}`}
      className={cn('h-11 lg:h-9 flex-1 lg:max-w-xs touch-manipulation', className)}
    />
  )
}
