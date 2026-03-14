'use client'

import type { CollectionField } from '@/features/meetings/types'
import type { Customer, Meeting } from '@/shared/db/schema'
import { getJsonbSection } from '@/features/meetings/lib/get-jsonb-section'
import { DebouncedTextInput } from '@/features/meetings/ui/components/debounced-text-input'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { cn } from '@/shared/lib/utils'

interface StepDataContentProps {
  customer: Customer | null
  fields: CollectionField[]
  meeting: Meeting
  onSave: (field: CollectionField, value: string | number | boolean) => void
}

export function StepDataContent({ customer, fields, meeting, onSave }: StepDataContentProps) {
  const hasFields = fields.length > 0

  return (
    <div className="flex flex-col gap-1 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Collect This Step
      </p>

      {!hasFields && (
        <p className="text-sm italic text-muted-foreground">
          No fields to collect on this step — just present and listen.
        </p>
      )}

      {hasFields && (
        <div className="flex flex-col gap-4">
          {fields.map((field) => {
            const source = field.entity === 'customer' ? customer : meeting
            const section = getJsonbSection(source, field.jsonbKey)
            const rawValue = section[field.id]
            const savedValue = typeof rawValue === 'string' ? rawValue : ''

            return (
              <div key={field.id} className="flex flex-col gap-1.5">
                <Label className={cn('text-sm font-medium', !savedValue && 'text-foreground/70')}>
                  {field.label}
                  {field.required && <span className="ml-1 text-destructive">*</span>}
                  {savedValue && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      saved
                    </span>
                  )}
                </Label>

                {field.type === 'select' && field.options
                  ? (
                      <Select
                        value={savedValue}
                        onValueChange={val => onSave(field, val)}
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
                      <DebouncedTextInput
                        field={field}
                        initialValue={savedValue}
                        onSave={onSave}
                      />
                    )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
