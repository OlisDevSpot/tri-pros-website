import type { KeyHint } from '@/features/meeting-flow/types'

/** Rendered as `<kbd>` badges in the panel's Meeting section. */
export const MEETING_FLOW_KEY_HINTS: KeyHint[] = [
  { keys: ['←', '→'], label: 'Previous / next step' },
  { keys: ['↑', '↓', 'A', 'Z'], label: 'Previous / next slide, or project in the portfolio' },
  { keys: ['Space'], label: 'Next photo in the portfolio' },
  { keys: ['1–7'], label: 'Jump to a step' },
  { keys: ['P'], label: 'Present mode on / off' },
  { keys: ['Esc'], label: 'Close the panel, then exit present mode' },
]

/** `aria-keyshortcuts` values (WAI-ARIA key names) for the controls each key drives. */
export const KEY_SHORTCUTS = {
  prevStep: 'ArrowLeft',
  nextStep: 'ArrowRight',
  present: 'P',
  presentation: 'ArrowUp ArrowDown A Z',
  portfolio: 'Space ArrowUp ArrowDown A Z',
} as const

/** Controls the browser already activates on Space; the flow must not act on the same press. */
export const ACTIVATABLE_TARGET_SELECTOR = 'button, a[href], summary, [role="button"], [role="link"], [role="tab"]'

/** Keys that may auto-repeat while held (hold-to-scroll); toggles and jumps must not flap. */
export const REPEATABLE_KEYS: ReadonlySet<string> = new Set(['ArrowUp', 'ArrowDown', 'a', 'A', 'z', 'Z'])

export const ARROW_KEYS: ReadonlySet<string> = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])
