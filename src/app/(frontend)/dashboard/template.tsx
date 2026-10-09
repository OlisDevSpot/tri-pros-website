import { DASHBOARD_MAIN_CLASS } from '@/features/agent-dashboard/constants/dashboard-main'

// No entrance animation: a page shows the moment its content commits. Besides the wait, a transform still
// animating on an ancestor makes scrollIntoView silently no-op on iOS Safari, so a fade here would also hold
// back the schedule's deep-link scroll until it settled.
export function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-w-0 flex-col">
      <main className={DASHBOARD_MAIN_CLASS}>{children}</main>
    </div>
  )
}

export default DashboardTemplate
