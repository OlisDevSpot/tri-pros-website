import type { Pipeline } from '@/shared/constants/enums/pipelines'

import { STORAGE_KEYS } from '@/shared/constants/storage-keys'

/** localStorage keys that must reset when pipeline changes */
const PIPELINE_SCOPED_KEYS = [
  STORAGE_KEYS.MEETINGS_SCOPE,
  STORAGE_KEYS.PROPOSALS_SCOPE,
  STORAGE_KEYS.MEETINGS_FILTERED_COUNT,
  STORAGE_KEYS.PROPOSALS_FILTERED_COUNT,
] as const

/**
 * Single source of truth for all pipeline change side effects.
 * Every callsite (sidebar, PipelineSelect, context) must use this.
 *
 * Handles: localStorage update, scoped state reset, query invalidation, navigation.
 */
export function onPipelineChange(
  next: Pipeline,
  options: {
    navigate: (pipeline: Pipeline) => void
    invalidateQueries?: () => void
  },
) {
  // 1. Update active pipeline in localStorage
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PIPELINE, next)

    // 2. Reset pipeline-scoped state (scope toggles, filtered counts)
    for (const key of PIPELINE_SCOPED_KEYS) {
      localStorage.removeItem(key)
    }
  }
  catch {
    // SSR or storage unavailable
  }

  // 3. Invalidate pipeline-filtered queries
  options.invalidateQueries?.()

  // 4. Navigate to the new pipeline route
  options.navigate(next)
}
