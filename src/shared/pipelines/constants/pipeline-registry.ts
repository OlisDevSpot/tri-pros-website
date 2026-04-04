import type { PipelineConfig } from '../types'
import type { Pipeline } from '@/shared/types/enums/pipelines'

import { deadPipelineConfig } from './dead-pipeline'
import { freshPipelineConfig } from './fresh-pipeline'
import { leadsPipelineConfig } from './leads-pipeline'
import { projectsPipelineConfig } from './projects-pipeline'
import { rehashPipelineConfig } from './rehash-pipeline'

/** Labels keyed by pipeline. Order comes from the `pipelines` const array, not this object. */
export const PIPELINE_LABELS: Record<Pipeline, string> = {
  projects: 'Projects',
  fresh: 'Fresh',
  leads: 'Leads',
  rehash: 'Rehash',
  dead: 'Dead',
}

export const pipelineConfigs: Record<Pipeline, PipelineConfig> = {
  leads: leadsPipelineConfig,
  fresh: freshPipelineConfig,
  projects: projectsPipelineConfig,
  rehash: rehashPipelineConfig,
  dead: deadPipelineConfig,
}
