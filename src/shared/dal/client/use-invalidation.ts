'use client'

import { useQueryClient } from '@tanstack/react-query'

import { useTRPC } from '@/trpc/helpers'

/**
 * Type-safe, centralized query invalidation.
 *
 * Two-tier design:
 *  - OWN ENTITY:   router-level pathFilter() → self-healing, new queries auto-covered
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

  // ── Entity Invalidators ────────────────────────────────────────
  // Own entity: router-level pathFilter() (self-healing — new queries auto-covered)
  // Cross-entity: procedure-level queryFilter() (precise, opt-in)
  // Dashboard: always router-level (any entity change refreshes all dashboard queries)

  function invalidateCustomer() {
    void qc.invalidateQueries(trpc.customerPipelinesRouter.pathFilter())
    void qc.invalidateQueries(trpc.dashboardRouter.pathFilter())
  }

  function invalidateMeeting(opts?: { meetingId?: string, customerId?: string }) {
    void qc.invalidateQueries(trpc.meetingsRouter.pathFilter())
    void qc.invalidateQueries(cross.customerPipeline())
    void qc.invalidateQueries(cross.customerProfile(opts?.customerId))
    void qc.invalidateQueries(trpc.dashboardRouter.pathFilter())
  }

  function invalidateProposal(opts?: { proposalId?: string, customerId?: string }) {
    void qc.invalidateQueries(trpc.proposalsRouter.pathFilter())
    void qc.invalidateQueries(cross.customerPipeline())
    void qc.invalidateQueries(cross.customerProfile(opts?.customerId))
    void qc.invalidateQueries(trpc.dashboardRouter.pathFilter())
  }

  function invalidateProject(opts?: { projectId?: string, customerId?: string }) {
    void qc.invalidateQueries(trpc.projectsRouter.pathFilter())
    void qc.invalidateQueries(cross.customerPipeline())
    void qc.invalidateQueries(cross.customerProfile(opts?.customerId))
    void qc.invalidateQueries(cross.meetingCustomerProjects())
    void qc.invalidateQueries(cross.landingProjects())
    void qc.invalidateQueries(trpc.dashboardRouter.pathFilter())
  }

  function invalidateActivities() {
    void qc.invalidateQueries(trpc.scheduleRouter.pathFilter())
    void qc.invalidateQueries(trpc.dashboardRouter.pathFilter())
  }

  function invalidateAgentSettings() {
    void qc.invalidateQueries(trpc.agentSettingsRouter.pathFilter())
  }

  function invalidateLeadSource() {
    void qc.invalidateQueries(trpc.leadSourcesRouter.pathFilter())
  }

  return {
    invalidateCustomer,
    invalidateMeeting,
    invalidateProposal,
    invalidateProject,
    invalidateActivities,
    invalidateAgentSettings,
    invalidateLeadSource,
  }
}
