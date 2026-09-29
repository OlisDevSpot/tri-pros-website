'use client'

import type { ReactNode } from 'react'

import type { UseColumnVisibilityResult } from '@/shared/components/data-table/lib/use-column-visibility'

import { QueryToolbarBar } from '@/shared/components/query-toolbar/ui/bar'
import { QueryToolbarChipRail } from '@/shared/components/query-toolbar/ui/chip-rail'
import { QueryToolbarColumnsTrigger } from '@/shared/components/query-toolbar/ui/columns-trigger'
import { QueryToolbarFilterTrigger } from '@/shared/components/query-toolbar/ui/filter-trigger'
import { QueryToolbarLiveStatus } from '@/shared/components/query-toolbar/ui/live-status'
import { QueryToolbarPageSize } from '@/shared/components/query-toolbar/ui/page-size'
import { QueryToolbarRefreshButton } from '@/shared/components/query-toolbar/ui/refresh-button'
import { QueryToolbarRowCapNotice } from '@/shared/components/query-toolbar/ui/row-cap-notice'
import { QueryToolbarSearch } from '@/shared/components/query-toolbar/ui/search'
import { QueryToolbarSort } from '@/shared/components/query-toolbar/ui/sort'

interface StandardProps {
  searchPlaceholder?: string
  visibility?: UseColumnVisibilityResult
  /** Rendered first in the bar, e.g. the calendar's Show toggle. */
  leading?: ReactNode
  /** Puts Sort in the desktop bar. Tables leave it off because their headers sort; below lg, Sort lives in the Filters sheet either way. */
  sort?: boolean
}

export function QueryToolbarStandard({ searchPlaceholder, visibility, leading, sort = false }: StandardProps) {
  return (
    <>
      <QueryToolbarBar>
        {leading}
        <QueryToolbarSearch placeholder={searchPlaceholder} />
        <QueryToolbarFilterTrigger />
        {sort && <QueryToolbarSort className="hidden lg:flex" />}
        {visibility && <QueryToolbarColumnsTrigger visibility={visibility} />}
        <QueryToolbarRefreshButton />
        <QueryToolbarPageSize />
      </QueryToolbarBar>
      <QueryToolbarChipRail />
      <QueryToolbarRowCapNotice />
      <QueryToolbarLiveStatus />
    </>
  )
}
