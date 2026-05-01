'use client'

import type { ReactNode } from 'react'

import type { FilterDefinition, FilterValue, PaginatedQueryResult } from '@/shared/dal/client/query/types'

import { format } from 'date-fns'
import { XIcon } from 'lucide-react'
import { useMemo } from 'react'

import { QueryToolbarProvider, useQueryToolbarContext } from '@/shared/components/query-toolbar/lib/context'
import { filterRendererRegistry } from '@/shared/components/query-toolbar/lib/filter-renderer-registry'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { cn } from '@/shared/lib/utils'

// ── Root ───────────────────────────────────────────────────────────────────────

interface RootProps {
  pagination: PaginatedQueryResult<unknown>
  className?: string
  children: ReactNode
}

function Root({ pagination, className, children }: RootProps) {
  return (
    <QueryToolbarProvider value={pagination}>
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        {children}
      </div>
    </QueryToolbarProvider>
  )
}

// ── Search ─────────────────────────────────────────────────────────────────────

interface SearchProps {
  placeholder?: string
  className?: string
}

function Search({ placeholder = 'Search…', className }: SearchProps) {
  const { searchInput, setSearchInput } = useQueryToolbarContext()
  return (
    <Input
      type="search"
      value={searchInput}
      onChange={e => setSearchInput(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      spellCheck={false}
      className={cn('max-w-xs', className)}
    />
  )
}

// ── Filters (renders all filter definitions) ───────────────────────────────────

interface FiltersProps {
  /** Limit to a subset of filter ids; default: render all. */
  only?: readonly string[]
  /** Skip these filter ids. Useful when combined with explicit `<Filter id="…">` siblings. */
  skip?: readonly string[]
}

function Filters({ only, skip }: FiltersProps = {}) {
  const { filterDefinitions } = useQueryToolbarContext()
  const visible = filterDefinitions.filter((def) => {
    if (only && !only.includes(def.id)) {
      return false
    }
    if (skip && skip.includes(def.id)) {
      return false
    }
    return true
  })

  return (
    <>
      {visible.map(def => (
        <SingleFilter key={def.id} definition={def} />
      ))}
    </>
  )
}

// ── Filter (single by id, with optional render-prop override) ──────────────────

interface FilterRenderArg {
  definition: FilterDefinition
  value: FilterValue
  setValue: (value: FilterValue) => void
}

interface FilterProps {
  id: string
  children?: (arg: FilterRenderArg) => ReactNode
}

function Filter({ id, children }: FilterProps) {
  const { filterDefinitions, filters, setFilter } = useQueryToolbarContext()
  const definition = filterDefinitions.find(d => d.id === id)
  if (!definition) {
    return null
  }
  if (children) {
    return <>{children({ definition, value: filters[id], setValue: v => setFilter(id, v) })}</>
  }
  return <SingleFilter definition={definition} />
}

// Internal renderer that picks the right control from the registry.
interface SingleFilterProps {
  definition: FilterDefinition
}

function SingleFilter({ definition }: SingleFilterProps) {
  const { filters, setFilter } = useQueryToolbarContext()
  const value = filters[definition.id]

  switch (definition.type) {
    case 'select': {
      const Render = filterRendererRegistry.select
      return (
        <Render
          definition={definition}
          value={value as string | undefined}
          onChange={v => setFilter(definition.id, v)}
        />
      )
    }
    case 'multi-select': {
      const Render = filterRendererRegistry['multi-select']
      return (
        <Render
          definition={definition}
          value={value as string[] | undefined}
          onChange={v => setFilter(definition.id, v)}
        />
      )
    }
    case 'date-range': {
      const Render = filterRendererRegistry['date-range']
      return (
        <Render
          definition={definition}
          value={value as { from?: string, to?: string } | undefined}
          onChange={v => setFilter(definition.id, v)}
        />
      )
    }
    case 'boolean': {
      const Render = filterRendererRegistry.boolean
      return (
        <Render
          definition={definition}
          value={value as boolean | undefined}
          onChange={v => setFilter(definition.id, v)}
        />
      )
    }
  }
}

// ── ActiveFilterChips ──────────────────────────────────────────────────────────

interface ActiveChip {
  definition: FilterDefinition
  value: NonNullable<FilterValue>
}

function ActiveFilterChips() {
  const { filterDefinitions, filters, setFilter } = useQueryToolbarContext()

  const active = useMemo<ActiveChip[]>(() => {
    const result: ActiveChip[] = []
    for (const def of filterDefinitions) {
      const v = filters[def.id]
      if (v !== undefined) {
        result.push({ definition: def, value: v })
      }
    }
    return result
  }, [filterDefinitions, filters])

  if (active.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {active.map(({ definition, value }) => (
        <Badge key={definition.id} variant="secondary" className="gap-1 pr-1">
          <span className="text-xs">
            {definition.label}
            {': '}
            {formatChipValue(definition, value)}
          </span>
          <button
            type="button"
            onClick={() => setFilter(definition.id, undefined)}
            className="ml-0.5 rounded p-0.5 hover:bg-background/40"
            aria-label={`Clear ${definition.label}`}
          >
            <XIcon className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  )
}

function formatChipValue(definition: FilterDefinition, value: FilterValue): string {
  switch (definition.type) {
    case 'select': {
      const opt = definition.options.find(o => o.value === value)
      return opt?.label ?? String(value)
    }
    case 'multi-select': {
      const arr = value as string[]
      if (arr.length <= 2) {
        return arr.map(v => definition.options.find(o => o.value === v)?.label ?? v).join(', ')
      }
      return `${arr.length} selected`
    }
    case 'date-range': {
      const range = value as { from?: string, to?: string }
      const fromStr = range.from ? format(new Date(range.from), 'MMM d') : '…'
      const toStr = range.to ? format(new Date(range.to), 'MMM d') : '…'
      return `${fromStr} → ${toStr}`
    }
    case 'boolean':
      return value ? 'Yes' : 'No'
  }
}

// ── PageSize ───────────────────────────────────────────────────────────────────

interface PageSizeProps {
  className?: string
  label?: string
}

function PageSize({ className, label = 'Rows per page' }: PageSizeProps) {
  const { pageSize, pageSizeOptions, setPageSize } = useQueryToolbarContext()

  if (!pageSizeOptions || pageSizeOptions.length <= 1) {
    return null
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
        <SelectTrigger className="h-8 w-20">
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

// ── ClearAll ───────────────────────────────────────────────────────────────────

interface ClearAllProps {
  className?: string
  /** Custom label; defaults to "Clear filters" or "Clear all" depending on state. */
  label?: string
}

function ClearAll({ className, label }: ClearAllProps) {
  const { activeFilterCount, searchInput, sortBy, clearFilters } = useQueryToolbarContext()
  const hasAnything = activeFilterCount > 0 || !!searchInput || !!sortBy

  if (!hasAnything) {
    return null
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={clearFilters}
      className={cn('h-8 px-2 text-xs', className)}
    >
      {label ?? (activeFilterCount > 0 ? `Clear (${activeFilterCount})` : 'Clear')}
    </Button>
  )
}

// ── Sort (dropdown variant — for surfaces without sortable headers) ────────────

interface SortOption {
  label: string
  sortBy: string
  sortDir?: 'asc' | 'desc'
}

interface SortProps {
  options: readonly SortOption[]
  className?: string
}

function Sort({ options, className }: SortProps) {
  const { sortBy, sortDir, setSort } = useQueryToolbarContext()

  const currentValue = useMemo(() => {
    if (!sortBy) {
      return ''
    }
    const match = options.find(o => o.sortBy === sortBy && (o.sortDir ?? 'asc') === (sortDir ?? 'asc'))
    return match ? `${match.sortBy}:${match.sortDir ?? 'asc'}` : ''
  }, [options, sortBy, sortDir])

  return (
    <Select
      value={currentValue}
      onValueChange={(v) => {
        if (!v) {
          setSort(undefined)
          return
        }
        const [key, dir] = v.split(':')
        setSort(key, (dir as 'asc' | 'desc') ?? 'asc')
      }}
    >
      <SelectTrigger className={cn('h-8 w-44', className)}>
        <SelectValue placeholder="Sort by…" />
      </SelectTrigger>
      <SelectContent>
        {options.map(o => (
          <SelectItem key={`${o.sortBy}:${o.sortDir ?? 'asc'}`} value={`${o.sortBy}:${o.sortDir ?? 'asc'}`}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ── Compound export ────────────────────────────────────────────────────────────

export const QueryToolbar = Object.assign(Root, {
  Search,
  Filters,
  Filter,
  ActiveFilterChips,
  PageSize,
  ClearAll,
  Sort,
})
