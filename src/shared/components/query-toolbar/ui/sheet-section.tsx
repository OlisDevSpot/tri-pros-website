'use client'

import type { ReactNode } from 'react'

interface SheetSectionProps {
  title: string
  sectionId: string
  children: ReactNode
}

export function SheetSection({ title, sectionId, children }: SheetSectionProps) {
  return (
    <section aria-labelledby={sectionId} className="space-y-3">
      <h2 id={sectionId} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}
