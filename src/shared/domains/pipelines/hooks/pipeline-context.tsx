'use client'

import type { Pipeline } from '@/shared/constants/enums/pipelines'

import { useParams } from 'next/navigation'
import { createContext, use } from 'react'

import { pipelines } from '@/shared/constants/enums/pipelines'
import { STORAGE_KEYS } from '@/shared/constants/storage-keys'
import { usePipelineChange } from '@/shared/domains/pipelines/hooks/use-pipeline-change'

interface PipelineContextValue {
  pipeline: Pipeline
  setPipeline: (pipeline: Pipeline) => void
}

const PipelineContext = createContext<PipelineContextValue>({
  pipeline: 'fresh',
  setPipeline: () => {},
})

function isValidPipeline(value: unknown): value is Pipeline {
  return typeof value === 'string' && (pipelines as readonly string[]).includes(value)
}

/**
 * Reads the active pipeline from the route param and provides it via context.
 * setPipeline uses the centralized onPipelineChange handler.
 * Mount this in the pipeline layout: `dashboard/pipeline/[pipeline]/layout.tsx`
 */
export function PipelineProvider({ children }: { children: React.ReactNode }) {
  const params = useParams<{ pipeline: string }>()
  const raw = params.pipeline
  const pipeline: Pipeline = isValidPipeline(raw) ? raw : 'fresh'
  const changePipeline = usePipelineChange()

  return (
    <PipelineContext value={{ pipeline, setPipeline: changePipeline }}>
      {children}
    </PipelineContext>
  )
}

/**
 * Read the active pipeline from context (when inside pipeline routes)
 * or fall back to localStorage / 'fresh'.
 */
export function usePipeline(): PipelineContextValue {
  return use(PipelineContext)
}

/**
 * Read the last-selected pipeline from localStorage.
 * Use this outside of the pipeline route tree (e.g., sidebar).
 */
export function getStoredPipeline(): Pipeline {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_PIPELINE)
    if (isValidPipeline(stored)) {
      return stored
    }
  }
  catch {
    // SSR or storage unavailable
  }
  return 'fresh'
}
