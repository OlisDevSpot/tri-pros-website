import type { ComponentType, SVGProps } from 'react'
import { AlertTriangle, EyeOff, Mail } from 'lucide-react'

/**
 * Customer-side effect of an action. Drives the icon + color treatment
 * shown next to every action button so the agent can never accidentally
 * trigger a customer notification.
 *
 *  - `silent`: nothing happens on the customer side
 *  - `notifies`: customer receives an email or their existing access changes
 *  - `destructive`: customer's existing artifact (signing link, envelope) is invalidated
 *
 * Pair with action-specific microcopy describing *what* the customer sees.
 */
export type ActionImpact = 'silent' | 'notifies' | 'destructive'

interface ImpactMeta {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  iconClassName: string
  labelClassName: string
}

export const ACTION_IMPACT_META: Record<ActionImpact, ImpactMeta> = {
  silent: {
    icon: EyeOff,
    iconClassName: 'text-muted-foreground',
    labelClassName: 'text-muted-foreground',
  },
  notifies: {
    icon: Mail,
    iconClassName: 'text-blue-600 dark:text-blue-400',
    labelClassName: 'text-blue-700 dark:text-blue-300',
  },
  destructive: {
    icon: AlertTriangle,
    iconClassName: 'text-destructive',
    labelClassName: 'text-destructive',
  },
}
