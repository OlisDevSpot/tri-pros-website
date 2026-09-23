'use client'

import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useState } from 'react'
import { isSplashPress } from '@/shared/components/splash-screen/is-splash-press'
import { SplashCaption } from '@/shared/components/splash-screen/splash-caption'
import { SplashMark } from '@/shared/components/splash-screen/splash-mark'
import {
  SPLASH_CUE_DELAY_S,
  SPLASH_CUE_DURATION_S,
  SPLASH_FADE_S,
  SPLASH_VISIBLE_MS,
} from '@/shared/components/splash-screen/splash-timing'
import { BRAND_EASE } from '@/shared/constants/motion'
import { useAutoFocus } from '@/shared/hooks/use-auto-focus'

/** `timed` fades on its own after `SPLASH_VISIBLE_MS`; `press` holds until the viewer presses, `label` being the button's text and accessible name. */
type SplashDismiss = { mode: 'timed' } | { mode: 'press', label: string }

interface SplashScreenProps {
  /** Controlled: the caller decides when it shows (once per session, once per meeting). */
  open: boolean
  onDismiss: () => void
  dismiss: SplashDismiss
  /** Caption under the mark. The timed proposal and PWA splashes have none. */
  title?: string
  subheading?: string
  /** The mark's and caption's rise, and the overlay's fade. */
  ease?: [number, number, number, number]
}

/**
 * The branded splash over the whole window (spec C §12 S14). It outlives `open` by one fade:
 * the closed state and its fade are the overlay's own inline style and the unmount runs on the
 * primitive's own timer, so neither a stylesheet nor a browser event can keep it in the tree,
 * and no frame between the fade's end and React's removal can show it again. In press mode the
 * cue under the caption is the `<button>` — it takes focus on open, so the accent ring frames
 * a control, not the window — and a click anywhere on the overlay is also a press (E4). The
 * capture-phase `window` listener marks presses as handled before any host key map sees them
 * (hosts honour `defaultPrevented`),
 * without preventing Tab, modifiers, Escape or function keys (review F5). Reduced motion is
 * gated here with `useReducedMotion()`: a host's `MotionConfig reducedMotion="user"` would
 * keep opacity fades and their delays (review F4), and this component mounts wherever the
 * host puts it. Visibility is the caller's policy.
 */
export function SplashScreen({ open, onDismiss, dismiss, title, subheading, ease = BRAND_EASE }: SplashScreenProps) {
  const captionId = useId()
  const reduced = useReducedMotion() ?? false
  const animate = !reduced
  const press = dismiss.mode === 'press'
  const pressRef = useAutoFocus<HTMLButtonElement>({ enabled: open && press })

  // Stays mounted while fading out, then leaves on its own clock: the unmount is scheduled from
  // SPLASH_FADE_S, never from a transition event, so a missing stylesheet rule or a cancelled
  // transition can delay nothing (React's "adjust state when a prop changes" pattern; an effect
  // alone would run after the unmount it is meant to delay). At duration 0 there is no fade:
  // reduced motion unmounts at once.
  const [prevOpen, setPrevOpen] = useState(open)
  const [fading, setFading] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    setFading(!open && animate)
  }

  useEffect(() => {
    if (!fading) {
      return
    }
    const timer = window.setTimeout(() => setFading(false), SPLASH_FADE_S * 1000)
    return () => window.clearTimeout(timer)
  }, [fading])

  useEffect(() => {
    if (!open || dismiss.mode !== 'timed') {
      return
    }
    const timer = window.setTimeout(onDismiss, SPLASH_VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [open, dismiss.mode, onDismiss])

  useEffect(() => {
    if (!open || !press) {
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
  }, [open, press, onDismiss])

  if (!open && !fading) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-9999 flex flex-col items-center justify-center gap-8 p-10"
      data-splash
      data-state={open ? 'open' : 'closed'}
      inert={!open}
      style={{
        backgroundColor: '#09090b',
        opacity: open ? 1 : 0,
        transitionProperty: 'opacity',
        transitionDuration: `${animate ? SPLASH_FADE_S : 0}s`,
        transitionTimingFunction: `cubic-bezier(${ease.join(',')})`,
      }}
      onClick={press ? onDismiss : undefined}
    >
      <SplashMark animate={animate} ease={ease} />
      {title && <SplashCaption animate={animate} ease={ease} id={captionId} subheading={subheading} title={title} />}
      {press && (
        <motion.button
          ref={pressRef}
          animate={{ opacity: 1 }}
          aria-describedby={title ? captionId : undefined}
          className="cursor-pointer rounded-full px-5 py-2.5 font-sans text-xs tracking-[0.18em] text-white/60 uppercase hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--presentation-accent)"
          initial={animate ? { opacity: 0 } : false}
          transition={{ duration: SPLASH_CUE_DURATION_S, delay: SPLASH_CUE_DELAY_S, ease: 'easeOut' }}
          type="button"
        >
          {dismiss.label}
        </motion.button>
      )}
    </div>
  )
}
