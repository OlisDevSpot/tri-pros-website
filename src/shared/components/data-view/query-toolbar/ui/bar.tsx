'use client'

import type { ReactNode } from 'react'

import { useQueryToolbarContext } from '@/shared/components/data-view/query-toolbar/lib/context'
import { QueryToolbarChipRail } from '@/shared/components/data-view/query-toolbar/ui/chip-rail'
import { LoadingHairline } from '@/shared/components/loading-hairline'
import { cn } from '@/shared/lib/utils'

interface BarProps {
  className?: string
  children: ReactNode
}

export function QueryToolbarBar({ className, children }: BarProps) {
  const { query } = useQueryToolbarContext()
  const showShimmer = query.isPending || query.isFetching || query.isStale
  return (
    <div
      className={cn('relative flex items-center gap-2 lg:gap-3', className)}
    >
      {children}
      <QueryToolbarChipRail placement="inline" />
      <LoadingHairline isLoading={showShimmer} />
    </div>
  )
}
