'use client'

import type { SceneCursorHover } from '@/features/trade-scenes/contexts/scene-cursor-hover-context'

import { useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef } from 'react'

import { useLayoutEditorStore } from '@/features/trade-scenes/contexts/layout-editor-context'
import { sceneCursor } from '@/features/trade-scenes/lib/scene-cursor'

type Dragging = 'pan' | 'spin' | null

// Refs and direct style writes, never state: a hover or a Shift press must not re-render the house. The element is the one
// OrbitControls and the tap hook listen on.
export function useSceneCursor(): SceneCursorHover {
  const connected = useThree(state => state.events.connected) as HTMLElement | undefined
  const gl = useThree(state => state.gl)
  const element = connected ?? gl.domElement
  const editor = useLayoutEditorStore()
  // A count, not a flag: moving from one part to the next may fire the new part's over before the old one's out.
  const overParts = useRef(0)
  const shift = useRef(false)
  const dragging = useRef<Dragging>(null)
  const write = useRef(() => {})

  useEffect(() => {
    write.current = () => {
      // The draw bar's own cursor stands while the lot is drawing.
      if (editor?.getState().mode === 'draw') {
        return
      }
      element.style.cursor = sceneCursor({ overPart: overParts.current > 0, shift: shift.current, dragging: dragging.current })
    }
    const refresh = () => write.current()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Shift' && shift.current !== (event.type === 'keydown')) {
        shift.current = event.type === 'keydown'
        refresh()
      }
    }
    const onBlur = () => {
      shift.current = false
      dragging.current = null
      refresh()
    }
    const onDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        return
      }
      if (event.button === 2 || event.shiftKey || event.ctrlKey || event.metaKey) {
        dragging.current = 'spin'
      }
      else if (event.button === 0) {
        dragging.current = 'pan'
      }
      else {
        return
      }
      refresh()
    }
    const onUp = () => {
      if (dragging.current !== null) {
        dragging.current = null
        refresh()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    window.addEventListener('blur', onBlur)
    element.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    const unsubscribe = editor?.subscribe(refresh)
    refresh()
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      window.removeEventListener('blur', onBlur)
      element.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      unsubscribe?.()
      element.style.cursor = ''
    }
  }, [element, editor])

  return useCallback((over: boolean) => {
    overParts.current = over ? overParts.current + 1 : Math.max(overParts.current - 1, 0)
    write.current()
  }, [])
}
