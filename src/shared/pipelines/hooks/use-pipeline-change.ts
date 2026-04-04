'use client'

import type { Pipeline } from '@/shared/types/enums/pipelines'

import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { ROOTS } from '@/shared/config/roots'
import { onPipelineChange } from '@/shared/pipelines/lib/on-pipeline-change'
import { useTRPC } from '@/trpc/helpers'

/**
 * Returns a stable callback that handles all pipeline change side effects.
 * Use this in any component that needs to switch pipelines.
 */
export function usePipelineChange() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const trpc = useTRPC()

  return useCallback((next: Pipeline) => {
    onPipelineChange(next, {
      navigate: p => router.push(ROOTS.dashboard.pipeline(p)),
      invalidateQueries: () => {
        void queryClient.invalidateQueries(
          trpc.customerPipelinesRouter.getCustomerPipelineItems.queryFilter(),
        )
      },
    })
  }, [router, queryClient, trpc])
}
