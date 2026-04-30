'use client'

import type { FilterDefinition } from '@/shared/dal/client/query/types'

import { Button } from '@/shared/components/ui/button'

interface Props {
  definition: Extract<FilterDefinition, { type: 'boolean' }>
  value: boolean | undefined
  onChange: (value: boolean | undefined) => void
}

export function BooleanFilterControl({ definition, value, onChange }: Props) {
  const isOn = value === true
  return (
    <Button
      type="button"
      variant={isOn ? 'default' : 'outline'}
      size="sm"
      onClick={() => onChange(isOn ? undefined : true)}
    >
      {definition.label}
    </Button>
  )
}
