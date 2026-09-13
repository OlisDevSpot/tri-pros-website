'use client'

import type { ReactNode, Ref } from 'react'

interface StageFrameProps {
  ref?: Ref<HTMLDivElement>
  children: ReactNode
}

/**
 * The meeting-flow root. `data-stage` opts the route out of the dashboard
 * template's padding and hides the mobile nav (app-shell.md,
 * `stage-routes-opt-out-with-data-stage`). `--stage-inset-b` is the strip the
 * floating capsule covers: capsule 48px + 16px offset + 16px breathing.
 */
export function StageFrame({ ref, children }: StageFrameProps) {
  return (
    <div ref={ref} className="relative flex h-full min-w-0 flex-col [--stage-inset-b:5rem]" data-stage>
      {children}
    </div>
  )
}
