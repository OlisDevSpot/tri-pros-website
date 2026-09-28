'use client'

import { useState } from 'react'

import { formatMonthLabel } from '@/features/analytics/lib/format-analytics'
import { formatCentsForInput, parseDollarsToCents } from '@/features/analytics/lib/parse-dollars'
import { Input } from '@/shared/components/ui/input'
import { cn } from '@/shared/lib/utils'

interface Props {
  sourceName: string
  month: string
  amountCents: number | null
  missing: boolean
  onSave: (amountCents: number | null, done: () => void) => void
}

export function SpendCell({ sourceName, month, amountCents, missing, onSave }: Props) {
  const [text, setText] = useState(amountCents === null ? '' : formatCentsForInput(amountCents))
  const [invalid, setInvalid] = useState(false)
  const [saving, setSaving] = useState(false)
  const onBlur = () => {
    const parsed = parseDollarsToCents(text)
    if (parsed === 'invalid') {
      setInvalid(true)
      return
    }
    setInvalid(false)
    if (parsed !== amountCents) {
      setSaving(true)
      onSave(parsed, () => setSaving(false))
    }
  }
  return (
    <Input
      aria-label={`${sourceName} spend, ${formatMonthLabel(month)}`}
      aria-invalid={invalid}
      title={invalid ? 'Dollars only, like 1200 or 1,200.50' : undefined}
      inputMode="decimal"
      placeholder="—"
      value={text}
      disabled={saving}
      onChange={e => setText(e.target.value)}
      onBlur={onBlur}
      className={cn('h-8 w-24 text-right tabular-nums', missing && text === '' && 'border-warning bg-warning/10')}
    />
  )
}
