export type ValueSource = 'input' | 'working'

export interface Resolved {
  value: number
  source: ValueSource
}

// The tag lets the screen say whose number it is ("You told us" vs "Working number") wherever an agent can override a default.
export function resolveOverridable(value: number | null, working: number): Resolved {
  return value == null ? { value: working, source: 'working' } : { value, source: 'input' }
}
