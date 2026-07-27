'use client'

import type { FunnelEngineApi } from '@/shared/domains/funnels/hooks/use-funnel-engine'

import type { FunnelSpec } from '@/shared/domains/funnels/types'
import { useEffect, useRef } from 'react'
import { STEP_KIND_BROWSER_EVENT } from '@/shared/domains/funnels/lib/tracking/convention-map'
import { firePixel, mintEventId } from '@/shared/domains/funnels/lib/tracking/fire-pixel'
import { firesLeadOptimization } from '@/shared/domains/funnels/lib/tracking/lead-qualification'

/**
 * Browser-only convention emitter. Auto-fires the lifecycle events the engine
 * already implies:
 *   - ViewContent: first time ANY step receives an answer (engagement signal).
 *   - CompleteRegistration: when a terminal `confirmation` step is reached.
 * PageView is fired by the pixel loader; Lead is fired by the PII step (dual-fire
 * needs a threaded event_id). A per-mount guard prevents re-fires on back-nav.
 */
export function useFunnelTracking(spec: FunnelSpec, engine: FunnelEngineApi): void {
  const fired = useRef<Set<string>>(new Set())
  const contentCategory = spec.pixel.contentCategory
  const contentName = spec.slug

  // ViewContent — first answer on any step.
  const hasAnyAnswer = Object.values(engine.answers).some(v => v != null)
  useEffect(() => {
    if (hasAnyAnswer && !fired.current.has('ViewContent')) {
      fired.current.add('ViewContent')
      firePixel('ViewContent', { eventId: mintEventId(), contentCategory, contentName })
    }
  }, [hasAnyAnswer, contentCategory, contentName])

  // CompleteRegistration (and any future kind-bound conversion event) — on step
  // kind. Renter rule: renters fire traffic events (PageView/ViewContent),
  // never conversion events. see ../../DOCS.md and lead-qualification.ts.
  const stepKind = engine.step.kind
  const answers = engine.answers
  useEffect(() => {
    const event = STEP_KIND_BROWSER_EVENT[stepKind]
    if (event && !fired.current.has(event) && firesLeadOptimization(answers)) {
      fired.current.add(event)
      firePixel(event, { eventId: mintEventId(), contentCategory, contentName })
    }
  }, [stepKind, answers, contentCategory, contentName])
}
