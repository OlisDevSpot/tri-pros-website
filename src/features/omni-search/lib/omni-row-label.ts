/** A row's accessible name from its visible parts, so the option reads as one line and never picks up nested controls. */
export function omniRowLabel(...parts: (string | null | undefined | false)[]): string {
  return parts.filter(Boolean).join(', ')
}
