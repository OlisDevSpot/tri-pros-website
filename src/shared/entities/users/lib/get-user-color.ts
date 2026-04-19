/**
 * Stable color palette for user avatars. Each entry gives us a coordinated
 * background / foreground / ring triplet that works in both light and dark
 * mode (opacity-based backgrounds + a high-contrast foreground).
 *
 * Kept intentionally small (10 hues) and evenly-spaced around the color
 * wheel so two adjacent colors in a participant stack read as distinct.
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
  { bg: 'bg-amber-500/25', text: 'text-amber-700 dark:text-amber-200', ring: 'ring-amber-500/50' },
  { bg: 'bg-rose-500/25', text: 'text-rose-700 dark:text-rose-200', ring: 'ring-rose-500/50' },
  { bg: 'bg-sky-500/25', text: 'text-sky-700 dark:text-sky-200', ring: 'ring-sky-500/50' },
  { bg: 'bg-emerald-500/25', text: 'text-emerald-700 dark:text-emerald-200', ring: 'ring-emerald-500/50' },
  { bg: 'bg-violet-500/25', text: 'text-violet-700 dark:text-violet-200', ring: 'ring-violet-500/50' },
  { bg: 'bg-fuchsia-500/25', text: 'text-fuchsia-700 dark:text-fuchsia-200', ring: 'ring-fuchsia-500/50' },
  { bg: 'bg-cyan-500/25', text: 'text-cyan-700 dark:text-cyan-200', ring: 'ring-cyan-500/50' },
  { bg: 'bg-orange-500/25', text: 'text-orange-700 dark:text-orange-200', ring: 'ring-orange-500/50' },
  { bg: 'bg-lime-500/25', text: 'text-lime-700 dark:text-lime-200', ring: 'ring-lime-500/50' },
  { bg: 'bg-pink-500/25', text: 'text-pink-700 dark:text-pink-200', ring: 'ring-pink-500/50' },
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
