import type { LucideIcon } from 'lucide-react'
import { CookingPot, Grid2x2, HelpCircle, LayoutGrid, Refrigerator, Square } from 'lucide-react'

/**
 * Named icons referenceable from a funnel's option `asset: { kind:'icon', name }`.
 * Keep names stable — funnel configs reference them by string.
 */
export const OPTION_ICONS: Record<string, LucideIcon> = {
  'galley': Grid2x2,
  'island': CookingPot,
  'l-shape': Square,
  'not-sure': HelpCircle,
  'open': Refrigerator,
  'u-shape': LayoutGrid,
}
