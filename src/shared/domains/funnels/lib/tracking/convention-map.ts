import type { StepKind } from '@/shared/domains/funnels/types'

/**
 * Convention: which browser-only Pixel event a step KIND implies on completion.
 * Binding to kind (not step id) is what makes the suite scale to N funnels with
 * zero per-funnel wiring.
 * `pii-form` (Lead) is NOT here — it is dual-fire (server twin with a threaded
 * event_id) and fires at its own submit site. Events emitted from this map are
 * conversion events and are renter-gated at the emitter (use-funnel-tracking).
 * `Schedule` is NOT a browser event at all — it fires server-only from the CRM
 * when a meeting is created (see measurement.service.trackAppointmentSet).
 */
export const STEP_KIND_BROWSER_EVENT: Partial<Record<StepKind, string>> = {
  confirmation: 'CompleteRegistration',
}
