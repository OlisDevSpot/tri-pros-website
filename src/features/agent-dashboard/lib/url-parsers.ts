import { parseAsString, parseAsStringLiteral } from 'nuqs'

import { dashboardSteps } from '@/features/agent-dashboard/constants/dashboard-steps'

export const dashboardStepParser = parseAsStringLiteral(dashboardSteps)
  .withDefault('action-center')
  .withOptions({ clearOnDefault: false })

export const editMeetingIdParser = parseAsString.withDefault('').withOptions({ clearOnDefault: true })

export const proposalIdParser = parseAsString.withDefault('').withOptions({ clearOnDefault: true })

export const editProjectIdParser = parseAsString.withDefault('').withOptions({ clearOnDefault: true })
