import type { ZohoActionStatus } from '@/shared/services/zoho-sign/types'

import { CheckCircle, Eye, Mail, Minus } from 'lucide-react'

import { ACTION_STATUS_CONFIG } from '../constants/contract-statuses'

const ICONS: Record<ZohoActionStatus, React.ReactNode> = {
  NOACTION: <Minus className="size-4 text-muted-foreground" />,
  UNOPENED: <Mail className="size-4 text-muted-foreground" />,
  VIEWED: <Eye className="size-4 text-blue-500" />,
  SIGNED: <CheckCircle className="size-4 text-green-500" />,
}

interface SignerStatusRowProps {
  role: string
  status: ZohoActionStatus
}

export function SignerStatusRow({ role, status }: SignerStatusRowProps) {
  const config = ACTION_STATUS_CONFIG[status]

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{role}</span>
      <div className="flex items-center gap-1.5">
        {ICONS[status]}
        <span>{config.label}</span>
      </div>
    </div>
  )
}
