'use client'

import { useEffect } from 'react'

import { recordHydratedKeys } from '@/shared/lib/hydration-drift'

interface Props {
  queryKeys: unknown[][]
}

// Dev-only child of HydrateClient — see hydration-drift.ts. Renders nothing.
export function HydrationKeyRecorder({ queryKeys }: Props) {
  useEffect(() => {
    recordHydratedKeys(queryKeys)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- record once per mount; keys are a render-time snapshot
  }, [])
  return null
}
