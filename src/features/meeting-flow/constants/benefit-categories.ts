import {
  HeartIcon,
  HomeIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TimerIcon,
  WalletIcon,
} from 'lucide-react'

export const BENEFIT_CATEGORY_CONFIG = {
  comfort: {
    icon: HomeIcon,
    gradient: 'from-sky-500/20 to-sky-500/5',
    border: 'border-sky-500/30',
    iconBg: 'bg-sky-500/15 text-sky-500',
    label: 'Comfort',
  },
  family: {
    icon: HeartIcon,
    gradient: 'from-rose-500/20 to-rose-500/5',
    border: 'border-rose-500/30',
    iconBg: 'bg-rose-500/15 text-rose-500',
    label: 'Family',
  },
  financial: {
    icon: WalletIcon,
    gradient: 'from-emerald-500/20 to-emerald-500/5',
    border: 'border-emerald-500/30',
    iconBg: 'bg-emerald-500/15 text-emerald-500',
    label: 'Financial',
  },
  pride: {
    icon: SparklesIcon,
    gradient: 'from-amber-500/20 to-amber-500/5',
    border: 'border-amber-500/30',
    iconBg: 'bg-amber-500/15 text-amber-500',
    label: 'Pride',
  },
  security: {
    icon: ShieldCheckIcon,
    gradient: 'from-violet-500/20 to-violet-500/5',
    border: 'border-violet-500/30',
    iconBg: 'bg-violet-500/15 text-violet-500',
    label: 'Security',
  },
  urgency: {
    icon: TimerIcon,
    gradient: 'from-orange-500/20 to-orange-500/5',
    border: 'border-orange-500/30',
    iconBg: 'bg-orange-500/15 text-orange-500',
    label: 'Urgency',
  },
} as const
