import { TYPING_TARGET_SELECTOR } from '@/shared/constants/typing-target-selector'

/**
 * True when a window-level keydown listener may act on the key. Meant for the
 * bubble phase, where `defaultPrevented` means React or Radix already used it.
 * `event.repeat` and Escape are left to each caller: some keys repeat on purpose.
 */
export function isUnclaimedKey(event: KeyboardEvent, root: Element | null): boolean {
  if (event.defaultPrevented) {
    return false
  }
  if (event.isComposing || event.keyCode === 229) {
    return false
  }
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return false
  }
  const target = event.target
  if (!root || !(target instanceof Element)) {
    return false
  }
  // Focus inside a portaled Radix layer (dialog, sheet, select, menu) is not the root's.
  if (target !== document.body && !root.contains(target)) {
    return false
  }
  if (target.closest(TYPING_TARGET_SELECTOR) || (target instanceof HTMLElement && target.isContentEditable)) {
    return false
  }
  return true
}
