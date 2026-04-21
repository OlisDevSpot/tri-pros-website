import { pgEnum } from 'drizzle-orm/pg-core'
import {
  activityEntityTypes,
  activityTypes,
  customerPipelines,
  leadTypes,
  mediaPhases,
  meetingOutcomes,
  meetingParticipantRoles,
  meetingPipelines,
  meetingTypes,
  projectStatuses,
  projectTypes,
  proposalStatuses,
  userRoles,
  viewSources,
} from '@/shared/constants/enums'
import {
  constructionTypes,
  homeAreas,
  tradeLocations,
  variableDataTypes,
} from '@/shared/domains/construction/constants/enums'

export const activityTypeEnum = pgEnum('activity_type', activityTypes)
export const activityEntityTypeEnum = pgEnum('activity_entity_type', activityEntityTypes)

export const userRoleEnum = pgEnum('user_role', userRoles)
export const constructionTypeEnum = pgEnum('construction_type', constructionTypes)
export const dataTypeEnum = pgEnum('data_type', variableDataTypes)
export const homeAreaEnum = pgEnum('home_area', homeAreas)
export const locationEnum = pgEnum('location', tradeLocations)
export const mediaPhaseEnum = pgEnum('media_phase', mediaPhases)
export const projectTypeEnum = pgEnum('project_type', projectTypes)
export const viewSourceEnum = pgEnum('view_source', viewSources)

// MEETINGS
export const meetingOutcomeEnum = pgEnum('meeting_outcome', meetingOutcomes)
export const meetingParticipantRoleEnum = pgEnum('meeting_participant_role', meetingParticipantRoles)
export const meetingTypeEnum = pgEnum('meeting_type', meetingTypes)

// PROPOSALS
export const proposalStatusEnum = pgEnum('proposal_status', proposalStatuses)

// CUSTOMER PIPELINES
export const customerPipelineEnum = pgEnum('customer_pipeline', customerPipelines)

// PIPELINES
export const meetingPipelineEnum = pgEnum('meeting_pipeline', meetingPipelines)
export const projectStatusEnum = pgEnum('project_status', projectStatuses)

// LEADS
export const leadTypeEnum = pgEnum('lead_type', leadTypes)
