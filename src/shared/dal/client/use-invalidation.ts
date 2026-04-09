'use client'

import { useQueryClient } from '@tanstack/react-query'

import { useTRPC } from '@/trpc/helpers'

/**
 * Type-safe, centralized query invalidation.
 *
 * Two-tier design:
 *  - OWN ENTITY:   router-level queryFilter() → self-healing, new queries auto-covered
 *  - CROSS-ENTITY: procedure-level queryFilter() → precise, opt-in
 *  - DASHBOARD:    always router-level (any entity change refreshes all dashboard queries)
 *
 * If a router/procedure is renamed or restructured, TypeScript errors here — not
 * a silent runtime failure.
 */
export function useInvalidation() {
  const trpc = useTRPC()
  const qc = useQueryClient()

  // ── Cross-Entity Targets ───────────────────────────────────────
  // Procedure-level targets for precise cross-entity invalidation.
  // Type-safe: if a procedure is renamed/moved, TS errors here.
  const cross = {
    customerPipeline: () =>
      trpc.customerPipelinesRouter.getCustomerPipelineItems.queryFilter(),
    customerProfile: (customerId?: string) =>
      customerId
        ? trpc.customerPipelinesRouter.getCustomerProfile.queryFilter({ customerId })
        : trpc.customerPipelinesRouter.getCustomerProfile.queryFilter(),
    meetingCustomerProjects: () =>
      trpc.meetingsRouter.getCustomerProjects.queryFilter(),
    landingProjects: () =>
      trpc.landingRouter.projectsRouter.getProjects.queryFilter(),
  }

  // ── Invalidation Graph ─────────────────────────────────────────
  // Own entity: router-level queryFilter() (self-healing — new queries auto-covered)
  // Cross-entity: procedure-level targets from `cross` (precise)
  // Dashboard: always router-level (any entity change refreshes all dashboard queries)

  function invalidateCustomer(customerId?: string) {
    void qc.invalidateQueries(trpc.customerPipelinesRouter.queryFilter())
    void qc.invalidateQueries(trpc.dashboardRouter.queryFilter())
  }

  function invalidateMeeting(customerId?: string) {
    void qc.invalidateQueries(trpc.meetingsRouter.queryFilter())
    void qc.invalidateQueries(cross.customerPipeline())
    void qc.invalidateQueries(cross.customerProfile(customerId))
    void qc.invalidateQueries(trpc.dashboardRouter.queryFilter())
  }

  function invalidateProposal(proposalId?: string, customerId?: string) {
    void qc.invalidateQueries(trpc.proposalsRouter.queryFilter())
    void qc.invalidateQueries(cross.customerPipeline())
    void qc.invalidateQueries(cross.customerProfile(customerId))
    void qc.invalidateQueries(trpc.dashboardRouter.queryFilter())
  }

  function invalidateProject(projectId?: string, customerId?: string) {
    void qc.invalidateQueries(trpc.projectsRouter.queryFilter())
    void qc.invalidateQueries(cross.customerPipeline())
    void qc.invalidateQueries(cross.customerProfile(customerId))
    void qc.invalidateQueries(cross.meetingCustomerProjects())
    void qc.invalidateQueries(cross.landingProjects())
    void qc.invalidateQueries(trpc.dashboardRouter.queryFilter())
  }

  return { invalidateCustomer, invalidateMeeting, invalidateProposal, invalidateProject }
}
