'use client'

import type { QueryClient } from '@tanstack/react-query'

import { QUERY_KEYS } from './query-keys'

/**
 * Centralized query invalidation for entity mutations.
 *
 * When an entity is mutated (created, updated, deleted), call the
 * corresponding invalidation function. This ensures ALL dependent
 * queries are refreshed — no more scattered, incomplete invalidation.
 *
 * Each function invalidates the entity's own queries plus any
 * cross-entity queries that depend on it.
 */

/** Invalidate after any customer mutation (edit profile, move pipeline, etc.) */
export function invalidateCustomer(qc: QueryClient, customerId?: string) {
  void qc.invalidateQueries({ queryKey: QUERY_KEYS.customers.pipeline })
  void qc.invalidateQueries({ queryKey: QUERY_KEYS.customers.profile(customerId) })
  void qc.invalidateQueries({ queryKey: QUERY_KEYS.dashboard.all })
}

/** Invalidate after any meeting mutation (create, update, delete, assign rep, change outcome) */
export function invalidateMeeting(qc: QueryClient, customerId?: string) {
  void qc.invalidateQueries({ queryKey: QUERY_KEYS.meetings.list })
  void qc.invalidateQueries({ queryKey: QUERY_KEYS.customers.pipeline })
  void qc.invalidateQueries({ queryKey: QUERY_KEYS.customers.profile(customerId) })
  void qc.invalidateQueries({ queryKey: QUERY_KEYS.meetings.customerProjects })
  void qc.invalidateQueries({ queryKey: QUERY_KEYS.dashboard.all })
}

/** Invalidate after any proposal mutation (create, update status, delete, send) */
export function invalidateProposal(qc: QueryClient, proposalId?: string, customerId?: string) {
  void qc.invalidateQueries({ queryKey: QUERY_KEYS.proposals.list })
  if (proposalId) {
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.proposals.byId(proposalId) })
  }
  // Proposals affect pipeline values + customer profile
  void qc.invalidateQueries({ queryKey: QUERY_KEYS.customers.pipeline })
  void qc.invalidateQueries({ queryKey: QUERY_KEYS.customers.profile(customerId) })
  void qc.invalidateQueries({ queryKey: QUERY_KEYS.dashboard.all })
}

/** Invalidate after any project mutation (create, update, delete) */
export function invalidateProject(qc: QueryClient, projectId?: string, customerId?: string) {
  void qc.invalidateQueries({ queryKey: QUERY_KEYS.projects.portfolio })
  if (projectId) {
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.projects.byId(projectId) })
  }
  // Projects affect pipeline + customer profile (projects tab)
  void qc.invalidateQueries({ queryKey: QUERY_KEYS.customers.pipeline })
  void qc.invalidateQueries({ queryKey: QUERY_KEYS.customers.profile(customerId) })
  void qc.invalidateQueries({ queryKey: QUERY_KEYS.meetings.customerProjects })
  void qc.invalidateQueries({ queryKey: QUERY_KEYS.dashboard.all })
}
