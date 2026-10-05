import type { PortfolioPosition } from '@/features/meeting-flow/types'

/** Space: the next photo, into the next story phase, then the next project's first photo. The very last photo stays put. */
export function nextPhotoPosition(position: PortfolioPosition, phasePhotoCounts: readonly number[], projectCount: number): PortfolioPosition {
  const { projectIndex, phaseIndex, photoIndex } = position
  if (photoIndex + 1 < (phasePhotoCounts[phaseIndex] ?? 0)) {
    return { projectIndex, phaseIndex, photoIndex: photoIndex + 1 }
  }
  if (phaseIndex + 1 < phasePhotoCounts.length) {
    return { projectIndex, phaseIndex: phaseIndex + 1, photoIndex: 0 }
  }
  if (projectIndex + 1 < projectCount) {
    return { projectIndex: projectIndex + 1, phaseIndex: 0, photoIndex: 0 }
  }
  return position
}

/** The project's last photo: the next Space leaves this project. */
export function isLastPhoto(position: PortfolioPosition, phasePhotoCounts: readonly number[]): boolean {
  const lastPhase = phasePhotoCounts.length - 1
  return position.phaseIndex === lastPhase && position.photoIndex === (phasePhotoCounts[lastPhase] ?? 1) - 1
}
