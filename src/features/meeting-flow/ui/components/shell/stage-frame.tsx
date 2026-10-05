'use client'

import type { ReactNode, Ref } from 'react'

interface StageFrameProps {
  ref?: Ref<HTMLDivElement>
  /** Set while the meeting splash covers the flow, so neither focus nor a click reaches behind it (E4, review F5). */
  inert?: boolean
  children: ReactNode
}

/**
 * The meeting-flow root. `data-stage` opts the route out of the dashboard
 * template's padding and hides the mobile nav (app-shell.md,
 * `stage-routes-opt-out-with-data-stage`). `--stage-inset-b` is the strip the
 * floating capsule covers: capsule 48px + 16px offset + 16px breathing.
 * `--stage-clear-b` is where a step's copy may end: the capsule's own bottom
 * offset (`step-capsule.tsx`), its 48px height and 40px of clearance (spec C U6, C45).
 * A presentation step hands it to the engine as `clearBottom`; the engine itself
 * never reads a `--stage-*` variable.
 */
export function StageFrame({ ref, inert, children }: StageFrameProps) {
  return (
    <div
      ref={ref}
      className="relative flex h-full min-w-0 flex-col [--stage-clear-b:calc(max(1rem,env(safe-area-inset-bottom))_+_5.5rem)] [--stage-inset-b:5rem]"
      data-stage
      inert={inert}
    >
      {children}
    </div>
  )
}
