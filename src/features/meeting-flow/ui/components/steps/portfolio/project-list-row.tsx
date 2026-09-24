import type { PortfolioMatch } from '@/features/meeting-flow/types'
import { PORTFOLIO_COPY, PROJECT_LIST_ROW_COUNT } from '@/features/meeting-flow/constants/portfolio-step'
import { ProjectListCard } from '@/features/meeting-flow/ui/components/steps/portfolio/project-list-card'
import { ProjectListSheet } from '@/features/meeting-flow/ui/components/steps/portfolio/project-list-sheet'

interface ProjectListRowProps {
  matches: PortfolioMatch[]
  activeIndex: number
  showNoMatchNote: boolean
  onSelect: (index: number) => void
}

export function ProjectListRow({ matches, activeIndex, showNoMatchNote, onSelect }: ProjectListRowProps) {
  const start = Math.max(0, Math.min(activeIndex, matches.length - PROJECT_LIST_ROW_COUNT))
  return (
    <div className="grid gap-1.5">
      {showNoMatchNote && <p className="text-presentation-label text-white/70">{PORTFOLIO_COPY.noMatches}</p>}
      <div className="flex items-stretch gap-1.5">
        <div className="grid min-w-0 flex-1 auto-cols-fr grid-flow-col gap-1.5">
          {matches.slice(start, start + PROJECT_LIST_ROW_COUNT).map((match, offset) => (
            <ProjectListCard key={match.row.project.id} active={start + offset === activeIndex} compact match={match} number={start + offset + 1} onSelect={() => onSelect(start + offset)} />
          ))}
        </div>
        <ProjectListSheet activeIndex={activeIndex} matches={matches} showNoMatchNote={showNoMatchNote} onSelect={onSelect} />
      </div>
    </div>
  )
}
