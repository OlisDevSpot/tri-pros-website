/**
 * Extracts up to 2 uppercase initials from a name string. Used in avatar fallbacks.
 * Examples:
 *   "Moshe Porat" → "MP"
 *   "Sarah" → "S"
 *   "  Oliver  Lim  " → "OL"
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
