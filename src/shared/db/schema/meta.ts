import { pgEnum } from 'drizzle-orm/pg-core'
import {
  activityEntityTypes,
  activityTypes,
  mediaPhases,
  meetingOutcomes,
  meetingParticipantRoles,
  meetingPipelines,
  meetingTypes,
  projectTypes,
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
} from '@/shared/modules/construction/core/constants/enums'

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

// PIPELINES
export const meetingPipelineEnum = pgEnum('meeting_pipeline', meetingPipelines)

// VOIP IN-HOUSE (Twilio — agent ↔ already-known-customer comms)
// 4 enums per 2026-05-30 grill. See docs/plans/voip-in-house/phase-1-mvp.md GRILL RESULTS.
export const voipCallStatusEnum = pgEnum('voip_call_status', voipCallStatuses)
export const voipDirectionEnum = pgEnum('voip_direction', voipDirections)
export const voipMessageStatusEnum = pgEnum('voip_message_status', voipMessageStatuses)
export const voipLinkTokenTypeEnum = pgEnum('voip_link_token_type', voipLinkTokenTypes)

// VOIP CAMPAIGNS (JustCall): no status pgEnum — the campaign run-state lives on
// voip_campaigns.status as a typed text column (voipCampaignStatuses); see
// constants/enums/voip.ts. (The former voip_campaign_status pgEnum was deleted
// 2026-06-04 under the earlier CloudTalk perfect-separation model.)

// WAVE-1 DECOMPOSITION (epic #256/#259): the customer_profiles vocabularies
// are `text(..., { enum })` columns, NOT pgEnums — per the Closed Vocabulary
// Standard (enum-standardization.md#text-with-enum). No new pgEnum is minted
// here without a documented DB-side consumer.
