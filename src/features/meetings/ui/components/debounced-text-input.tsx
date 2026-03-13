'use client'

import type { CollectionField, JsonbSection } from '@/features/meetings/types'
import { useCallback, useRef, useState } from 'react'
import { Input } from '@/shared/components/ui/input'

interface DebouncedTextInputProps {
  field: CollectionField
  initialValue: string
  onSave: (jsonbKey: JsonbSection, id: string, value: string) => void
}

export function DebouncedTextInput({ field, initialValue, onSave }: DebouncedTextInputProps) {
  const [value, setValue] = useState(initialValue)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevInitial = useRef(initialValue)

  // Keep in sync when a different meeting is loaded (without triggering an extra render cycle)
  if (prevInitial.current !== initialValue) {
    prevInitial.current = initialValue
    setValue(initialValue)
  }

  const handleChange = useCallback(
    (next: string) => {
      setValue(next)
      if (timer.current) {
        clearTimeout(timer.current)
      }
      timer.current = setTimeout(() => onSave(field.jsonbKey, field.id, next), 600)
    },
    [field.id, field.jsonbKey, onSave],
  )

  return (
    <Input
      className="h-9 text-sm"
      placeholder={field.placeholder ?? ''}
      value={value}
      onChange={e => handleChange(e.target.value)}
    />
  )
}
