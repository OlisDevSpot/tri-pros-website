'use client'

import type { Pipeline } from '@/shared/types/enums/pipelines'

import { useParams, useRouter } from 'next/navigation'
import { createContext, useContext, useEffect } from 'react'

import { ROOTS } from '@/shared/config/roots'
import { pipelines } from '@/shared/constants/enums/pipelines'

const STORAGE_KEY = 'tri-pros:active-pipeline'

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
 * Persists the last-selected pipeline to localStorage for fallback.
 * Mount this in the pipeline layout: `dashboard/pipeline/[pipeline]/layout.tsx`
 */
export function PipelineProvider({ children }: { children: React.ReactNode }) {
  const params = useParams<{ pipeline: string }>()
  const router = useRouter()
  const raw = params.pipeline
  const pipeline: Pipeline = isValidPipeline(raw) ? raw : 'fresh'

  // Persist to localStorage whenever route changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, pipeline)
    }
    catch {
      // SSR or storage unavailable
    }
  }, [pipeline])

  function setPipeline(next: Pipeline) {
    router.push(ROOTS.dashboard.pipeline(next))
  }

  return (
    <PipelineContext value={{ pipeline, setPipeline }}>
      {children}
    </PipelineContext>
  )
}

/**
 * Read the active pipeline from context (when inside pipeline routes)
 * or fall back to localStorage / 'fresh'.
 */
export function usePipeline(): PipelineContextValue {
  return useContext(PipelineContext)
}

/**
 * Read the last-selected pipeline from localStorage.
 * Use this outside of the pipeline route tree (e.g., sidebar).
 */
export function getStoredPipeline(): Pipeline {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isValidPipeline(stored)) {
      return stored
    }
  }
  catch {
    // SSR or storage unavailable
  }
  return 'fresh'
}
