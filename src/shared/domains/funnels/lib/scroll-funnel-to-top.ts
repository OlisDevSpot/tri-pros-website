/**
 * Snap the funnel page back to the top.
 *
 * Coupled into the engine's `advance` / `back` (see use-funnel-engine.ts): every
 * forward and backward move resets scroll, so a visitor who scrolled the hero (or
 * a long step) always starts the next step at the top. Lives at the SOURCE so
 * every call site — Next/Back buttons, card-select / ZIP auto-advance, the hero's
 * Q1 — inherits it for free. SSR-guarded; only ever runs from client handlers.
 */
export function scrollFunnelToTop(): void {
  if (typeof window === 'undefined') {
    return
  }
  window.scrollTo({ top: 0, left: 0 })
}
