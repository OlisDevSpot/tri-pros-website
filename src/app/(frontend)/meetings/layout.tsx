import { Suspense } from 'react'

export default function MeetingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-dvh"
      data-no-gutter-stable
      style={{
        background: `radial-gradient(150% 150% at 50% 0%, var(--background), var(--background), color-mix(in oklab, var(--primary) 30%, transparent))`,
      } as React.CSSProperties}
    >
      <Suspense>
        {children}
      </Suspense>
    </div>
  )
}
