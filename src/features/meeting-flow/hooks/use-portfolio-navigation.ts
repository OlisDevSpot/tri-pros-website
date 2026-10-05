'use client'

import type { PortfolioMatch, PortfolioPosition } from '@/features/meeting-flow/types'
import { useCallback, useMemo, useState } from 'react'
import { usePortfolioProjectDetail } from '@/features/meeting-flow/hooks/use-portfolio-project-detail'
import { isLastPhoto, nextPhotoPosition } from '@/features/meeting-flow/lib/portfolio-position'
import { buildProjectStoryPhases } from '@/shared/modules/projects/core/lib/build-project-story-phases'

interface NavigationState {
  projectId: string | null
  phaseIndex: number
  photoIndex: number
}

/**
 * Which project, story phase and photo are on screen. Kept by project id, not list index, so a
 * re-match (selections edited from the panel) keeps the project on screen while it is still listed,
 * and returns to the first match when it is not.
 */
export function usePortfolioNavigation(matches: PortfolioMatch[]) {
  const [state, setState] = useState<NavigationState>({ projectId: null, phaseIndex: 0, photoIndex: 0 })

  const found = state.projectId === null ? -1 : matches.findIndex(match => match.row.project.id === state.projectId)
  const projectIndex = Math.max(found, 0)
  const current = matches[projectIndex]

  // Nothing shown yet, or a re-match dropped the project on screen: adopt the fallback (matches[0])
  // as the project on screen now, so state names what is actually shown — not a stale id — before a
  // later re-match asks "is it still listed?". Guarded by `found === -1`, which this update clears,
  // so it converges after one extra render (React's documented "adjust state during render" pattern;
  // an effect would show the wrong project for one extra frame first).
  if (current && found === -1) {
    setState({ projectId: current.row.project.id, phaseIndex: 0, photoIndex: 0 })
  }

  const detailQuery = usePortfolioProjectDetail(matches, projectIndex)

  // An errored detail is not pending, so it falls through to the hero story phase instead of loading forever.
  const storyPhases = useMemo(
    () => (current && !detailQuery.isPending
      ? buildProjectStoryPhases({ project: current.row.project, heroImage: current.row.heroImage, media: detailQuery.data?.media ?? null })
      : null),
    [current, detailQuery.isPending, detailQuery.data],
  )
  const photoCounts = useMemo(() => storyPhases?.map(phase => phase.photos.length) ?? null, [storyPhases])

  const phaseIndex = found === -1 || !storyPhases ? 0 : Math.min(state.phaseIndex, storyPhases.length - 1)
  const photoIndex = found === -1 || !storyPhases ? 0 : Math.min(state.photoIndex, storyPhases[phaseIndex].photos.length - 1)
  const position = useMemo<PortfolioPosition>(() => ({ projectIndex, phaseIndex, photoIndex }), [projectIndex, phaseIndex, photoIndex])

  const goTo = useCallback((target: PortfolioPosition) => {
    const match = matches[target.projectIndex]
    if (match) {
      setState({ projectId: match.row.project.id, phaseIndex: target.phaseIndex, photoIndex: target.photoIndex })
    }
  }, [matches])

  const advance = useCallback(() => {
    if (photoCounts) {
      goTo(nextPhotoPosition(position, photoCounts, matches.length))
    }
  }, [goTo, position, photoCounts, matches.length])

  const jumpToProject = useCallback((index: number) => {
    if (index !== projectIndex) {
      goTo({ projectIndex: index, phaseIndex: 0, photoIndex: 0 })
    }
  }, [goTo, projectIndex])

  const next = useCallback(() => jumpToProject(Math.min(projectIndex + 1, matches.length - 1)), [jumpToProject, projectIndex, matches.length])
  const prev = useCallback(() => jumpToProject(Math.max(projectIndex - 1, 0)), [jumpToProject, projectIndex])
  const jumpToPhase = useCallback((index: number) => goTo({ projectIndex, phaseIndex: index, photoIndex: 0 }), [goTo, projectIndex])
  const jumpToPhoto = useCallback((index: number) => goTo({ projectIndex, phaseIndex, photoIndex: index }), [goTo, projectIndex, phaseIndex])

  return {
    current,
    storyPhases,
    position,
    lastPhoto: photoCounts !== null && isLastPhoto(position, photoCounts),
    advance,
    next,
    prev,
    jumpToPhase,
    jumpToPhoto,
    jumpToProject,
  }
}
