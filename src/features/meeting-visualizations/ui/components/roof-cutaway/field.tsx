'use client'

import type { ReactNode } from 'react'

export function Field({ label, children }: { label: string, children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      {children}
    </div>
  )
}
