'use client'

import type { ReactNode } from 'react'

import { LoadingHairline } from '@/shared/components/loading-hairline'
import { useQueryToolbarContext } from '@/shared/components/query-toolbar/lib/context'
import { QueryToolbarChipRail } from '@/shared/components/query-toolbar/ui/chip-rail'
import { cn } from '@/shared/lib/utils'

interface BarProps {
  className?: string
  children: ReactNode
}

export function QueryToolbarBar({ className, children }: BarProps) {
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
      <QueryToolbarChipRail placement="inline" />
      <LoadingHairline isLoading={showShimmer} />
    </div>
  )
}
