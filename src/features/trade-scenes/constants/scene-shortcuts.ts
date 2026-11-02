import type { SHORTCUT_COPY } from '@/features/trade-scenes/constants/home-scene-copy'

// Matched on `event.key.toLowerCase()`, so a held Shift or Caps Lock still reaches the letter.
export const SCENE_SHORTCUTS = { '1': 'normal', '2': 'summer', '3': 'winter', '4': 'rain', 'v': 'homeView', 't': 'thermal', 'b': 'build', 'm': 'modify', 'escape': 'wholeHome', 'r': 'recenter', '?': 'sheet' } as const

export type SceneShortcutKey = keyof typeof SCENE_SHORTCUTS

export const SCENE_SHORTCUT_KEYS = Object.fromEntries(Object.entries(SCENE_SHORTCUTS).map(([key, action]) => [action, key])) as {
  [Key in SceneShortcutKey as typeof SCENE_SHORTCUTS[Key]]: Key
}

// The sheet's lines in reading order; the four weathers share one.
export const SHORTCUT_SHEET_ROWS = [
  { line: 'weather', keys: ['1', '2', '3', '4'] },
  { line: 'homeView', keys: ['v'] },
  { line: 'thermal', keys: ['t'] },
  { line: 'build', keys: ['b'] },
  { line: 'modify', keys: ['m'] },
  { line: 'wholeHome', keys: ['escape'] },
  { line: 'recenter', keys: ['r'] },
  { line: 'sheet', keys: ['?'] },
] as const satisfies ReadonlyArray<{ line: keyof typeof SHORTCUT_COPY.lines, keys: readonly SceneShortcutKey[] }>

// The cap a key is drawn in, wherever it shows; its box and place are the caller's.
export const KEYCAP_CLASS = 'inline-grid place-items-center rounded-[4px] border border-b-2 border-input bg-muted px-1 font-mono text-xs leading-none font-bold text-foreground'
