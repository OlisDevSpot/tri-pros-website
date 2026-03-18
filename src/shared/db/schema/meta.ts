import { pgEnum } from 'drizzle-orm/pg-core'
import {
  constructionTypes,
  homeAreas,
  mediaPhases,
  meetingStatuses,
  projectTypes,
  proposalStatuses,
  tradeLocations,
  userRoles,
  variableDataTypes,
  viewSources,
} from '@/shared/constants/enums'

export const userRoleEnum = pgEnum('user_role', userRoles)
export const constructionTypeEnum = pgEnum('construction_type', constructionTypes)
export const dataTypeEnum = pgEnum('data_type', variableDataTypes)
export const homeAreaEnum = pgEnum('home_area', homeAreas)
export const locationEnum = pgEnum('location', tradeLocations)
export const mediaPhaseEnum = pgEnum('media_phase', mediaPhases)
export const projectTypeEnum = pgEnum('project_type', projectTypes)
export const viewSourceEnum = pgEnum('view_source', viewSources)

// MEETINGS
export const meetingStatusEnum = pgEnum('meeting_status', meetingStatuses)

// PROPOSALS
export const proposalStatusEnum = pgEnum('proposal_status', proposalStatuses)
