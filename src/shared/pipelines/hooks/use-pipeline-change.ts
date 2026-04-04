'use client'

import type { Pipeline } from '@/shared/types/enums/pipelines'

import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { ROOTS } from '@/shared/config/roots'
import { QUERY_KEYS } from '@/shared/dal/client/query-keys'
import { onPipelineChange } from '@/shared/pipelines/lib/on-pipeline-change'

/**
 * Returns a stable callback that handles all pipeline change side effects.
 * Use this in any component that needs to switch pipelines.
 */
export function usePipelineChange() {
  const router = useRouter()
  const queryClient = useQueryClient()

  return useCallback((next: Pipeline) => {
    onPipelineChange(next, {
      navigate: p => router.push(ROOTS.dashboard.pipeline(p)),
      invalidateQueries: () => {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customers.pipeline })
      },
    })
  }, [router, queryClient])
}
