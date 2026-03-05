'use client'

import type { CollectionField } from '@/features/meetings/types'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { cn } from '@/shared/lib/utils'

interface DataCollectionPanelProps {
  className?: string
  fields: CollectionField[]
  onChange: (id: string, value: string) => void
  values: Record<string, string>
}

export function DataCollectionPanel({ className, fields, onChange, values }: DataCollectionPanelProps) {
  if (fields.length === 0) {
    return null
  }

  return (
    <div className={cn('rounded-xl border border-border/50 bg-card/40 p-4', className)}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Collect Before Next Step
      </p>
      <div className="flex flex-col gap-3">
        {fields.map(field => (
          <div key={field.id} className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-foreground/80">
              {field.label}
              {field.required && <span className="ml-1 text-destructive">*</span>}
            </Label>

            {field.type === 'select' && field.options
              ? (
                  <Select
                    value={values[field.id] ?? ''}
                    onValueChange={value => onChange(field.id, value)}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map(opt => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )
              : (
                  <Input
                    className="h-9 text-sm"
                    placeholder={field.placeholder ?? ''}
                    value={values[field.id] ?? ''}
                    onChange={e => onChange(field.id, e.target.value)}
                  />
                )}
          </div>
        ))}
      </div>
    </div>
  )
}
