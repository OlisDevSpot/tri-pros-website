'use client'

import type { AppRouterOutputs } from '@/trpc/routers/app'

import { RadioTowerIcon, SearchIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Input } from '@/shared/components/ui/input'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { LeadSourceOverviewCard } from '@/shared/entities/lead-sources/components/overview-card'
import { cn } from '@/shared/lib/utils'

type LeadSourceRow = AppRouterOutputs['leadSourcesRouter']['list'][number]

interface LeadSourceListProps {
  sources: LeadSourceRow[] | undefined
  isLoading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
}

export function LeadSourceList({ sources, isLoading, selectedId, onSelect }: LeadSourceListProps) {
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
                    value={source.leadsThisMonth}
                    label="This month"
                  />
                </LeadSourceOverviewCard>
              ))}
      </nav>
    </div>
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
