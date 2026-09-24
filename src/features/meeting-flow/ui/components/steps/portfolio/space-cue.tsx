import { PORTFOLIO_COPY } from '@/features/meeting-flow/constants/portfolio-step'

interface SpaceCueProps {
  /** The next project's title on a project's last photo; absent on the opening photo. */
  nextTitle?: string
}

export function SpaceCue({ nextTitle }: SpaceCueProps) {
  return (
    <span aria-hidden className="inline-flex w-fit items-center gap-2 rounded-md bg-(--presentation-ground)/80 px-3 py-1.5 text-presentation-label font-semibold text-white">
      {nextTitle ? `${PORTFOLIO_COPY.nextCue} ${nextTitle}` : PORTFOLIO_COPY.startCue}
      <kbd className="rounded-sm border border-b-2 border-white/40 px-1.5 text-presentation-label font-semibold">Space</kbd>
    </span>
  )
}
