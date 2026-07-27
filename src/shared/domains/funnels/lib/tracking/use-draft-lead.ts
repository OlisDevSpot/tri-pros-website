'use client'

import type { FunnelEngineApi } from '@/shared/domains/funnels/hooks/use-funnel-engine'
import type { FunnelSpec } from '@/shared/domains/funnels/types'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useFunnelUtm } from '@/shared/domains/funnels/hooks/use-funnel-utm'
import { readFbCookies } from '@/shared/domains/funnels/lib/tracking/fire-pixel'
import { useTRPC } from '@/trpc/helpers'

/**
 * First-party draft-lead capture (design spec 2026-07-26 §3). Creates an
 * anonymous draft on the FIRST answer and appends one timeline entry per step
 * advance. Fire-and-forget: failures never disturb the funnel UX. The draft id
 * survives reloads via sessionStorage and is threaded into submitLead by the
 * PII step so the draft links to the customer.
 */
export function useDraftLead(spec: FunnelSpec, engine: FunnelEngineApi): void {
  const trpc = useTRPC()
  const track = useMutation(trpc.funnelsRouter.trackDraftStep.mutationOptions())
  const utm = useFunnelUtm(spec.slug)
  const storageKey = `draft-lead:${spec.slug}`
  const lastTrackedStep = useRef<string | null>(null)
  const creatingRef = useRef(false)

  const hasAnyAnswer = Object.values(engine.answers).some(v => v != null)
  const stepId = engine.step.id
  // FunnelEngineApi exposes `step`, not an index — derive it from the spec.
  const stepIndex = Math.max(0, spec.steps.findIndex(s => s.id === stepId))

  useEffect(() => {
    if (!hasAnyAnswer || lastTrackedStep.current === stepId) {
      return
    }
    const draftId = sessionStorage.getItem(storageKey)
    if (!draftId && creatingRef.current) {
      // A create is already in flight for this draft — drop this early
      // timeline entry rather than risk minting a second draft row.
      return
    }
    lastTrackedStep.current = stepId
    const isCreate = !draftId
    if (isCreate) {
      creatingRef.current = true
    }
    const { fbp } = readFbCookies()
    track.mutate(
      {
        draftId,
        funnelSlug: spec.slug,
        trade: spec.pixel.contentCategory,
        stepId,
        stepIndex,
        answers: engine.answers,
        utm,
        fbp,
      },
      {
        onSuccess: (data) => {
          sessionStorage.setItem(storageKey, data.draftId)
          if (isCreate) {
            creatingRef.current = false
          }
        },
        onError: () => {
          if (isCreate) {
            creatingRef.current = false
          }
        },
      },
    )
    // Intentionally NOT depending on `track`/`utm` identity — fire per step change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAnyAnswer, stepId])
}
