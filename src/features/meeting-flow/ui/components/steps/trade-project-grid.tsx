'use client'

import type { PortfolioProject } from '@/shared/entities/projects/types'
import type { ScopeOrAddon } from '@/shared/services/notion/lib/scopes/schema'
import type { Trade } from '@/shared/services/notion/lib/trades/schema'
import { useMemo, useState } from 'react'
import { PortfolioGrid } from '@/features/project-management/ui/components/portfolio-grid'
import { PortfolioPagination } from '@/features/project-management/ui/components/portfolio-pagination'
import { useIsMobile } from '@/shared/hooks/use-mobile'

interface TradeProjectGridProps {
  tradeName: string
  projects: PortfolioProject[]
  allScopes: ScopeOrAddon[]
  allTrades: Trade[]
}

export function TradeProjectGrid({ tradeName, projects, allScopes, allTrades }: TradeProjectGridProps) {
  const isMobile = useIsMobile()
  const perPage = isMobile ? 2 : 3
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(projects.length / perPage))
  const safePage = Math.min(page, totalPages)

  const paginatedProjects = useMemo(() => {
    const start = (safePage - 1) * perPage
    return projects.slice(start, start + perPage)
  }, [projects, safePage, perPage])

  // perPage as string for PortfolioPagination (value doesn't matter since selector is hidden)
  const perPageStr = String(perPage) as '10' | '20'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold tracking-tight">{tradeName}</h3>
        <span className="text-xs text-muted-foreground">
          {projects.length}
          {' '}
          {projects.length === 1 ? 'project' : 'projects'}
        </span>
      </div>

      <PortfolioGrid
        projects={paginatedProjects}
        allScopes={allScopes}
        allTrades={allTrades}
      />

      {totalPages > 1 && (
        <PortfolioPagination
          page={safePage}
          totalPages={totalPages}
          totalFiltered={projects.length}
          perPage={perPageStr}
          onPageChange={setPage}
          onPerPageChange={() => {}}
          hidePerPageSelector
        />
      )}
    </div>
  )
}
