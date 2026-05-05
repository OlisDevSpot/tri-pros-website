'use client'

import type { ReactNode } from 'react'

import type { FilterDefinition, FilterValue, PaginatedQueryResult } from '@/shared/dal/client/query/types'

import { SlidersHorizontal, XIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useMemo, useRef, useState } from 'react'

import { LoadingHairline } from '@/shared/components/loading-hairline'
import { KEYBOARD_HINT_TEXT } from '@/shared/components/query-toolbar/constants/keyboard-hints'
import { useToolbarShortcuts } from '@/shared/components/query-toolbar/hooks/use-toolbar-shortcuts'
import { QueryToolbarProvider, useQueryToolbarContext } from '@/shared/components/query-toolbar/lib/context'
import { filterRendererRegistry } from '@/shared/components/query-toolbar/lib/filter-renderer-registry'
import { formatChipValue } from '@/shared/components/query-toolbar/lib/format-chip-value'
import { ToolbarInternalProvider, useToolbarInternal } from '@/shared/components/query-toolbar/lib/internal-context'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/shared/components/ui/sheet'
import { useIsBelowLg } from '@/shared/hooks/use-is-below-lg'
import { formatTotalCount } from '@/shared/lib/pagination-format'
import { cn } from '@/shared/lib/utils'

// ── Root ───────────────────────────────────────────────────────────────────────

interface RootProps {
  pagination: PaginatedQueryResult<unknown>
  /**
   * Singular noun for the records this toolbar filters (e.g. "proposal",
   * "meeting"). Drives `aria-label` on Search and the live-status
   * announcement. Defaults to "results".
   */
  entityName?: string
  className?: string
  children: ReactNode
}

function Root({ pagination, entityName = 'results', className, children }: RootProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)

  const handleOpenFilter = useCallback(() => setFilterOpen(true), [])

  const { page, pageCount, setPage } = pagination
  const handlePrevPage = useCallback(() => {
    if (page > 1) {
      setPage(page - 1)
    }
  }, [page, setPage])
  const handleNextPage = useCallback(() => {
    if (page < pageCount) {
      setPage(page + 1)
    }
  }, [page, pageCount, setPage])

  useToolbarShortcuts({
    searchInputRef,
    onOpenFilter: handleOpenFilter,
    onPrevPage: handlePrevPage,
    onNextPage: handleNextPage,
  })

  const internal = useMemo(
    () => ({ entityName, searchInputRef, filterOpen, setFilterOpen }),
    [entityName, filterOpen],
  )

  return (
    <QueryToolbarProvider value={pagination}>
      <ToolbarInternalProvider value={internal}>
        <div className={cn('flex flex-col gap-2', className)}>
          {children}
        </div>
      </ToolbarInternalProvider>
    </QueryToolbarProvider>
  )
}

// ── Bar ────────────────────────────────────────────────────────────────────────

interface BarProps {
  className?: string
  children: ReactNode
}

/**
 * Single-row toolbar container. Hosts Search + FilterTrigger + (desktop)
 * PageSize. Owns the bottom border and the loading-shimmer overlay.
 */
function Bar({ className, children }: BarProps) {
  const { isFetching, isPlaceholderData } = useQueryToolbarContext()
  const showShimmer = isFetching || isPlaceholderData
  return (
    <div
      className={cn(
        'relative flex items-center gap-2 lg:gap-3',
        'border-b border-border/60 pb-2',
        className,
      )}
    >
      {children}
      <LoadingHairline isLoading={showShimmer} />
    </div>
  )
}

// ── Search ─────────────────────────────────────────────────────────────────────

interface SearchProps {
  placeholder?: string
  className?: string
}

