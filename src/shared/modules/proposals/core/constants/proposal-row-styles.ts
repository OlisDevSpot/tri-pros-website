import type { LucideIcon } from 'lucide-react'

import { CheckCircle2Icon, FileTextIcon, SendIcon, XCircleIcon } from 'lucide-react'

export interface ProposalRowStyle {
  bg: string
  icon: LucideIcon
  iconClass: string
  textClass: string
  valueClass: string
}

export const PROPOSAL_ROW_STYLES: Record<string, ProposalRowStyle> = {
  draft: { bg: 'hover:bg-background/50', icon: FileTextIcon, iconClass: 'text-muted-foreground', textClass: 'text-muted-foreground', valueClass: 'text-muted-foreground' },
  sent: { bg: 'bg-amber-500/6 hover:bg-amber-500/10 dark:bg-amber-500/8 dark:hover:bg-amber-500/12', icon: SendIcon, iconClass: 'text-amber-600 dark:text-amber-400', textClass: 'text-amber-700 dark:text-amber-400 font-medium', valueClass: 'text-amber-700 dark:text-amber-400' },
  approved: { bg: 'bg-green-500/8 hover:bg-green-500/12 dark:bg-green-500/10 dark:hover:bg-green-500/15', icon: CheckCircle2Icon, iconClass: 'text-green-600 dark:text-green-400', textClass: 'text-green-700 dark:text-green-400 font-medium', valueClass: 'text-green-700 dark:text-green-400' },
  declined: { bg: 'bg-red-500/6 hover:bg-red-500/10 dark:bg-red-500/8 dark:hover:bg-red-500/12', icon: XCircleIcon, iconClass: 'text-red-500/70 dark:text-red-400/70', textClass: 'text-red-600/70 dark:text-red-400/70 line-through', valueClass: 'text-red-500/50 dark:text-red-400/50 line-through' },
}
