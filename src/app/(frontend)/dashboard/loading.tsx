import { Skeleton } from '@/shared/components/ui/skeleton'

// Instant structural fallback for the dashboard content region while the page
// segment streams. Rendered INSIDE the persistent shell (sidebar +
// SidebarInset), so it covers only the content area — enough to replace the
// white cold-launch hang with on-brand structure on the shared #09090b canvas.
export default function DashboardLoading() {
  const cards = ['a', 'b', 'c', 'd', 'e', 'f']

  return (
    <div className="flex h-full flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(id => (
          <Skeleton key={id} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="min-h-40 w-full flex-1 rounded-xl" />
    </div>
  )
}
