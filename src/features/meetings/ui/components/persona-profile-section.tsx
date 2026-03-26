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
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  strong: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  moderate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  weak: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  primary: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  secondary: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

export function SeverityBadge({ value }: { value: string }) {
  return (
    <Badge
      className={`text-[10px] font-medium ${SEVERITY_COLORS[value] ?? 'bg-gray-100 text-gray-600'}`}
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
