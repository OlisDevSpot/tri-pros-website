'use client'

import type { ContextPanelFieldConfig } from '@/features/meetings/ui/components/context-panel-field'
import { ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'
import { ContextPanelField } from '@/features/meetings/ui/components/context-panel-field'
import { Badge } from '@/shared/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import { cn } from '@/shared/lib/utils'

interface ContextPanelSectionProps {
  defaultOpen?: boolean
  fields: ContextPanelFieldConfig[]
  title: string
  values: Record<string, unknown>
  onFieldChange: (id: string, value: unknown) => void
}

export function ContextPanelSection({
  defaultOpen = true,
  fields,
  title,
  values,
  onFieldChange,
}: ContextPanelSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const filledCount = fields.filter((f) => {
    const v = values[f.id]
    if (v === undefined || v === null || v === '') {
      return false
    }
    if (Array.isArray(v)) {
      return v.length > 0
    }
    return true
  }).length

  const totalCount = fields.length

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          <Badge className="h-4 px-1.5 text-[10px]" variant={filledCount === totalCount ? 'default' : 'secondary'}>
            {`${filledCount}/${totalCount}`}
          </Badge>
        </div>
        <ChevronDownIcon
          className={cn(
            'size-4 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="flex flex-col gap-3 px-2 pb-3 pt-1">
        {fields.map(field => (
          <ContextPanelField
            key={field.id}
            config={field}
            value={values[field.id]}
            onChange={onFieldChange}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
