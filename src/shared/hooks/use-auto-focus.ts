import { useEffect, useRef } from 'react'

interface UseAutoFocusOptions {
  /**
   * Skip focusing while false; flipping false→true re-focuses. Lets a step that
   * hides then re-shows its input (e.g. "check a different ZIP") re-focus on
   * return. Default true.
   */
  enabled?: boolean
  /**
   * Focus without scrolling the page to the element — avoids fighting a step's
   * entrance animation. Default true.
   */
  preventScroll?: boolean
  /**
   * Wait this many ms after mount before focusing, to let a transition settle.
   * Default 0 — focus as soon as the element is committed.
   */
  delayMs?: number
}

/**
 * Auto-focus a focusable element when it mounts — attach the returned ref to
 * the element (`<Input ref={inputRef} />`). Built for funnel input steps so the
 * ZIP / address field is ready to type the moment the step loads.
 *
 * Why a hook and not the native `autoFocus` attribute: native autoFocus also
 * fires during SSR hydration and mid-exit-animation, and can yank the page into
 * a scroll jump. This focuses post-commit with `preventScroll`, is gated by
 * `enabled` (so it re-fires when an input is re-shown), and gives us one place
 * to evolve focus behavior across every input step.
 *
 * Mobile keyboard note: programmatic focus always places the caret + focus ring
 * (true on mobile and desktop) and reliably raises the soft keyboard on Android.
 * iOS Safari only raises the keyboard for focus triggered inside a direct user
 * gesture; across a step transition that activation is gone, so iOS may show the
 * focused field without the keyboard until the first tap. That is an OS
 * restriction, not a bug here.
 */
export function useAutoFocus<T extends HTMLElement = HTMLInputElement>(options: UseAutoFocusOptions = {}) {
  const { enabled = true, preventScroll = true, delayMs = 0 } = options
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!enabled) {
      return
    }
    const node = ref.current
    if (!node) {
      return
    }
    if (delayMs <= 0) {
      node.focus({ preventScroll })
      return
    }
    const id = window.setTimeout(() => node.focus({ preventScroll }), delayMs)
    return () => window.clearTimeout(id)
  }, [enabled, preventScroll, delayMs])

  return ref
}
