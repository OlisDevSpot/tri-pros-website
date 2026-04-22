'use client'

import type { AppRouterOutputs } from '@/trpc/routers/app'

import { RadioTowerIcon, SearchIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { ALL_PSEUDO_ID } from '@/features/lead-sources-admin/constants/pseudo-ids'
import { Input } from '@/shared/components/ui/input'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { LeadSourceOverviewCard } from '@/shared/entities/lead-sources/components/overview-card'
import { cn } from '@/shared/lib/utils'

type LeadSourceRow = AppRouterOutputs['leadSourcesRouter']['list'][number]

interface LeadSourceListProps {
  sources: LeadSourceRow[] | undefined
  isLoading: boolean
  /** `selectedId` may be a uuid or the literal `'all'`. */
  selectedId: string | null
  onSelect: (id: string) => void
  /** Label for the range-scoped stat column (mirrors the global time picker). */
  rangeLabel: string
}

export function LeadSourceList({ sources, isLoading, selectedId, onSelect, rangeLabel }: LeadSourceListProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!sources) {
      return []
    }
    const q = search.trim().toLowerCase()
    if (!q) {
      return sources
    }
    return sources.filter(s =>
      s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q),
    )
  }, [sources, search])

  const allInRange = useMemo(
    () => (sources ?? []).reduce((acc, s) => acc + (s.leadsInRange ?? 0), 0),
    [sources],
  )

  const isAllSelected = selectedId === ALL_PSEUDO_ID

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" aria-hidden="true" />
        <Input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search lead sources…"
          autoComplete="off"
          spellCheck={false}
          className="h-9 pl-8"
          aria-label="Search lead sources"
        />
      </div>

      <nav aria-label="Lead sources" className="flex flex-col gap-1">
        {/* Pinned "All" pseudo-row — desktop only. On mobile the list itself
            is the "all" state, so tapping the row would be a no-op. */}
        <div className="hidden lg:contents">
          <AllRow
            total={allInRange}
            rangeLabel={rangeLabel}
            isSelected={isAllSelected}
            onSelect={() => onSelect(ALL_PSEUDO_ID)}
            disabled={isLoading}
          />

          <div role="separator" aria-hidden="true" className="mx-1 my-1 h-px bg-border/40" />
        </div>

        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
          : filtered.length === 0
            ? <EmptyState hasQuery={!!search.trim()} />
            : filtered.map(source => (
                <LeadSourceOverviewCard
                  key={source.id}
                  source={source}
                  isSelected={source.id === selectedId}
                  onClick={() => onSelect(source.id)}
                >
                  <LeadSourceOverviewCard.Indicator />
                  <LeadSourceOverviewCard.Identity />
                  <LeadSourceOverviewCard.Stat
                    value={source.leadsInRange}
                    label={rangeLabel}
                  />
                </LeadSourceOverviewCard>
              ))}
      </nav>
    </div>
  )
}

interface AllRowProps {
  total: number
  rangeLabel: string
  isSelected: boolean
  onSelect: () => void
  disabled: boolean
}

function AllRow({ total, rangeLabel, isSelected, onSelect, disabled }: AllRowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-current={isSelected ? 'true' : undefined}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left motion-safe:transition-colors',
        isSelected
          ? 'bg-primary/5 ring-1 ring-inset ring-primary/15'
          : 'hover:bg-muted/60 focus-visible:bg-muted/60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-px overflow-hidden">
        <span className="truncate text-sm font-medium text-foreground">All</span>
        <span className="truncate text-xs text-muted-foreground">Every lead source combined</span>
      </span>
      <span className="flex flex-col items-end gap-px tabular-nums">
        <span className="text-sm font-semibold text-foreground">{total}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{rangeLabel}</span>
      </span>
    </button>
  )
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className={cn(
      'flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 px-4 py-8 text-center',
    )}
    >
      <RadioTowerIcon aria-hidden="true" className="size-5 text-muted-foreground/50" />
      <p className="text-xs text-muted-foreground">
        {hasQuery ? 'No sources match your search.' : 'No lead sources yet.'}
      </p>
    </div>
  )
}
