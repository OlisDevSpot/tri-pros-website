import { parseAsStringLiteral } from 'nuqs'

import { dashboardSteps } from '@/features/agent-dashboard/constants/dashboard-steps'

export const dashboardStepParser = parseAsStringLiteral(dashboardSteps)
  .withDefault('customer-pipelines')
  .withOptions({ clearOnDefault: false })
