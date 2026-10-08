import type { LucideIcon } from 'lucide-react'

import { CheckCircle2Icon, FileTextIcon, SendIcon, XCircleIcon } from 'lucide-react'

export interface ProposalRowStyle {
  bg: string
  icon: LucideIcon
  iconClass: string
  textClass: string
  valueClass: string
}

// A tile in a status is filled solid with its tone and hovers a solid step off it, so it never shows the surface
// through. A draft has no tone to show; it sits on the surface and hovers like a row. Every tile carries a border,
// transparent on a draft, so all four keep one size.
export const PROPOSAL_ROW_STYLES: Record<string, ProposalRowStyle> = {
  draft: { bg: 'border border-transparent hover:bg-row-hover', icon: FileTextIcon, iconClass: 'text-muted-foreground', textClass: 'text-muted-foreground', valueClass: 'text-muted-foreground' },
  sent: { bg: 'border border-status-attention-dot/40 bg-status-attention-bg hover:bg-status-attention-hover', icon: SendIcon, iconClass: 'text-status-attention-fg', textClass: 'text-status-attention-fg font-medium', valueClass: 'text-status-attention-fg' },
  approved: { bg: 'border border-status-success-dot/40 bg-status-success-bg hover:bg-status-success-hover', icon: CheckCircle2Icon, iconClass: 'text-status-success-fg', textClass: 'text-status-success-fg font-medium', valueClass: 'text-status-success-fg' },
  declined: { bg: 'border border-status-danger-dot/40 bg-status-danger-bg hover:bg-status-danger-hover', icon: XCircleIcon, iconClass: 'text-status-danger-fg', textClass: 'text-status-danger-fg line-through', valueClass: 'text-status-danger-fg line-through' },
}
