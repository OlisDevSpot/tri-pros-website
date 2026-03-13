'use client'

import type { CollectionField, JsonbSection } from '@/features/meetings/types'
import type { Meeting } from '@/shared/db/schema'
import { DebouncedTextInput } from '@/features/meetings/ui/components/debounced-text-input'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { cn } from '@/shared/lib/utils'

interface StepDataContentProps {
  fields: CollectionField[]
  meeting: Meeting
  onSave: (jsonbKey: JsonbSection, fieldId: string, value: string) => void
}

export function StepDataContent({ fields, meeting, onSave }: StepDataContentProps) {
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
            const section = (meeting[field.jsonbKey] ?? {}) as Record<string, unknown>
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
                        onValueChange={val => onSave(field.jsonbKey, field.id, val)}
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
