import type {
  energyEfficientTradeAccessors,
  meetingOutcomes,
  meetingPainTypes,
  meetingPipelineStages,
  meetingTypes,
} from '@/shared/constants/enums/meetings'

export type MeetingPainType = (typeof meetingPainTypes)[number]
export type MeetingPipelineStage = (typeof meetingPipelineStages)[number]
export type MeetingType = (typeof meetingTypes)[number]
export type MeetingOutcome = (typeof meetingOutcomes)[number]
export type EnergyEfficientTrade = (typeof energyEfficientTradeAccessors)[number]
