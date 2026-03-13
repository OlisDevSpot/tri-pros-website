import type { dashboardSteps } from '@/features/agent-dashboard/constants/dashboard-steps'

export type DashboardStep = (typeof dashboardSteps)[number]
