export const proposalStatuses = ['draft', 'sent', 'approved', 'declined'] as const
export type ProposalStatus = (typeof proposalStatuses)[number]

/**
 * Initial-sale: first proposal on a customer/project (no project exists yet
 * at creation; one is created on approval).
 *
 * Additional-work: proposal added to an already-existing project (meeting
 * is already attached to a project at proposal creation time).
 *
 * Derived once at proposal creation from `meeting.projectId IS NOT NULL`,
 * then frozen — never changes after insert. Drives Zoho envelope assembly,
 * project-creation gating in the proposal table, and (eventually) the
 * customer-facing render template (#157).
 */
export const proposalKinds = ['initial-sale', 'additional-work'] as const
export type ProposalKind = (typeof proposalKinds)[number]

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
