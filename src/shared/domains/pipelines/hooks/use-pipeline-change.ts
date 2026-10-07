'use client'

import type { Pipeline } from '@/shared/constants/enums/pipelines'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { ROOTS } from '@/shared/config/roots'
import { onPipelineChange } from '@/shared/domains/pipelines/lib/on-pipeline-change'

export function usePipelineChange() {
  const router = useRouter()

  return useCallback((next: Pipeline) => {
    onPipelineChange(next, pipeline => router.push(ROOTS.dashboard.pipeline(pipeline)))
  }, [router])
}
