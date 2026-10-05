/**
 * Keys that never count as a press: Tab must move focus on (E4 does not trap it), modifiers
 * are halves of shortcuts, Escape is not a "go". Function keys are matched by pattern below.
 */
const NOT_A_PRESS_KEYS: ReadonlySet<string> = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'Escape', 'CapsLock', 'Fn', 'ContextMenu'])

/**
 * Whether a key dismisses a held splash: any key except Tab, modifiers, Escape, function keys
 * and browser shortcuts. Only presses are consumed, so reload and devtools still work (review F5).
 */
export function isSplashPress(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'>): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return false
  }
  return !NOT_A_PRESS_KEYS.has(event.key) && !/^F\d{1,2}$/.test(event.key)
}
