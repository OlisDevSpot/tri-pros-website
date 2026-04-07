/**
 * Centralized query key registry for all entities.
 *
 * tRPC v11 stores query keys as nested arrays:
 *   [['routerName', 'procedureName'], { input, type }]
 *
 * TanStack Query prefix matching compares position-by-position,
 * so to invalidate all queries for a router, use [['routerName']].
 * To invalidate a specific procedure, use [['routerName', 'procName']].
 *
 * Usage:
 *   queryClient.invalidateQueries({ queryKey: QUERY_KEYS.proposals.all })
 *   → invalidates getProposals, getProposal(id), duplicateProposal, etc.
 */

export const QUERY_KEYS = {
  customers: {
    all: [['customerPipelinesRouter']] as const,
    pipeline: [['customerPipelinesRouter', 'getCustomerPipelineItems']] as const,
    profile: (customerId?: string) =>
      customerId
        ? [['customerPipelinesRouter', 'getCustomerProfile'], { input: { customerId } }] as const
        : [['customerPipelinesRouter', 'getCustomerProfile']] as const,
  },

  meetings: {
    all: [['meetingsRouter']] as const,
    list: [['meetingsRouter', 'getAll']] as const,
    byId: (id: string) => [['meetingsRouter', 'getById'], { input: { id } }] as const,
    customerProjects: [['meetingsRouter', 'getCustomerProjects']] as const,
  },

  proposals: {
    all: [['proposalsRouter']] as const,
    list: [['proposalsRouter', 'getProposals']] as const,
    byId: (proposalId: string) => [['proposalsRouter', 'getProposal'], { input: { proposalId } }] as const,
  },

  projects: {
    all: [['projectsRouter']] as const,
    portfolio: [['projectsRouter', 'crud', 'getAll']] as const,
    byId: (id: string) => [['projectsRouter', 'crud', 'getForEdit'], { input: { id } }] as const,
  },

  landing: {
    all: [['landingRouter']] as const,
    projects: [['landingRouter', 'projectsRouter', 'getProjects']] as const,
  },

  dashboard: {
    all: [['dashboardRouter']] as const,
  },
} as const