function Search({ placeholder, className }: SearchProps) {
  const { searchInput, setSearchInput } = useQueryToolbarContext()
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

// ── FilterTrigger ──────────────────────────────────────────────────────────────

/**
 * Filter affordance. Opens a bottom Sheet on mobile and a Popover at `lg`+.
 * Mobile is a square 44×44 icon-only button (label is `sr-only`); desktop
 * shows the visible label `Filters` (with `· N` suffix when a filter is
 * active) alongside the sliders icon. Active state shifts the border color
 * so mobile users can still tell at a glance that filters are on — the
 * chip rail below also reflects active filters explicitly.
 */
function FilterTrigger() {
  const { activeFilterCount, filterDefinitions } = useQueryToolbarContext()
  const { filterOpen, setFilterOpen } = useToolbarInternal()
  const isBelowLg = useIsBelowLg()

  if (filterDefinitions.length === 0) {
    return null
  }

  const visibleLabel = activeFilterCount > 0
    ? `Filters · ${activeFilterCount}`
    : 'Filters'
  const ariaLabel = activeFilterCount > 0
    ? `Filters, ${activeFilterCount} active`
    : 'Filters'
  const triggerClassName = cn(
    'h-11 w-11 lg:h-9 lg:w-auto px-0 lg:px-3 font-normal gap-1.5 touch-manipulation',
    activeFilterCount > 0 && 'border-foreground/60 text-foreground',
  )

  const triggerInner = (
    <>
      <span className="sr-only lg:not-sr-only">{visibleLabel}</span>
      <SlidersHorizontal className="size-4 opacity-80" aria-hidden />
    </>
  )

  if (isBelowLg) {
    return (
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetTrigger asChild>
          <Button type="button" variant="outline" className={triggerClassName} aria-label={ariaLabel}>
            {triggerInner}
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="flex max-h-[85svh] flex-col gap-0 p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Filter and sort</SheetTitle>
          </SheetHeader>
          <SheetDragHandle />
          <SheetBody onClose={() => setFilterOpen(false)} />
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={filterOpen} onOpenChange={setFilterOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={triggerClassName} aria-label={ariaLabel}>
          {triggerInner}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <PopoverBody />
      </PopoverContent>
    </Popover>
  )
}

// ── Sheet helpers (mobile filter surface) ──────────────────────────────────────

function SheetDragHandle() {
  return (
    <div aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-foreground/20" />
  )
}

interface SheetBodyProps {
  onClose: () => void
}

function SheetBody({ onClose }: SheetBodyProps) {
  const ctx = useQueryToolbarContext()
  const hasResetableState = ctx.activeFilterCount > 0 || !!ctx.searchInput || !!ctx.sortBy
  const showPageSize = !!ctx.pageSizeOptions && ctx.pageSizeOptions.length > 1
  return (
    <>
      <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-4 [scrollbar-gutter:stable]">
        {ctx.filterDefinitions.length > 0 && (
          <SheetSection title="Filters" sectionId="qt-section-filters">
            <div className="space-y-3">
              {ctx.filterDefinitions.map(def => (
                <FilterControlField key={def.id} definition={def} />
              ))}
            </div>
          </SheetSection>
        )}
        {showPageSize && (
          <SheetSection title="Rows per page" sectionId="qt-section-page-size">
            <PageSizeSegmented
              options={ctx.pageSizeOptions!}
              value={ctx.pageSize}
              onChange={ctx.setPageSize}
            />
          </SheetSection>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          onClick={ctx.clearFilters}
          disabled={!hasResetableState}
          className="touch-manipulation"
        >
          Reset
        </Button>
        <Button type="button" onClick={onClose} className="touch-manipulation">
          {`View results · ${formatTotalCount(ctx.total)}`}
        </Button>
      </div>
    </>
  )
}

interface SheetSectionProps {
  title: string
  sectionId: string
  children: ReactNode
}

function SheetSection({ title, sectionId, children }: SheetSectionProps) {
  return (
    <section aria-labelledby={sectionId} className="space-y-3">
      <h2 id={sectionId} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}

// ── Popover body (desktop filter surface) ──────────────────────────────────────

function PopoverBody() {
  const ctx = useQueryToolbarContext()
  const hasResetableState = ctx.activeFilterCount > 0 || !!ctx.searchInput || !!ctx.sortBy
  if (ctx.filterDefinitions.length === 0) {
    return null
  }
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-2.5">
        <span className="text-xs font-semibold tracking-wide text-foreground">
          Filters
        </span>
        {hasResetableState && (
          <button
            type="button"
            onClick={ctx.clearFilters}
            className={cn(
              'rounded text-xs text-muted-foreground transition-colors',
              'hover:text-foreground',
              'focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2',
            )}
          >
            Reset all
          </button>
        )}
      </div>
      <div className="space-y-3.5 px-4 py-4">
        {ctx.filterDefinitions.map(def => (
          <FilterControlField key={def.id} definition={def} />
        ))}
      </div>
    </div>
  )
}

// ── FilterControlField — label + control wrapper used in Sheet and Popover ────

interface FilterControlFieldProps {
  definition: FilterDefinition
}

function FilterControlField({ definition }: FilterControlFieldProps) {
  const { filters, setFilter } = useQueryToolbarContext()
  const value = filters[definition.id]
  const isActive = value !== undefined
  return (
    <div className="space-y-1.5">
      <span
        className={cn(
          'block text-[10px] font-medium uppercase tracking-[0.08em] transition-colors',
          isActive ? 'text-foreground' : 'text-muted-foreground/70',
        )}
      >
        {definition.label}
      </span>
      <SingleFilterControl definition={definition} value={value} onChange={v => setFilter(definition.id, v)} />
    </div>
  )
}

interface SingleFilterControlProps {
  definition: FilterDefinition
  value: FilterValue
  onChange: (v: FilterValue) => void
}

function SingleFilterControl({ definition, value, onChange }: SingleFilterControlProps) {
  switch (definition.type) {
    case 'select': {
      const Render = filterRendererRegistry.select
      return (
        <Render
          definition={definition}
          value={value as string | undefined}
          onChange={v => onChange(v)}
        />
      )
    }
    case 'multi-select': {
      const Render = filterRendererRegistry['multi-select']
      return (
        <Render
          definition={definition}
          value={value as string[] | undefined}
          onChange={v => onChange(v)}
        />
      )
    }
    case 'date-range': {
      const Render = filterRendererRegistry['date-range']
      return (
        <Render
          definition={definition}
          value={value as { from?: string, to?: string } | undefined}
          onChange={v => onChange(v)}
        />
      )
    }
    case 'boolean': {
      const Render = filterRendererRegistry.boolean
      return (
        <Render
          definition={definition}
          value={value as boolean | undefined}
          onChange={v => onChange(v)}
        />
      )
    }
  }
}

// ── PageSizeSegmented — segmented control used inside Sheet ───────────────────

interface PageSizeSegmentedProps {
  options: readonly number[]
  value: number
  onChange: (next: number) => void
}

function PageSizeSegmented({ options, value, onChange }: PageSizeSegmentedProps) {
  return (
    <div role="radiogroup" aria-label="Rows per page" className="flex gap-1 rounded-md border border-border/60 p-1">
      {options.map((opt) => {
        const selected = opt === value
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt)}
            className={cn(
              'h-9 flex-1 rounded-sm text-sm font-medium tabular-nums touch-manipulation transition-colors',
              'focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2',
              selected
                ? 'bg-foreground/10 text-foreground'
                : 'text-muted-foreground hover:bg-foreground/5',
            )}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

// ── PageSize (desktop inline) ──────────────────────────────────────────────────

interface PageSizeProps {
  className?: string
}

/**
 * Inline rows-per-page selector for desktop. Renders nothing on `<lg` —
 * mobile gets the segmented control inside the Filter Sheet instead.
 *
 * Default placement assumes the parent `<Bar>` flex layout — the `ml-auto`
 * pushes this slot to the right edge. Override `className` to reposition.
 */
function PageSize({ className }: PageSizeProps) {
  const { pageSize, pageSizeOptions, setPageSize } = useQueryToolbarContext()
  if (!pageSizeOptions || pageSizeOptions.length <= 1) {
    return null
  }
  return (
    <div className={cn('hidden lg:flex items-center gap-1.5 ml-auto', className)}>
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

// ── ChipRail ───────────────────────────────────────────────────────────────────

interface ActiveChip {
  definition: FilterDefinition
  value: NonNullable<FilterValue>
}

/**
 * Active filter chips with two empty-state behaviors:
 *   - <lg: collapses to zero height when no chips (saves vertical space).
 *   - >=lg: shows a muted keyboard hint so the row stays a stable height
 *     and teaches `/` and `F` shortcuts.
 *
 * Chip add/remove animates via AnimatePresence (motion-safe only).
 */
function ChipRail() {
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
    return (
      <div className="hidden min-h-7 items-center text-xs text-muted-foreground/70 lg:flex">
        {KEYBOARD_HINT_TEXT}
      </div>
    )
  }

  return (
    <div className="flex min-h-7 flex-wrap items-center gap-1.5">
      <AnimatePresence initial={false}>
        {active.map(({ definition, value }) => (
          <motion.div
            key={definition.id}
            layout
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
          >
            <Chip
              definition={definition}
              value={value}
              onClear={() => setFilter(definition.id, undefined)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

interface ChipProps {
  definition: FilterDefinition
  value: NonNullable<FilterValue>
  onClear: () => void
}

function Chip({ definition, value, onClear }: ChipProps) {
  const formatted = formatChipValue(definition, value)
  const fullText = `${definition.label}: ${formatted}`
  return (
    <Badge variant="secondary" className="relative max-w-55 gap-1 pr-1">
      <span className="truncate text-xs" title={fullText}>
        <span className="text-muted-foreground">{`${definition.label}: `}</span>
        <span>{formatted}</span>
      </span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear ${definition.label}`}
        className={cn(
          'relative z-10 ml-0.5 inline-flex size-4 items-center justify-center rounded touch-manipulation',
          'hover:bg-background/40',
          'focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2',
          // Inflate hit area to ≥32px without enlarging the visual chip.
          'before:absolute before:-inset-2 before:content-[""]',
        )}
      >
        <XIcon className="size-3" aria-hidden />
      </button>
    </Badge>
  )
}

// ── LiveStatus — sr-only aria-live announcer ──────────────────────────────────

function LiveStatus() {
  const { total, isLoading, isFetching } = useQueryToolbarContext()
  const { entityName } = useToolbarInternal()

  const message = useMemo(() => {
    if (isLoading) {
      return `Loading ${entityName}…`
    }
    if (isFetching) {
      return `Updating ${entityName}…`
    }
    if (total === 0) {
      return `No ${entityName} match the current filters.`
    }
    return `Showing ${formatTotalCount(total)} ${entityName}.`
  }, [total, isLoading, isFetching, entityName])

  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
  )
}

// ── Compound export ────────────────────────────────────────────────────────────

export const QueryToolbar = Object.assign(Root, {
  Bar,
  Search,
  FilterTrigger,
  PageSize,
  ChipRail,
  LiveStatus,
})
