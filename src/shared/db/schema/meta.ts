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
  proposalKinds,
  proposalStatuses,
  userRoles,
  viewSources,
  voipCallStatuses,
  voipDirections,
  voipLinkTokenTypes,
  voipMessageStatuses,
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
export const proposalKindEnum = pgEnum('proposal_kind', proposalKinds)

// CUSTOMER PIPELINES
export const customerPipelineEnum = pgEnum('customer_pipeline', customerPipelines)

// PIPELINES
export const meetingPipelineEnum = pgEnum('meeting_pipeline', meetingPipelines)
export const projectStatusEnum = pgEnum('project_status', projectStatuses)

// LEADS
export const leadTypeEnum = pgEnum('lead_type', leadTypes)

// VOIP IN-HOUSE (Twilio — agent ↔ already-known-customer comms)
// 4 enums per 2026-05-30 grill. See docs/plans/voip-in-house/phase-1-mvp.md GRILL RESULTS.
export const voipCallStatusEnum = pgEnum('voip_call_status', voipCallStatuses)
export const voipDirectionEnum = pgEnum('voip_direction', voipDirections)
export const voipMessageStatusEnum = pgEnum('voip_message_status', voipMessageStatuses)
export const voipLinkTokenTypeEnum = pgEnum('voip_link_token_type', voipLinkTokenTypes)

// VOIP CAMPAIGNS (CloudTalk): no local status pgEnum — CloudTalk is the sole
// source of truth for lead lifecycle (perfect separation, confirmed 2026-06-04).
// voip_campaign_status enum deleted 2026-06-04; see constants/enums/voip.ts.
