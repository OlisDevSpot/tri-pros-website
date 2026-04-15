import type {
  electricProviders,
  incentiveTypes,
  projectTypes,
  proposalStatuses,
  validThroughTimeframes,
  variableDataTypes,
  variableGroups,
  viewSources,
} from '@/shared/constants/enums/proposals'

export type ProposalStatus = (typeof proposalStatuses)[number]
export type ProjectType = (typeof projectTypes)[number]
export type ElectricProvider = (typeof electricProviders)[number]
export type VariableDataType = (typeof variableDataTypes)[number]
export type VariableGroup = (typeof variableGroups)[number]
export type IncentiveType = (typeof incentiveTypes)[number]
export type ValidThroughTimeframe = (typeof validThroughTimeframes)[number]
export type ViewSource = (typeof viewSources)[number]
