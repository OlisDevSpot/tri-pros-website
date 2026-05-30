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
  voipCallDispositions,
  voipCallStatuses,
  voipCampaignStatuses,
  voipDidRoles,
  voipDidStatuses,
  voipDncSources,
  voipLinkTokenTypes,
  voipMessageDirections,
  voipMessageStatuses,
  voipSources,
  voipTransferModes,
  voipUserAvailabilities,
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

// VOIP IN-HOUSE (Twilio — agent comms + DIDs + DNC)
export const voipSourceEnum = pgEnum('voip_source', voipSources)
export const voipCallStatusEnum = pgEnum('voip_call_status', voipCallStatuses)
export const voipCallDispositionEnum = pgEnum('voip_call_disposition', voipCallDispositions)
export const voipDidStatusEnum = pgEnum('voip_did_status', voipDidStatuses)
export const voipDidRoleEnum = pgEnum('voip_did_role', voipDidRoles)
export const voipDncSourceEnum = pgEnum('voip_dnc_source', voipDncSources)
export const voipUserAvailabilityEnum = pgEnum('voip_user_availability', voipUserAvailabilities)
export const voipTransferModeEnum = pgEnum('voip_transfer_mode', voipTransferModes)
export const voipMessageDirectionEnum = pgEnum('voip_message_direction', voipMessageDirections)
export const voipMessageStatusEnum = pgEnum('voip_message_status', voipMessageStatuses)
export const voipLinkTokenTypeEnum = pgEnum('voip_link_token_type', voipLinkTokenTypes)

// VOIP CAMPAIGNS (CloudTalk-driven lead-to-meeting pipeline)
export const voipCampaignStatusEnum = pgEnum('voip_campaign_status', voipCampaignStatuses)
