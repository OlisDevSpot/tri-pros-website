interface DashboardSnapshotChipsProps {
  /** Omitted while the counts load (or when they failed): each chip shows a muted dash. */
  counts?: {
    meetingsToday: number
    awaitingSignature: number
    activeProjects: number
  }
}

/** Slim, non-sticky ribbon of 3 jump-links: meetings today · out for signature · open projects. */
export function DashboardSnapshotChips({ counts }: DashboardSnapshotChipsProps) {
  const chips = [
    { href: '#meetings', label: 'Meetings today', count: counts?.meetingsToday },
    { href: '#proposals', label: 'Out for signature', count: counts?.awaitingSignature },
    { href: '#projects', label: 'Open projects', count: counts?.activeProjects },
  ]

  return (
    <div className="grid grid-cols-3 gap-3" aria-busy={counts === undefined || undefined}>
      {chips.map(chip => (
        <a
          key={chip.href}
          href={chip.href}
          className="
            flex min-h-11 flex-col items-start justify-center gap-1 rounded-md
            border border-border bg-card px-3 py-2
            transition-colors duration-200
            hover:border-primary/40 hover:bg-accent/50
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          "
        >
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {chip.label}
          </span>
          <span
            className={
              chip.count === undefined
                ? 'font-sans text-2xl font-bold tabular-nums text-muted-foreground'
                : 'font-sans text-2xl font-bold tabular-nums text-primary'
            }
          >
            {chip.count ?? '—'}
          </span>
        </a>
      ))}
    </div>
  )
}
