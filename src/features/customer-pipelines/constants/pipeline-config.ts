import type { CustomerPipeline } from '@/shared/types/enums'

import {
  ACTIVE_ALLOWED_DRAG_TRANSITIONS,
  ACTIVE_BLOCKED_MESSAGES,
  activeStageConfig,
  customerPipelineStages,
} from './active-pipeline-stages'
import {
  DEAD_ALLOWED_DRAG_TRANSITIONS,
  DEAD_BLOCKED_MESSAGES,
  deadPipelineStages,
  deadStageConfig,
} from './dead-pipeline-stages'
import {
  REHASH_ALLOWED_DRAG_TRANSITIONS,
  REHASH_BLOCKED_MESSAGES,
  rehashPipelineStages,
  rehashStageConfig,
} from './rehash-pipeline-stages'

export const pipelineConfigs = {
  active: {
    stages: customerPipelineStages,
    stageConfig: activeStageConfig,
    allowedTransitions: ACTIVE_ALLOWED_DRAG_TRANSITIONS,
    blockedMessages: ACTIVE_BLOCKED_MESSAGES,
  },
  rehash: {
    stages: rehashPipelineStages,
    stageConfig: rehashStageConfig,
    allowedTransitions: REHASH_ALLOWED_DRAG_TRANSITIONS,
    blockedMessages: REHASH_BLOCKED_MESSAGES,
  },
  dead: {
    stages: deadPipelineStages,
    stageConfig: deadStageConfig,
    allowedTransitions: DEAD_ALLOWED_DRAG_TRANSITIONS,
    blockedMessages: DEAD_BLOCKED_MESSAGES,
  },
} as const satisfies Record<CustomerPipeline, unknown>
