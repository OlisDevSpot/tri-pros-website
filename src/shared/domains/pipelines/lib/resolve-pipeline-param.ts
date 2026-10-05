import type { Pipeline } from '@/shared/constants/enums/pipelines'

import { pipelines } from '@/shared/constants/enums/pipelines'

/** The pipeline a route param names, or the fresh pipeline for anything unknown. */
export function resolvePipelineParam(value: unknown): Pipeline {
  return pipelines.find(pipeline => pipeline === value) ?? 'fresh'
}
