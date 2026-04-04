import type { PipelineConfig } from '../types'
import type { Pipeline } from '@/shared/types/enums/pipelines'

import { deadPipelineConfig } from './dead-pipeline'
import { freshPipelineConfig } from './fresh-pipeline'
import { projectsPipelineConfig } from './projects-pipeline'
import { rehashPipelineConfig } from './rehash-pipeline'

export const PIPELINE_LABELS: Record<Pipeline, string> = {
  fresh: 'Fresh',
  projects: 'Projects',
  rehash: 'Rehash',
  dead: 'Dead',
}

export const pipelineConfigs: Record<Pipeline, PipelineConfig> = {
  fresh: freshPipelineConfig,
  projects: projectsPipelineConfig,
  rehash: rehashPipelineConfig,
  dead: deadPipelineConfig,
}
