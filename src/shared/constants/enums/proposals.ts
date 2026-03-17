export const proposalStatuses = ['draft', 'sent', 'approved', 'declined'] as const
export const projectTypes = ['general-remodeling', 'energy-efficient'] as const
export const electricProviders = ['ladwp', 'edison', 'glendale water & power', 'burbank water & power', 'riverside public utilities', 'pg&e', 'other'] as const
export const variableDataTypes = ['text', 'select', 'number', 'boolean'] as const
export const variableGroups = ['project', 'trade'] as const
export const incentiveTypes = ['discount', 'tax-credit', 'cash-back', 'exclusive-offer', 'other'] as const
export const validThroughTimeframes = ['30 days', '60 days', '90 days', '180 days', '365 days'] as const
export const viewSources = ['email', 'direct', 'unknown'] as const

// Pipeline stages (customer journey — proposal phase)
export const proposalPipelineStages = [
  'proposal_sent',
  'contract_sent',
  'approved',
  'declined',
] as const
