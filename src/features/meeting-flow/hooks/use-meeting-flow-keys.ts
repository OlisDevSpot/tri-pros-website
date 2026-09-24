'use client'

import type { RefObject } from 'react'
import type { PresentationHandle } from '@/shared/components/presentation/types'
import { useEffect } from 'react'
import { ARROW_KEYS, REPEATABLE_KEYS, TYPING_TARGET_SELECTOR } from '@/features/meeting-flow/constants/keyboard-hints'
import { TOTAL_STEPS } from '@/features/meeting-flow/constants/step-config'

interface UseMeetingFlowKeysArgs {
  /** The flow root: top bar, stage, rail and panel. Radix layers are portaled outside it. */
  rootRef: RefObject<HTMLElement | null>
  step: number
  setStep: (step: number) => void
  presenting: boolean
  togglePresent: () => void
  panelOpen: boolean
  closePanel: () => void
  /** `current` is null on page steps; arrows then fall through to the browser. */
  presentationRef: RefObject<PresentationHandle | null>
}

/**
 * The one keyboard owner of the meeting flow. Mount it once, in the view.
 *
 * Listens on `window` in the bubble phase, which runs after Radix's Escape handling
 * (a `document` capture listener that calls `preventDefault()` when it dismisses a
 * layer) and after React's own handlers (Next hydrates `document`). So
 * `event.defaultPrevented` means "a Radix layer, the carousel or a slider consumed
 * this key". Single printable characters are never prevented by Radix typeahead,
 * hence the target guards.
 */
export function useMeetingFlowKeys({
  rootRef,
  step,
  setStep,
  presenting,
  togglePresent,
  panelOpen,
  closePanel,
  presentationRef,
}: UseMeetingFlowKeysArgs) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) {
        return
      }
      if (event.isComposing || event.keyCode === 229) {
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }
      const root = rootRef.current
      const target = event.target
      if (!root || !(target instanceof Element)) {
        return
      }
      // Focus inside a portaled Radix layer (dialog, sheet, select, menu): not ours.
      if (target !== document.body && !root.contains(target)) {
        return
      }
      if (target.closest(TYPING_TARGET_SELECTOR) || (target instanceof HTMLElement && target.isContentEditable)) {
        return
      }

      const key = event.key

      if (key === 'Escape') {
        if (panelOpen) {
          event.preventDefault()
          closePanel()
        }
        else if (presenting) {
          event.preventDefault()
          togglePresent()
        }
        return
      }
      if (event.repeat && !REPEATABLE_KEYS.has(key)) {
        return
      }
      if (event.shiftKey && ARROW_KEYS.has(key)) {
        return
      }

      switch (key) {
        case 'ArrowLeft':
          event.preventDefault()
          if (step > 1) {
            setStep(step - 1)
          }
          return
        case 'ArrowRight':
          event.preventDefault()
          if (step < TOTAL_STEPS) {
            setStep(step + 1)
          }
          return
        case 'ArrowUp':
        case 'ArrowDown': {
          const handle = presentationRef.current
          if (!handle) {
            return // page step: the browser scrolls the focused step region
          }
          event.preventDefault()
          if (key === 'ArrowDown') {
            handle.next()
          }
          else {
            handle.prev()
          }
          return
        }
        case 'a':
        case 'A':
        case 'z':
        case 'Z': {
          const handle = presentationRef.current
          if (!handle) {
            return
          }
          event.preventDefault()
          if (key === 'z' || key === 'Z') {
            handle.next()
          }
          else {
            handle.prev()
          }
          return
        }
        case 'p':
        case 'P':
          event.preventDefault()
          togglePresent()
          return
        default: {
          if (/^[1-9]$/.test(key)) {
            const n = Number(key)
            if (n <= TOTAL_STEPS) {
              event.preventDefault()
              setStep(n)
            }
          }
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [rootRef, step, setStep, presenting, togglePresent, panelOpen, closePanel, presentationRef])
}
