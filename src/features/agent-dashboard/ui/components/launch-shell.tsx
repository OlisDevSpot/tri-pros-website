import { Suspense } from 'react'
import { DASHBOARD_MAIN_CLASS } from '@/features/agent-dashboard/constants/dashboard-main'
import { AppSidebarSkeleton } from '@/features/agent-dashboard/ui/components/app-sidebar-skeleton'
import { DashboardGenericContentSkeleton } from '@/features/agent-dashboard/ui/components/dashboard-generic-content-skeleton'
import { DashboardHomePendingView } from '@/features/agent-dashboard/ui/components/dashboard-home-pending-view'
import { DataViewPending } from '@/shared/components/data-view-pending'
import { SidebarInset, SidebarProvider } from '@/shared/components/ui/sidebar'
import { PwaLaunchHandoff } from '@/shared/domains/pwa/ui/pwa-launch-handoff'
import { ServiceWorkerRegistrar } from '@/shared/domains/pwa/ui/service-worker-registrar'

/**
 * The dashboard's loading frame, drawn with no session and no data so the page prerenders at build and
 * the service worker can hold it as a plain file. Same shape as the dashboard layout, so the swap to the
 * real layout moves nothing the cover might reveal early. The real layout reads the sidebar cookie; this
 * cannot, so the sidebar starts open. The home view reads URL state, which a static page must render
 * under a Suspense boundary.
 */
export function LaunchShell() {
  return (
    <>
      <SidebarProvider defaultOpen data-no-gutter-stable>
        <AppSidebarSkeleton />
        <SidebarInset className="h-full min-w-0 overflow-hidden bg-background">
          <div className="flex-1 min-h-0 pt-[env(safe-area-inset-top)]">
            <div className="flex h-full min-w-0 flex-col">
              <div className={DASHBOARD_MAIN_CLASS}>
                <Suspense fallback={<DashboardGenericContentSkeleton />}>
                  <DataViewPending>
                    <DashboardHomePendingView />
                  </DataViewPending>
                </Suspense>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <PwaLaunchHandoff />
      <ServiceWorkerRegistrar />
    </>
  )
}
