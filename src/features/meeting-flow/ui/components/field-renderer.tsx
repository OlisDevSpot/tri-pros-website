'use client'

import type { CollectionField } from '@/features/meeting-flow/types'
import type { Customer, Meeting } from '@/shared/db/schema'
import { getJsonbSection } from '@/features/meeting-flow/lib/get-jsonb-section'
import { DebouncedFieldInput } from '@/features/meeting-flow/ui/components/debounced-field-input'
import { RatingButtons } from '@/features/meeting-flow/ui/components/rating-buttons'
import { Badge } from '@/shared/components/ui/badge'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Switch } from '@/shared/components/ui/switch'

interface FieldRendererProps {
  customer: Customer | null
  field: CollectionField
  meeting: Meeting
  onSave: (field: CollectionField, value: string | number | boolean) => void
}

export function FieldRenderer({ customer, field, meeting, onSave }: FieldRendererProps) {
  const source = field.entity === 'customer' ? customer : meeting
  const section = getJsonbSection(source, field.jsonbKey)
  const raw = section[field.id]
  const savedStr = typeof raw === 'string' ? raw : ''
  const savedNum = typeof raw === 'number' ? raw : null
  const savedBool = typeof raw === 'boolean' ? raw : null
  const isSaved = savedStr !== '' || savedNum !== null || savedBool !== null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">
          {field.label}
          {field.required && <span className="ml-1 text-destructive">*</span>}
        </Label>
        {isSaved && (
          <Badge className="h-4 px-1.5 text-[10px]" variant="secondary">
            saved
          </Badge>
        )}
      </div>

      {field.type === 'select' && field.options
        ? (
            <Select value={savedStr} onValueChange={val => onSave(field, val)}>
              <SelectTrigger className="h-10 w-full">
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
        : field.type === 'rating'
          ? (
              <RatingButtons field={field} savedValue={savedNum} onSave={onSave} />
            )
          : field.type === 'boolean'
            ? (
                <Switch
                  checked={raw === true}
                  onCheckedChange={checked => onSave(field, checked)}
                />
              )
            : (
                <DebouncedFieldInput field={field} initialValue={savedStr} onSave={onSave} />
              )}
    </div>
  )
}
