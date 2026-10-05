'use client'

import { useEffect } from 'react'

const PRESSABLE = 'button, a[href], [role="button"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="tab"], [data-press]'
const DISABLED = ':disabled, [aria-disabled="true"], [data-disabled]'
// A mouse click lasts ~100ms, too short for a press to read; every press is held at least this long.
const MIN_PRESS_MS = 140
// A finger that lands on a list is often starting a scroll, so touch waits a beat before it presses.
const TOUCH_DELAY_MS = 50
const TOUCH_SLOP_PX = 8

function pressableFrom(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null
  }
  const el = target.closest<HTMLElement>(PRESSABLE)
  return el && !el.matches(DISABLED) ? el : null
}

/**
 * Marks the innermost pressable control under the pointer with `data-pressed` (the `pressed:` variant).
 * `:active` can't do this: it vanishes before a quick click is seen, and it lights up every ancestor,
 * so a row would press along with the button inside it.
 */
export function usePressFeedback() {
  useEffect(() => {
    let current: HTMLElement | null = null
    let pressedAt = 0
    let origin = { x: 0, y: 0 }
    let delayTimer: number | undefined
    let releaseTimer: number | undefined

    function press(el: HTMLElement) {
      window.clearTimeout(releaseTimer)
      el.setAttribute('data-pressed', '')
      pressedAt = performance.now()
    }

    function clear() {
      window.clearTimeout(delayTimer)
      current?.removeAttribute('data-pressed')
      current = null
    }

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) {
        return
      }
      const el = pressableFrom(e.target)
      if (!el) {
        return
      }
      clear()
      current = el
      origin = { x: e.clientX, y: e.clientY }
      if (e.pointerType === 'touch') {
        delayTimer = window.setTimeout(press, TOUCH_DELAY_MS, el)
      }
      else {
        press(el)
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (current && e.pointerType === 'touch' && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > TOUCH_SLOP_PX) {
        clear()
      }
    }

    function onPointerUp() {
      const el = current
      if (!el) {
        return
      }
      if (!el.hasAttribute('data-pressed')) {
        // A tap quicker than the touch delay still deserves its press.
        window.clearTimeout(delayTimer)
        press(el)
      }
      const remaining = Math.max(0, MIN_PRESS_MS - (performance.now() - pressedAt))
      releaseTimer = window.setTimeout(() => {
        if (current === el) {
          clear()
        }
        else {
          el.removeAttribute('data-pressed')
        }
      }, remaining)
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat || (e.key !== 'Enter' && e.key !== ' ')) {
        return
      }
      const el = pressableFrom(document.activeElement)
      if (!el) {
        return
      }
      clear()
      current = el
      press(el)
      onPointerUp()
    }

    const opts = { capture: true, passive: true }
    document.addEventListener('pointerdown', onPointerDown, opts)
    document.addEventListener('pointermove', onPointerMove, opts)
    document.addEventListener('pointerup', onPointerUp, opts)
    document.addEventListener('pointercancel', clear, opts)
    document.addEventListener('keydown', onKeyDown, opts)
    return () => {
      clear()
      window.clearTimeout(releaseTimer)
      document.removeEventListener('pointerdown', onPointerDown, opts)
      document.removeEventListener('pointermove', onPointerMove, opts)
      document.removeEventListener('pointerup', onPointerUp, opts)
      document.removeEventListener('pointercancel', clear, opts)
      document.removeEventListener('keydown', onKeyDown, opts)
    }
  }, [])
}
