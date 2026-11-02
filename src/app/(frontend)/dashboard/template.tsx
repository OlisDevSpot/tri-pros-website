import { DASHBOARD_MAIN_CLASS } from '@/features/agent-dashboard/constants/dashboard-main'

// No entrance animation: a page shows the moment its content commits. Besides the wait, a transform still
// animating on an ancestor makes scrollIntoView silently no-op on iOS Safari, so a fade here would also hold
// back the schedule's deep-link scroll until it settled.
// The page takes what the push banner above it leaves, so a shown banner never pushes the page's foot off-screen.
export function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <main className={DASHBOARD_MAIN_CLASS}>{children}</main>
    </div>
  )
}

export default DashboardTemplate
