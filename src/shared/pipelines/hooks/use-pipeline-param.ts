import { parseAsStringLiteral, useQueryState } from 'nuqs'

import { pipelines } from '@/shared/constants/enums/pipelines'

export function usePipelineParam() {
  return useQueryState(
    'pipeline',
    parseAsStringLiteral(pipelines).withDefault('fresh'),
  )
}
