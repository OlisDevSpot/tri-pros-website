import type { PortfolioMatch } from '@/features/meeting-flow/types'
import { OptimizedImage } from '@/shared/components/optimized-image'
import { cn } from '@/shared/lib/utils'

interface ProjectListCardProps {
  match: PortfolioMatch
  number: number
  active: boolean
  /** The narrow row: number and title only. */
  compact?: boolean
  onSelect: () => void
}

export function ProjectListCard({ match, number, active, compact = false, onSelect }: ProjectListCardProps) {
  const { project } = match.row
  return (
    <button
      aria-current={active ? 'true' : undefined}
      className={cn(
        'grid min-h-11 w-full min-w-0 items-center gap-2.5 rounded-md border border-white/12 bg-[oklch(var(--presentation-scrim)/0.6)] p-1.5 text-left text-white',
        compact ? 'grid-cols-[1fr_auto] px-2.5' : 'grid-cols-[64px_1fr_auto]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
        active && 'border-(--presentation-accent) bg-[oklch(var(--presentation-scrim)/0.85)]',
      )}
      type="button"
      onClick={onSelect}
    >
      {!compact && (
        <span className="relative h-11.5 w-16 overflow-hidden rounded-sm">
          <OptimizedImage alt="" className="object-cover" fill file={match.row.heroImage} sizes="64px" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate font-sans text-presentation-label font-bold">{project.title}</span>
        {!compact && match.matchLabels.length > 0 && (
          <span className="block truncate text-presentation-label text-white/70">{match.matchLabels.join(' · ')}</span>
        )}
      </span>
      <span className={cn('grid size-6 place-items-center rounded-full bg-white/15 text-presentation-label font-bold', active && 'bg-(--presentation-accent) text-(--presentation-ground)')}>
        {number}
      </span>
    </button>
  )
}
