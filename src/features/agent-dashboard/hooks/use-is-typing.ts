'use client'

import { useEffect, useState } from 'react'

const TEXT_ENTRY_SELECTOR = [
  'textarea',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=reset]):not([type=range]):not([type=file]):not([type=color]):not([type=hidden])',
].join(',')

function isTextEntry(target: EventTarget | null): boolean {
  return target instanceof Element && target.matches(TEXT_ENTRY_SELECTOR)
}

/**
 * True while a text field has focus. Focus moves before the on-screen keyboard animates in, so
 * hiding on it keeps floating chrome from riding up on the keyboard; a viewport resize fires
 * only after the keyboard has already covered it. `focusout.relatedTarget` is the field focus
 * moves to, so tabbing between fields never flickers.
 */
export function useIsTyping(): boolean {
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => setIsTyping(isTextEntry(event.target))
    const onFocusOut = (event: FocusEvent) => setIsTyping(isTextEntry(event.relatedTarget))
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  return isTyping
}
