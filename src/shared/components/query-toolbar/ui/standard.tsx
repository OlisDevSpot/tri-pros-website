'use client'

import type { UseColumnVisibilityResult } from '@/shared/components/data-table/lib/use-column-visibility'

import { QueryToolbarBar } from '@/shared/components/query-toolbar/ui/bar'
import { QueryToolbarChipRail } from '@/shared/components/query-toolbar/ui/chip-rail'
import { QueryToolbarColumnsTrigger } from '@/shared/components/query-toolbar/ui/columns-trigger'
import { QueryToolbarFilterTrigger } from '@/shared/components/query-toolbar/ui/filter-trigger'
import { QueryToolbarLiveStatus } from '@/shared/components/query-toolbar/ui/live-status'
import { QueryToolbarPageSize } from '@/shared/components/query-toolbar/ui/page-size'
import { QueryToolbarRefreshButton } from '@/shared/components/query-toolbar/ui/refresh-button'
import { QueryToolbarSearch } from '@/shared/components/query-toolbar/ui/search'

interface StandardProps {
  searchPlaceholder?: string
  visibility?: UseColumnVisibilityResult
}

export function QueryToolbarStandard({ searchPlaceholder, visibility }: StandardProps) {
  return (
    <>
      <QueryToolbarBar>
        <QueryToolbarSearch placeholder={searchPlaceholder} />
        <QueryToolbarFilterTrigger />
        {visibility && <QueryToolbarColumnsTrigger visibility={visibility} />}
        <QueryToolbarRefreshButton />
        <QueryToolbarPageSize />
      </QueryToolbarBar>
      <QueryToolbarChipRail />
      <QueryToolbarLiveStatus />
    </>
  )
}
