import { SettingsView } from '@/features/agent-settings/ui/views/settings-view'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  await protectDashboardPage()
  return <SettingsView />
}
