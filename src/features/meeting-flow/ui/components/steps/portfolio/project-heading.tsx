import type { PortfolioMatch } from '@/features/meeting-flow/types'
import { MatchPills } from '@/features/meeting-flow/ui/components/steps/portfolio/match-pills'
import { formatProjectCaption } from '@/shared/modules/projects/core/lib/format-project-caption'

interface ProjectHeadingProps {
  match: PortfolioMatch
}

export function ProjectHeading({ match }: ProjectHeadingProps) {
  const { project } = match.row
  return (
    <div className="grid justify-items-start gap-presentation-tight [text-shadow:0_2px_12px_rgb(0_0_0/0.5)]">
      <h2 className="font-sans text-presentation-title leading-[1.05] font-semibold tracking-tight text-balance">{project.title}</h2>
      <p className="text-presentation-label text-white/80">{formatProjectCaption(project)}</p>
      <MatchPills labels={match.matchLabels} />
    </div>
  )
}
