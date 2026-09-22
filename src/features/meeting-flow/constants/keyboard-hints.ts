import type { KeyHint } from '@/features/meeting-flow/types'

/** Rendered as `<kbd>` badges in the panel's Meeting section. */
export const MEETING_FLOW_KEY_HINTS: KeyHint[] = [
  { keys: ['←', '→'], label: 'Previous / next step' },
  { keys: ['↑', '↓', 'A', 'Z'], label: 'Previous / next slide in the presentation' },
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
} as const

/**
 * Elements whose own keyboard interaction must win over the flow map: text entry
 * plus the APG roles that consume arrows, Home/End and printable characters
 * (Radix Select = combobox + listbox, Menu = menu/menuitem, cmdk = combobox).
 */
export const TYPING_TARGET_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="option"]',
  '[role="textbox"]',
  '[role="searchbox"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
].join(',')

/** Keys that may auto-repeat while held (hold-to-scroll); toggles and jumps must not flap. */
export const REPEATABLE_KEYS: ReadonlySet<string> = new Set(['ArrowUp', 'ArrowDown', 'a', 'A', 'z', 'Z'])

export const ARROW_KEYS: ReadonlySet<string> = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])
