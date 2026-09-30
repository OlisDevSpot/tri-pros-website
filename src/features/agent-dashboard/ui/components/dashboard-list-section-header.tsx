interface DashboardListSectionHeaderProps {
  /** Space-Mono eyebrow naming the section's single state. */
  title: string
  /** The full-predicate total; omitted while the section loads. */
  total?: number
}

export function DashboardListSectionHeader({ title, total }: DashboardListSectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
      {total !== undefined && (
        <span className="font-mono text-[0.72rem] tabular-nums text-muted-foreground">{total}</span>
      )}
    </div>
  )
}
