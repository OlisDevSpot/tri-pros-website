import type { ReactNode } from 'react'

interface FieldLabelRowProps {
  // Only a row that labels a control needs one.
  id?: string
  label: string
  action?: ReactNode
}

// Spans, not divs: a tray's row sits inside its trigger button, where only phrasing content may go.
export function FieldLabelRow({ id, label, action }: FieldLabelRowProps) {
  return (
    <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2.5">
      <span id={id} className="text-xs font-bold tracking-wider text-muted-foreground uppercase">{label}</span>
      {action}
    </span>
  )
}
