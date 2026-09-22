'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useId } from 'react'
import { isSplashPress } from '@/shared/components/splash-screen/is-splash-press'
import { SplashCaption } from '@/shared/components/splash-screen/splash-caption'
import { SplashMark } from '@/shared/components/splash-screen/splash-mark'
import { SPLASH_VISIBLE_MS } from '@/shared/components/splash-screen/splash-timing'
import { BRAND_EASE } from '@/shared/constants/motion'
import { useAutoFocus } from '@/shared/hooks/use-auto-focus'

/** `timed` fades on its own after `SPLASH_VISIBLE_MS`; `press` holds until the viewer presses, `label` naming the button. */
type SplashDismiss = { mode: 'timed' } | { mode: 'press', label: string }

interface SplashScreenProps {
  /** Controlled: the caller decides when it shows (once per session, once per meeting). */
  open: boolean
  onDismiss: () => void
  dismiss: SplashDismiss
  /** Caption under the mark. The timed proposal and PWA splashes have none. */
  title?: string
  subheading?: string
  /** The mark's and caption's rise. */
  ease?: [number, number, number, number]
  /** `AnimatePresence` key; one per splash use. */
  motionKey: string
}

/**
 * The branded splash over the whole window: the mark, optionally a caption, dismissed either
 * on a timer or by a press (spec C §12 S14). In press mode the whole overlay is one `<button>`
 * whose accessible name is the action and whose caption is its description (review N3); it
 * takes focus on open, and a capture-phase `window` listener marks presses as handled before
 * any host key map acts on them (hosts honour `defaultPrevented`), without preventing Tab,
 * modifiers, Escape or function keys (E4, review F5). Reduced motion is gated here with
 * `useReducedMotion()`: a host's
 * `MotionConfig reducedMotion="user"` would keep opacity fades and their delays (review F4),
 * and this component mounts wherever the host puts it. Visibility is the caller's policy.
 */
export function SplashScreen({ open, onDismiss, dismiss, title, subheading, ease = BRAND_EASE, motionKey }: SplashScreenProps) {
  const captionId = useId()
  const reduced = useReducedMotion() ?? false
  const animate = !reduced
  const pressRef = useAutoFocus<HTMLButtonElement>({ enabled: open && dismiss.mode === 'press' })

  useEffect(() => {
    if (!open || dismiss.mode !== 'timed') {
      return
    }
    const timer = window.setTimeout(onDismiss, SPLASH_VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [open, dismiss.mode, onDismiss])

  useEffect(() => {
    if (!open || dismiss.mode !== 'press') {
      return
    }
    function onKeyDown(event: KeyboardEvent) {
      if (!isSplashPress(event)) {
        return
      }
      event.preventDefault()
      onDismiss()
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [open, dismiss.mode, onDismiss])

  const content = (
    <>
      <SplashMark animate={animate} ease={ease} />
      {title && (
        <SplashCaption animate={animate} ease={ease} id={captionId} showCue={dismiss.mode === 'press'} subheading={subheading} title={title} />
      )}
    </>
  )

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key={motionKey}
          className="fixed inset-0 z-9999 flex flex-col items-center justify-center"
          data-splash
          exit={{ opacity: 0 }}
          style={{ backgroundColor: '#09090b' }}
          transition={{ duration: animate ? 0.3 : 0, ease: 'easeOut' }}
        >
          {dismiss.mode === 'press'
            ? (
                <button
                  ref={pressRef}
                  aria-describedby={title ? captionId : undefined}
                  aria-label={dismiss.label}
                  className="flex size-full cursor-pointer flex-col items-center justify-center gap-8 p-10 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-(--presentation-accent)"
                  type="button"
                  onClick={onDismiss}
                >
                  {content}
                </button>
              )
            : <div className="flex flex-col items-center justify-center gap-8 p-10">{content}</div>}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
