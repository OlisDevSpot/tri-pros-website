export const proposalStatuses = ['draft', 'sent', 'approved', 'declined'] as const
export type ProposalStatus = (typeof proposalStatuses)[number]

export const projectTypes = ['general-remodeling', 'energy-efficient'] as const
export type ProjectType = (typeof projectTypes)[number]

export const incentiveTypes = ['discount', 'tax-credit', 'cash-back', 'exclusive-offer', 'other'] as const
export type IncentiveType = (typeof incentiveTypes)[number]

export const validThroughTimeframes = ['30 days', '60 days', '90 days', '180 days', '365 days'] as const
export type ValidThroughTimeframe = (typeof validThroughTimeframes)[number]

export const viewSources = ['email', 'sms', 'direct', 'unknown'] as const
export type ViewSource = (typeof viewSources)[number]

export const contractEvents = ['viewed', 'completed', 'declined'] as const
export type ContractEvent = (typeof contractEvents)[number]
