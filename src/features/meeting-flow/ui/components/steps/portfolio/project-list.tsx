import type { PortfolioMatch } from '@/features/meeting-flow/types'
import { PORTFOLIO_COPY } from '@/features/meeting-flow/constants/portfolio-step'
import { groupPortfolioMatches } from '@/features/meeting-flow/lib/group-portfolio-matches'
import { ProjectListCard } from '@/features/meeting-flow/ui/components/steps/portfolio/project-list-card'

interface ProjectListProps {
  matches: PortfolioMatch[]
  activeIndex: number
  /** Selections exist but nothing matched their scopes or trades. */
  showNoMatchNote: boolean
  onSelect: (index: number) => void
}

export function ProjectList({ matches, activeIndex, showNoMatchNote, onSelect }: ProjectListProps) {
  return (
    <div className="grid gap-presentation-group">
      {showNoMatchNote && <p className="text-presentation-label text-white/70">{PORTFOLIO_COPY.noMatches}</p>}
      {groupPortfolioMatches(matches).map(section => (
        <section key={section.label} aria-label={section.label} className="grid gap-1.5">
          <h3 className="text-presentation-label font-bold tracking-[0.06em] text-white/70 uppercase">{section.label}</h3>
          {section.items.map(({ match, index }) => (
            <ProjectListCard key={match.row.project.id} active={index === activeIndex} match={match} number={index + 1} onSelect={() => onSelect(index)} />
          ))}
        </section>
      ))}
    </div>
  )
}
