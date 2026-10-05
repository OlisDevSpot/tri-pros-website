'use client'

import type { RefObject } from 'react'
import { useEffect } from 'react'
import { DRAG_TO_CLOSE } from '@/shared/constants/drag-to-close'

interface Options {
  backdropRef: RefObject<HTMLElement | null>
  // A drag that starts inside this region is left to native scrolling.
  ignoreSelector?: string
  onOpenChange: (open: boolean) => void
  sheetRef: RefObject<HTMLElement | null>
}

// A downward drag moves the sheet with the pointer and fades the backdrop; letting go past a
// quarter of the sheet, or with a flick, closes it, and anything less springs back. The drag
// writes inline styles only, then hands back to the class transition, which runs from wherever
// the pointer let go.
export function useDragToClose({ backdropRef, ignoreSelector, onOpenChange, sheetRef }: Options) {
  useEffect(() => {
    const sheet = sheetRef.current
    const backdrop = backdropRef.current
    if (!sheet || !backdrop) {
      return
    }
    let start: { y: number, time: number, pointerId: number } | null = null
    let offset = 0
    let isDragging = false

    const release = () => {
      sheet.style.removeProperty('translate')
      sheet.style.removeProperty('transition')
      backdrop.style.removeProperty('opacity')
      backdrop.style.removeProperty('transition')
    }

    const onPointerDown = (event: PointerEvent) => {
      // A second finger must not touch the gesture already in progress.
      if (!event.isPrimary) {
        return
      }
      // Reset before the ignore check: otherwise a drag that sprang back without a click leaves
      // offset >0, and the next tap landing on an ignored target (e.g. a picker row) gets swallowed
      // by onClickCapture below, which still sees the stale offset from the prior gesture.
      offset = 0
      if (ignoreSelector && (event.target as Element).closest(ignoreSelector)) {
        return
      }
      start = { y: event.clientY, time: event.timeStamp, pointerId: event.pointerId }
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.pointerId) {
        return
      }
      offset = Math.max(0, event.clientY - start.y)
      if (!isDragging) {
        if (offset < DRAG_TO_CLOSE.startPx) {
          return
        }
        isDragging = true
        sheet.setPointerCapture(event.pointerId)
        sheet.style.transition = 'none'
        backdrop.style.transition = 'none'
      }
      sheet.style.translate = `0 ${offset}px`
      backdrop.style.opacity = String(Math.max(0, 1 - offset / sheet.offsetHeight))
    }
    const onPointerEnd = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.pointerId) {
        return
      }
      const velocity = offset / Math.max(1, event.timeStamp - start.time)
      const shouldClose = isDragging
        && (offset > sheet.offsetHeight * DRAG_TO_CLOSE.closeDistanceRatio || velocity > DRAG_TO_CLOSE.closeVelocityPxPerMs)
      start = null
      if (!isDragging) {
        return
      }
      isDragging = false
      // The class transition picks up from the inline position, so the sheet leaves (or returns)
      // from where the pointer let go rather than jumping first.
      requestAnimationFrame(release)
      if (shouldClose) {
        onOpenChange(false)
      }
    }
    // A drag that began on a link or button must not also activate it.
    const onClickCapture = (event: MouseEvent) => {
      if (offset >= DRAG_TO_CLOSE.startPx) {
        event.preventDefault()
        event.stopPropagation()
        offset = 0
      }
    }

    sheet.addEventListener('pointerdown', onPointerDown)
    sheet.addEventListener('pointermove', onPointerMove)
    sheet.addEventListener('pointerup', onPointerEnd)
    sheet.addEventListener('pointercancel', onPointerEnd)
    sheet.addEventListener('click', onClickCapture, true)
    return () => {
      sheet.removeEventListener('pointerdown', onPointerDown)
      sheet.removeEventListener('pointermove', onPointerMove)
      sheet.removeEventListener('pointerup', onPointerEnd)
      sheet.removeEventListener('pointercancel', onPointerEnd)
      sheet.removeEventListener('click', onClickCapture, true)
    }
  }, [backdropRef, ignoreSelector, onOpenChange, sheetRef])
}
