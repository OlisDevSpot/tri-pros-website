'use client'

import { use } from 'react'

import { DataViewPendingContext } from '@/shared/dal/client/lib/data-view-pending-context'

export function useIsDataViewPending(): boolean {
  return use(DataViewPendingContext)
}
