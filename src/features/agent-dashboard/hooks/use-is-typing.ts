'use client'

import { useEffect, useState } from 'react'

const TEXT_ENTRY_SELECTOR = [
  'textarea',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=reset]):not([type=range]):not([type=file]):not([type=color]):not([type=hidden])',
].join(',')

function asTextEntry(target: EventTarget | null): Element | null {
  return target instanceof Element && target.matches(TEXT_ENTRY_SELECTOR) ? target : null
}

/**
 * True while a text field has focus. Focus moves before the on-screen keyboard animates in, so
 * hiding on it keeps floating chrome from riding up on the keyboard; a viewport resize fires
 * only after the keyboard has already covered it. `focusout.relatedTarget` is the field focus
 * moves to, so tabbing between fields never flickers.
 *
 * A focused field removed from the DOM (an inline edit committing on Enter, a search clearing, a
 * navigation) takes focus with it without any focusout, which would leave the chrome hidden and
 * inert for good. So while a field is tracked, a DOM observer drops it once it is disconnected,
 * and any pointer press re-reads `document.activeElement`.
 */
export function useIsTyping(): boolean {
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    let field: Element | null = null

    // Only `isConnected` is checked here, never `activeElement`: between a field's focusout and
    // the next field's focusin, `activeElement` is briefly the body.
    const observer = new MutationObserver(() => {
      if (field && !field.isConnected) {
        track(null)
      }
    })

    function track(next: Element | null) {
      if (next === field) {
        return
      }
      field = next
      observer.disconnect()
      if (field) {
        observer.observe(document.body, { childList: true, subtree: true })
      }
      setIsTyping(field !== null)
    }

    const onFocusIn = (event: FocusEvent) => track(asTextEntry(event.target))
    const onFocusOut = (event: FocusEvent) => track(asTextEntry(event.relatedTarget))
    const onPointerDown = () => track(asTextEntry(document.activeElement))
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    document.addEventListener('pointerdown', onPointerDown, { capture: true })
    return () => {
      observer.disconnect()
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('pointerdown', onPointerDown, { capture: true })
    }
  }, [])

  return isTyping
}
