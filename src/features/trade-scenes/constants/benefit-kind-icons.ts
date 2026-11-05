import type { LucideIcon } from 'lucide-react'
import type { BenefitKind } from '@/shared/modules/construction/core/constants/benefit-kinds'

import { AwardIcon, CircleDollarSignIcon, EyeIcon, HourglassIcon, LeafIcon, ShieldCheckIcon, WindIcon } from 'lucide-react'

export const BENEFIT_KIND_ICONS = {
  'savings': CircleDollarSignIcon,
  'easier-on-hvac': WindIcon,
  'protection': ShieldCheckIcon,
  'lasts-longer': HourglassIcon,
  'warranty': AwardIcon,
  'looks-and-use': EyeIcon,
  'planet': LeafIcon,
} as const satisfies Record<BenefitKind, LucideIcon>
