import type { ReactNode } from 'react'
import { KEY_SHORTCUTS } from '@/features/meeting-flow/constants/keyboard-hints'

interface PortfolioStepLayoutProps {
  labelledBy: string
  photo: ReactNode
  heading: ReactNode
  /** The project list as a column; shown on wide steps only. */
  listColumn: ReactNode
  /** The project list as a row with "All N"; shown on narrow steps only. */
  listRow: ReactNode
  story: ReactNode
  /** Read by screen readers when the project or story phase changes. */
  announcement: string
}

/**
 * The step root. `data-step-root` + `tabIndex={-1}` let the view focus it after a step change, as it
 * focuses a page step's region. Overlays pass pointer events through to the photo except on controls.
 */
export function PortfolioStepLayout({ labelledBy, photo, heading, listColumn, listRow, story, announcement }: PortfolioStepLayoutProps) {
  return (
    <div
      aria-keyshortcuts={KEY_SHORTCUTS.portfolio}
      aria-labelledby={labelledBy}
      className="[container:portfolio/size] relative isolate min-h-0 flex-1 overflow-clip bg-(--presentation-ground) text-white outline-none"
      data-step-root
      role="region"
      tabIndex={-1}
    >
      {photo}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-2/5 bg-linear-to-b from-[oklch(var(--presentation-scrim)/0.7)] to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-[oklch(var(--presentation-scrim)/0.96)] via-[oklch(var(--presentation-scrim)/0.55)] to-transparent" />
      <div className="pointer-events-none absolute inset-0 flex flex-col gap-presentation-group px-4 pt-5 pb-(--stage-clear-b) @5xl/portfolio:pt-6 @5xl/portfolio:pr-[calc(1.75rem+18.75rem+var(--spacing-presentation-group))] @5xl/portfolio:pl-7">
        <div className="pointer-events-auto min-w-0">{heading}</div>
        {/* Out of flow: a long list must never push the story block below the capsule. */}
        <div className="pointer-events-auto absolute top-6 right-7 bottom-(--stage-clear-b) hidden w-75 overflow-y-auto overscroll-contain pr-1 @5xl/portfolio:block">{listColumn}</div>
        <div className="mt-auto grid gap-presentation-group">
          <div className="pointer-events-auto @5xl/portfolio:hidden">{listRow}</div>
          <div className="pointer-events-auto grid max-w-190 gap-presentation-tight">{story}</div>
        </div>
      </div>
      <p aria-atomic="true" aria-live="polite" className="sr-only">{announcement}</p>
    </div>
  )
}
