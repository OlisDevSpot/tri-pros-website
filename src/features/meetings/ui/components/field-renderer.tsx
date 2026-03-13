'use client'

import type { CollectionField, JsonbSection } from '@/features/meetings/types'
import type { Meeting } from '@/shared/db/schema'
import { DebouncedFieldInput } from '@/features/meetings/ui/components/debounced-field-input'
import { RatingButtons } from '@/features/meetings/ui/components/rating-buttons'
import { Badge } from '@/shared/components/ui/badge'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'

interface FieldRendererProps {
  field: CollectionField
  meeting: Meeting
  onSave: (jsonbKey: JsonbSection, id: string, value: string | number) => void
}

export function FieldRenderer({ field, meeting, onSave }: FieldRendererProps) {
  const section = (meeting[field.jsonbKey] ?? {}) as Record<string, unknown>
  const raw = section[field.id]
  const savedStr = typeof raw === 'string' ? raw : ''
  const savedNum = typeof raw === 'number' ? raw : null
  const isSaved = savedStr !== '' || savedNum !== null

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
            <Select value={savedStr} onValueChange={val => onSave(field.jsonbKey, field.id, val)}>
              <SelectTrigger className="h-10">
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
          : (
              <DebouncedFieldInput field={field} initialValue={savedStr} onSave={onSave} />
            )}
    </div>
  )
}
