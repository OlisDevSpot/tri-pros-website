import type { ComponentType } from 'react'

import dynamic from 'next/dynamic'

import { ROOTS } from '@/shared/config/roots'

// Lazy, so the layout's bundle doesn't carry every page; the pending context (not these components) keeps them from
// reading, so each one is its page's own loading state.
export const DASHBOARD_ROUTE_PENDING_VIEWS: Record<string, ComponentType> = {
  [ROOTS.dashboard.root]: dynamic(() => import('@/features/agent-dashboard/ui/components/dashboard-home-pending-view').then(m => m.DashboardHomePendingView)),
  [ROOTS.dashboard.customers.root()]: dynamic(() => import('@/features/agent-dashboard/ui/components/customers-route-pending-view').then(m => m.CustomersRoutePendingView)),
  [ROOTS.dashboard.meetings.root()]: dynamic(() => import('@/features/records-management/ui/views/meetings-records-view').then(m => m.MeetingsRecordsView)),
  [ROOTS.dashboard.proposals.root()]: dynamic(() => import('@/features/agent-dashboard/ui/components/proposals-route-pending-view').then(m => m.ProposalsRoutePendingView)),
  [ROOTS.dashboard.projects.root()]: dynamic(() => import('@/features/records-management/ui/views/projects-records-view').then(m => m.ProjectsRecordsView)),
  [ROOTS.dashboard.schedule()]: dynamic(() => import('@/features/schedule-management/ui/views/schedule-view').then(m => m.ScheduleView)),
}
