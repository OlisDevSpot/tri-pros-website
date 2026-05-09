'use client'

import type { CustomerSegment } from '@/shared/entities/lead-sources/constants/customer-segments'

import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface SegmentDef {
  key: CustomerSegment
  label: string
}

const SEGMENTS: SegmentDef[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'signed', label: 'Signed' },
  { key: 'dead', label: 'Dead' },
]

interface CustomerStatusSegmentsProps {
  value: CustomerSegment
  counts: { all: number, active: number, signed: number, dead: number } | undefined
  onChange: (next: CustomerSegment) => void
  isLoading: boolean
}

export function CustomerStatusSegments({ value, counts, onChange, isLoading }: CustomerStatusSegmentsProps) {
  return (
    <div role="tablist" aria-label="Customer status filter" className="flex flex-wrap gap-2">
      {SEGMENTS.map((seg) => {
        const isActive = seg.key === value
        const count = counts?.[seg.key]
        return (
          <Button
            key={seg.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            size="sm"
            variant={isActive ? 'default' : 'outline'}
            onClick={() => onChange(seg.key)}
            className={cn('h-8 gap-2 text-xs font-medium', isActive && 'shadow-none')}
          >
            <span>{seg.label}</span>
            <span
              className={cn(
                'tabular-nums',
                isActive ? 'text-primary-foreground/80' : 'text-muted-foreground',
              )}
            >
              {isLoading ? '…' : (count ?? 0).toLocaleString()}
            </span>
          </Button>
        )
      })}
    </div>
  )
}
