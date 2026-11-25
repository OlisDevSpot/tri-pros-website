'use client'

import { DataViewBar } from '@/shared/components/data-view/core/ui/bar'
import { DataViewBody } from '@/shared/components/data-view/core/ui/body'
import { DataViewBoundary } from '@/shared/components/data-view/core/ui/boundary'
import { DataViewCount } from '@/shared/components/data-view/core/ui/count'
import { DataViewEmpty } from '@/shared/components/data-view/core/ui/empty'
import { DataViewRoot } from '@/shared/components/data-view/core/ui/root'
import { DataViewTitle } from '@/shared/components/data-view/core/ui/title'
import { DataViewToolbar } from '@/shared/components/data-view/core/ui/toolbar'

export const DataView = Object.assign(DataViewRoot, {
  Bar: DataViewBar,
  Title: DataViewTitle,
  Count: DataViewCount,
  Toolbar: DataViewToolbar,
  Body: DataViewBody,
  Empty: DataViewEmpty,
  Boundary: DataViewBoundary,
})
