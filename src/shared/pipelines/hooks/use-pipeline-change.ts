'use client'

import type { Pipeline } from '@/shared/constants/enums/pipelines'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { ROOTS } from '@/shared/config/roots'
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { onPipelineChange } from '@/shared/pipelines/lib/on-pipeline-change'

/**
 * Returns a stable callback that handles all pipeline change side effects.
 * Use this in any component that needs to switch pipelines.
 */
export function usePipelineChange() {
  const router = useRouter()
  const { invalidateCustomer } = useInvalidation()

  return useCallback((next: Pipeline) => {
    onPipelineChange(next, {
      navigate: p => router.push(ROOTS.dashboard.pipeline(p)),
      invalidateQueries: () => invalidateCustomer(),
    })
  }, [router, invalidateCustomer])
}
