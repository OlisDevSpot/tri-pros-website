/**
 * Centralized query key registry for all entities.
 *
 * Each entity defines a hierarchy of query keys that can be invalidated
 * at different granularity levels. Invalidating a parent key also
 * invalidates all child keys (TanStack Query prefix matching).
 *
 * Usage:
 *   queryClient.invalidateQueries({ queryKey: QUERY_KEYS.proposals.all })
 *   → invalidates getProposals, getProposal(id), etc.
 */

export const QUERY_KEYS = {
  customers: {
    all: ['customerPipelinesRouter'] as const,
    pipeline: ['customerPipelinesRouter', 'getCustomerPipelineItems'] as const,
    profile: (customerId?: string) =>
      customerId
        ? ['customerPipelinesRouter', 'getCustomerProfile', { input: { customerId } }] as const
        : ['customerPipelinesRouter', 'getCustomerProfile'] as const,
  },

  meetings: {
    all: ['meetingsRouter'] as const,
    list: ['meetingsRouter', 'getAll'] as const,
    byId: (id: string) => ['meetingsRouter', 'getById', { input: { id } }] as const,
    customerProjects: ['meetingsRouter', 'getCustomerProjects'] as const,
  },

  proposals: {
    all: ['proposalsRouter'] as const,
    list: ['proposalsRouter', 'getProposals'] as const,
    byId: (proposalId: string) => ['proposalsRouter', 'getProposal', { input: { proposalId } }] as const,
  },

  projects: {
    all: ['projectsRouter'] as const,
    portfolio: ['projectsRouter', 'portfolioCrud', 'getAll'] as const,
    byId: (id: string) => ['projectsRouter', 'portfolioCrud', 'getForEdit', { input: { id } }] as const,
  },
} as const
