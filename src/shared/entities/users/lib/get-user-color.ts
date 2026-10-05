/**
 * Stable color palette for user avatars. Each entry gives us a coordinated
 * background / foreground / ring triplet that works in both light and dark
 * mode (the identity tokens — solid, L-matched tints with a high-contrast
 * foreground, not opacity-based).
 *
 * Eight hues, 45° apart, L-matched per mode, so one person keeps one hue in light and dark.
 */
export interface UserColorToken {
  /** Avatar fallback background (subtle tint). */
  bg: string
  /** Avatar fallback text color (high contrast against `bg`). */
  text: string
  /** Optional ring color for stacked avatars. */
  ring: string
}

const USER_COLOR_PALETTE: readonly UserColorToken[] = [
  { bg: 'bg-identity-1-bg', text: 'text-identity-1-fg', ring: 'ring-identity-1-ring' },
  { bg: 'bg-identity-2-bg', text: 'text-identity-2-fg', ring: 'ring-identity-2-ring' },
  { bg: 'bg-identity-3-bg', text: 'text-identity-3-fg', ring: 'ring-identity-3-ring' },
  { bg: 'bg-identity-4-bg', text: 'text-identity-4-fg', ring: 'ring-identity-4-ring' },
  { bg: 'bg-identity-5-bg', text: 'text-identity-5-fg', ring: 'ring-identity-5-ring' },
  { bg: 'bg-identity-6-bg', text: 'text-identity-6-fg', ring: 'ring-identity-6-ring' },
  { bg: 'bg-identity-7-bg', text: 'text-identity-7-fg', ring: 'ring-identity-7-ring' },
  { bg: 'bg-identity-8-bg', text: 'text-identity-8-fg', ring: 'ring-identity-8-ring' },
] as const

/**
 * djb2-inspired string hash → non-negative index into the palette.
 * Deterministic: the same `id` always resolves to the same color across
 * sessions, devices, and surfaces. This lets reps "learn" their color
 * across the app (e.g. spot themselves in a participant stack at a glance).
 */
function hashStringToIndex(id: string, modulo: number): number {
  let hash = 5381
  for (let i = 0; i < id.length; i += 1) {
    hash = ((hash << 5) + hash + id.charCodeAt(i)) >>> 0
  }
  return hash % modulo
}

/**
 * Return the stable color triplet for a user.
 * @param userId The user's immutable id (e.g. `user.id`). Required for stable mapping.
 */
export function getUserColorToken(userId: string): UserColorToken {
  const idx = hashStringToIndex(userId, USER_COLOR_PALETTE.length)
  return USER_COLOR_PALETTE[idx] ?? USER_COLOR_PALETTE[0]
}
