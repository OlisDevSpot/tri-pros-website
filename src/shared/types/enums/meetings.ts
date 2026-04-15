import type {
  energyEfficientTradeAccessors,
  meetingOutcomes,
  meetingPainTypes,
  meetingTypes,
} from '@/shared/constants/enums/meetings'

export type MeetingPainType = (typeof meetingPainTypes)[number]
export type MeetingType = (typeof meetingTypes)[number]
export type MeetingOutcome = (typeof meetingOutcomes)[number]
export type EnergyEfficientTrade = (typeof energyEfficientTradeAccessors)[number]
