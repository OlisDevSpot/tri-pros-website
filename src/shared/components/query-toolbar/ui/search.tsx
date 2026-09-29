'use client'

import { SEARCH_COMMIT_DEBOUNCE_MS } from '@/shared/components/query-toolbar/constants/search'
import { useSearchDraft } from '@/shared/components/query-toolbar/hooks/use-search-draft'
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
  const { search, setSearch } = query.filterSort
  const { entityName, searchInputRef } = useToolbarInternal()
  const { draft, setDraft, flush } = useSearchDraft(search, setSearch, SEARCH_COMMIT_DEBOUNCE_MS)
  const effectivePlaceholder = placeholder ?? `Search ${entityName}…`
  return (
    <Input
      ref={searchInputRef}
      type="search"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          flush()
        }
      }}
      placeholder={effectivePlaceholder}
      autoComplete="off"
      spellCheck={false}
      aria-label={`Search ${entityName}`}
      className={cn('h-11 lg:h-9 flex-1 lg:max-w-xs touch-manipulation', className)}
    />
  )
}
