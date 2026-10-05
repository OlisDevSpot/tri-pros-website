'use client'

import type { Ref } from 'react'
import type { MeetingStepHandle } from '@/features/meeting-flow/types'
import { useImperativeHandle } from 'react'
import { PORTFOLIO_COPY } from '@/features/meeting-flow/constants/portfolio-step'
import { usePortfolioMatches } from '@/features/meeting-flow/hooks/use-portfolio-matches'
import { usePortfolioNavigation } from '@/features/meeting-flow/hooks/use-portfolio-navigation'
import { PortfolioStepLayout } from '@/features/meeting-flow/ui/components/steps/portfolio/portfolio-step-layout'
import { ProjectHeading } from '@/features/meeting-flow/ui/components/steps/portfolio/project-heading'
import { ProjectList } from '@/features/meeting-flow/ui/components/steps/portfolio/project-list'
import { ProjectListRow } from '@/features/meeting-flow/ui/components/steps/portfolio/project-list-row'
import { ProjectPhoto } from '@/features/meeting-flow/ui/components/steps/portfolio/project-photo'
import { SpaceCue } from '@/features/meeting-flow/ui/components/steps/portfolio/space-cue'
import { StoryLines } from '@/features/meeting-flow/ui/components/steps/portfolio/story-lines'
import { StoryPhaseBar } from '@/features/meeting-flow/ui/components/steps/portfolio/story-phase-bar'
import { StoryPhasePhotos } from '@/features/meeting-flow/ui/components/steps/portfolio/story-phase-photos'
import { EmptyState } from '@/shared/components/states/empty-state'
import { ErrorState } from '@/shared/components/states/error-state'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'

interface PortfolioStepProps {
  /** id of the step's visually hidden h1. */
  labelledBy: string
  /** Project and photo navigation for the flow's key map. */
  ref?: Ref<MeetingStepHandle>
}

/**
 * Step 3: one project at a time, its project story told across its story phases, the meeting's best
 * matches first. There is always a first match — by scope, by trade, or the fallback — so the step
 * never opens empty while any project has a photo.
 */
export function PortfolioStep({ labelledBy, ref }: PortfolioStepProps) {
  const { matches, showNoMatchNote, isPending, isError, refetch } = usePortfolioMatches()
  const nav = usePortfolioNavigation(matches)
  const { advance, next, prev } = nav

  useImperativeHandle(ref, () => ({ next, prev, advance }), [next, prev, advance])

  if (isPending) {
    return (
      <PortfolioStepLayout
        announcement={PORTFOLIO_COPY.loading}
        heading={<Skeleton className="h-12 w-2/3 bg-white/10" />}
        labelledBy={labelledBy}
        listColumn={null}
        listRow={null}
        photo={null}
        story={<Skeleton className="h-11 w-full bg-white/10" />}
      />
    )
  }

  if (isError) {
    return (
      <PortfolioStepLayout
        announcement={PORTFOLIO_COPY.errorTitle}
        heading={(
          <ErrorState className="h-auto border-white/15 text-white" title={PORTFOLIO_COPY.errorTitle}>
            <Button className="min-h-11 border-white/35 font-semibold text-white hover:bg-white/10 hover:text-white" variant="outline" onClick={() => void refetch()}>
              {PORTFOLIO_COPY.retry}
            </Button>
          </ErrorState>
        )}
        labelledBy={labelledBy}
        listColumn={null}
        listRow={null}
        photo={null}
        story={null}
      />
    )
  }

  const { current, storyPhases, position, lastPhoto } = nav
  if (!current) {
    return (
      <PortfolioStepLayout
        announcement={PORTFOLIO_COPY.empty}
        heading={<EmptyState className="h-auto border-white/20 text-white" title={PORTFOLIO_COPY.empty} />}
        labelledBy={labelledBy}
        listColumn={null}
        listRow={null}
        photo={null}
        story={null}
      />
    )
  }

  const storyPhase = storyPhases?.[position.phaseIndex] ?? null
  const photo = storyPhase?.photos[position.photoIndex] ?? current.row.heroImage
  const upcoming = storyPhase?.photos[position.photoIndex + 1]
    ?? storyPhases?.[position.phaseIndex + 1]?.photos[0]
    ?? matches[position.projectIndex + 1]?.row.heroImage
    ?? null
  const nextProject = matches[position.projectIndex + 1]
  const atOpening = position.projectIndex === 0 && position.phaseIndex === 0 && position.photoIndex === 0
  const title = current.row.project.title
  const listProps = { matches, activeIndex: position.projectIndex, showNoMatchNote, onSelect: nav.jumpToProject }

  return (
    <PortfolioStepLayout
      announcement={storyPhase ? `${title}, ${storyPhase.label}` : title}
      heading={<ProjectHeading match={current} />}
      labelledBy={labelledBy}
      listColumn={<ProjectList {...listProps} />}
      listRow={<ProjectListRow {...listProps} />}
      photo={(
        <ProjectPhoto
          alt={storyPhase ? `${title} — ${storyPhase.label} photo ${position.photoIndex + 1} of ${storyPhase.photos.length}` : title}
          canAdvance={storyPhases !== null && !(lastPhoto && !nextProject)}
          file={photo}
          upcoming={upcoming}
          onAdvance={advance}
        />
      )}
      story={(
        <>
          {storyPhase && <StoryLines lines={storyPhase.story} />}
          {storyPhases && (atOpening || (lastPhoto && nextProject)) && <SpaceCue nextTitle={atOpening ? undefined : nextProject?.row.project.title} />}
          <StoryPhaseBar phaseIndex={position.phaseIndex} photoIndex={position.photoIndex} storyPhases={storyPhases} onSelect={nav.jumpToPhase} />
          {storyPhase && <StoryPhasePhotos phaseLabel={storyPhase.label} photoIndex={position.photoIndex} photos={storyPhase.photos} onSelect={nav.jumpToPhoto} />}
        </>
      )}
    />
  )
}
