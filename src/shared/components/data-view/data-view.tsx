'use client'

import { DataViewBar } from '@/shared/components/data-view/ui/bar'
import { DataViewBody } from '@/shared/components/data-view/ui/body'
import { DataViewBoundary } from '@/shared/components/data-view/ui/boundary'
import { DataViewCount } from '@/shared/components/data-view/ui/count'
import { DataViewEmpty } from '@/shared/components/data-view/ui/empty'
import { DataViewRoot } from '@/shared/components/data-view/ui/root'
import { DataViewTitle } from '@/shared/components/data-view/ui/title'
import { DataViewToolbar } from '@/shared/components/data-view/ui/toolbar'

export const DataView = Object.assign(DataViewRoot, {
  Bar: DataViewBar,
  Title: DataViewTitle,
  Count: DataViewCount,
  Toolbar: DataViewToolbar,
  Body: DataViewBody,
  Empty: DataViewEmpty,
  Boundary: DataViewBoundary,
})
