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
  sent: { bg: 'bg-status-attention-bg/50 hover:bg-status-attention-bg', icon: SendIcon, iconClass: 'text-status-attention-fg', textClass: 'text-status-attention-fg font-medium', valueClass: 'text-status-attention-fg' },
  approved: { bg: 'bg-status-success-bg/50 hover:bg-status-success-bg', icon: CheckCircle2Icon, iconClass: 'text-status-success-fg', textClass: 'text-status-success-fg font-medium', valueClass: 'text-status-success-fg' },
  declined: { bg: 'bg-status-danger-bg/40 hover:bg-status-danger-bg/70', icon: XCircleIcon, iconClass: 'text-status-danger-fg/70', textClass: 'text-status-danger-fg/70 line-through', valueClass: 'text-status-danger-fg/60 line-through' },
}
