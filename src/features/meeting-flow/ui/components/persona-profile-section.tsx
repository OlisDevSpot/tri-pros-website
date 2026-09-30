'use client'

import type { ReactNode } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/shared/components/ui/badge'

interface PersonaProfileSectionProps {
  title: string
  icon: ReactNode
  count: number
  children: ReactNode
  defaultOpen?: boolean
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-status-danger-bg text-status-danger-fg',
  high: 'bg-status-attention-bg text-status-attention-fg',
  medium: 'bg-status-pending-bg text-status-pending-fg',
  low: 'bg-status-success-bg text-status-success-fg',
  strong: 'bg-status-info-bg text-status-info-fg',
  moderate: 'bg-status-idle-bg text-status-idle-fg',
  weak: 'bg-muted text-muted-foreground',
  primary: 'bg-status-action-bg text-status-action-fg',
  secondary: 'bg-status-idle-bg text-status-idle-fg',
}

export function SeverityBadge({ value }: { value: string }) {
  return (
    <Badge
      className={`text-[10px] font-medium ${SEVERITY_COLORS[value] ?? 'bg-muted text-muted-foreground'}`}
      variant="outline"
    >
      {value}
    </Badge>
  )
}

export function PersonaProfileSection({ children, count, defaultOpen = false, icon, title }: PersonaProfileSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  if (count === 0) {
    return null
  }

  return (
    <div className="border-b border-border/40 last:border-b-0">
      <button
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/50"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-muted-foreground">{icon}</span>
        <span className="flex-1 text-sm font-medium">{title}</span>
        <Badge className="h-5 min-w-[1.5rem] px-1.5 text-[10px] tabular-nums" variant="outline">
          {count}
        </Badge>
        <ChevronDownIcon className={`size-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="space-y-2 px-4 pb-3">
          {children}
        </div>
      )}
    </div>
  )
}
