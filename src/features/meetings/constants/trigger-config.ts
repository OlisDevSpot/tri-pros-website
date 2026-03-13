import { AlertTriangleIcon, CheckCircleIcon, ShieldCheckIcon, UsersIcon, ZapIcon } from 'lucide-react'

export const triggerConfig = {
  'authority': {
    bg: 'bg-emerald-950/80 border-emerald-700/50',
    icon: ShieldCheckIcon,
    text: 'text-emerald-300',
  },
  'risk-reduction': {
    bg: 'bg-sky-950/80 border-sky-700/50',
    icon: CheckCircleIcon,
    text: 'text-sky-300',
  },
  'scarcity': {
    bg: 'bg-amber-950/80 border-amber-700/50',
    icon: AlertTriangleIcon,
    text: 'text-amber-300',
  },
  'social-proof': {
    bg: 'bg-violet-950/80 border-violet-700/50',
    icon: UsersIcon,
    text: 'text-violet-300',
  },
  'urgency': {
    bg: 'bg-amber-950/80 border-amber-700/50',
    icon: ZapIcon,
    text: 'text-amber-300',
  },
} as const
