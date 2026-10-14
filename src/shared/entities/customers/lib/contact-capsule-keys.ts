/** The capsule's buttons in visual order. */
export function capsuleButtons(group: HTMLElement): HTMLButtonElement[] {
  return [...group.querySelectorAll<HTMLButtonElement>('button')]
}

/**
 * Where a key sends focus from the button at `index` of `count`: another button's index, `'leave'` to hand
 * focus back to whatever the capsule sits in, or null for a key the capsule leaves to the button (Enter,
 * Space and ↓ open its menu).
 */
export function capsuleKeyTarget(key: string, index: number, count: number): number | 'leave' | null {
  switch (key) {
    case 'ArrowRight': return Math.min(index + 1, count - 1)
    case 'ArrowLeft': return index === 0 ? 'leave' : index - 1
    case 'Home': return 0
    case 'End': return count - 1
    case 'ArrowUp': return 'leave'
    default: return null
  }
}
