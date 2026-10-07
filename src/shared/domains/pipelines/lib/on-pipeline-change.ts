import type { Pipeline } from '@/shared/constants/enums/pipelines'

import { STORAGE_KEYS } from '@/shared/constants/storage-keys'

// The stored pipeline is the sidebar's and the mobile dock's link target outside the pipeline routes. Nothing is
// invalidated here: a board's read carries its pipeline in the query key, so switching back lands on cached rows.
export function onPipelineChange(next: Pipeline, navigate: (pipeline: Pipeline) => void) {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PIPELINE, next)
  }
  catch {
    // SSR or storage unavailable
  }
  navigate(next)
}
