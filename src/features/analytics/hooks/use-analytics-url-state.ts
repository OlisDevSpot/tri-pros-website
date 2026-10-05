'use client'

import { useQueryStates } from 'nuqs'

import { analyticsSearchParams } from '@/features/analytics/constants/query-parsers'

export function useAnalyticsUrlState() {
  return useQueryStates(analyticsSearchParams)
}
