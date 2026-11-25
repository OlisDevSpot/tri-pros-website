'use client'

import { QueryToolbarBar } from '@/shared/components/data-view/query-toolbar/ui/bar'
import { QueryToolbarChipRail } from '@/shared/components/data-view/query-toolbar/ui/chip-rail'
import { QueryToolbarColumnsTrigger } from '@/shared/components/data-view/query-toolbar/ui/columns-trigger'
import { QueryToolbarFilterTrigger } from '@/shared/components/data-view/query-toolbar/ui/filter-trigger'
import { QueryToolbarLiveStatus } from '@/shared/components/data-view/query-toolbar/ui/live-status'
import { QueryToolbarPageSize } from '@/shared/components/data-view/query-toolbar/ui/page-size'
import { QueryToolbarRefreshButton } from '@/shared/components/data-view/query-toolbar/ui/refresh-button'
import { QueryToolbarRoot } from '@/shared/components/data-view/query-toolbar/ui/root'
import { QueryToolbarRowCapNotice } from '@/shared/components/data-view/query-toolbar/ui/row-cap-notice'
import { QueryToolbarSearch } from '@/shared/components/data-view/query-toolbar/ui/search'
import { QueryToolbarSort } from '@/shared/components/data-view/query-toolbar/ui/sort'
import { QueryToolbarStandard } from '@/shared/components/data-view/query-toolbar/ui/standard'

export const QueryToolbar = Object.assign(QueryToolbarRoot, {
  Bar: QueryToolbarBar,
  Search: QueryToolbarSearch,
  FilterTrigger: QueryToolbarFilterTrigger,
  ColumnsTrigger: QueryToolbarColumnsTrigger,
  RefreshButton: QueryToolbarRefreshButton,
  PageSize: QueryToolbarPageSize,
  ChipRail: QueryToolbarChipRail,
  LiveStatus: QueryToolbarLiveStatus,
  Sort: QueryToolbarSort,
  RowCapNotice: QueryToolbarRowCapNotice,
  Standard: QueryToolbarStandard,
})
