'use client'

interface DangerZoneRowProps {
  title: string
  description: string
  children: React.ReactNode
}

export function DangerZoneRow({ title, description, children }: DangerZoneRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
