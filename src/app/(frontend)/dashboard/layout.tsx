import { Suspense } from 'react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="h-dvh flex flex-col"
      data-no-gutter-stable
      style={{
        '--sidebar-width': '76px',
        '--sidebar-height': '68px',
        'background': `radial-gradient(150% 150% at 50% 0%, var(--background), var(--background), color-mix(in oklab, var(--primary) 60%, transparent))`,
      } as React.CSSProperties}
    >
      <div className="container grow min-h-0">
        <div className="h-full">
          <Suspense>
            {children}
          </Suspense>
        </div>
      </div>
    </div>
  )
}
