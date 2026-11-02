'use client'

import type { ReactNode, RefObject } from 'react'

import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

import { SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'
import { TRAY_REVEAL_TRANSITION } from '@/features/trade-scenes/constants/tray-reveal'

export interface DockTrayOpenerProps {
  'ref': RefObject<HTMLButtonElement | null>
  'aria-expanded': boolean
  'aria-controls': string | undefined
  'onClick': () => void
}

interface DockTrayProps {
  label: string
  opener: (props: DockTrayOpenerProps) => ReactNode
  // Handed the way to put the tray away, so a pick closes it in the same tap.
  children: (putAway: () => void) => ReactNode
}

const { padding, border, spacing, trayGap } = SCENE_LAYOUT.dock

// A folded group: one button in the strip, its choices in a tray beside it.
export function DockTray({ label, opener, children }: DockTrayProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)
  const trayRef = useRef<HTMLDivElement>(null)
  const trayId = useId()
  const reduceMotion = useReducedMotion()

  // A touch anywhere else puts the tray away, as it would a menu; the choices stay one tap each.
  useEffect(() => {
    if (!open) {
      return
    }
    function onPointerDown(event: PointerEvent) {
      if (!(event.target instanceof Node) || !rootRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // It opens level with its button, and rises as far as it must to end where the strip ends: the strip already keeps
  // clear of the build switch and the card, so the tray does too. Read from layout, not boxes, so the tray's opening
  // scale does not shorten what is measured; placed again when the window resizes, which moves the strip.
  useLayoutEffect(() => {
    const root = rootRef.current
    const tray = trayRef.current
    if (!open || !root || !tray) {
      return
    }
    function place() {
      const strip = root?.offsetParent
      if (!root || !tray || !(strip instanceof HTMLElement)) {
        return
      }
      const spill = root.offsetTop + tray.offsetHeight - (strip.clientHeight + border)
      tray.style.top = `${-Math.max(0, spill)}px`
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open])

  // The choice goes with the tray, so focus returns to the button instead of falling to the page.
  function putAway() {
    setOpen(false)
    openerRef.current?.focus()
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(event) => {
        if (open && event.key === 'Escape') {
          event.preventDefault()
          putAway()
        }
      }}
    >
      {opener({ 'ref': openerRef, 'aria-expanded': open, 'aria-controls': open ? trayId : undefined, 'onClick': () => setOpen(!open) })}
      {open && (
        <motion.div
          ref={trayRef}
          id={trayId}
          role="group"
          aria-label={label}
          initial={reduceMotion ? false : { opacity: 0, x: 4, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={TRAY_REVEAL_TRANSITION}
          // Beside the strip: past its padding and edge, then the tray's own gap.
          style={{ right: `calc(100% + ${padding + border + trayGap}px)`, padding, gap: spacing }}
          className="absolute top-0 grid w-max origin-right grid-cols-2 rounded-[14px] border bg-popover shadow-lg"
        >
          {children(putAway)}
        </motion.div>
      )}
    </div>
  )
}
