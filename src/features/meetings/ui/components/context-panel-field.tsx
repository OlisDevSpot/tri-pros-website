'use client'

import { useCallback, useRef, useState } from 'react'
import { Badge } from '@/shared/components/ui/badge'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Switch } from '@/shared/components/ui/switch'
import { Textarea } from '@/shared/components/ui/textarea'

export interface ContextPanelFieldConfig {
  id: string
  label: string
  type: 'select' | 'multi-select' | 'number' | 'boolean' | 'textarea' | 'text'
  options?: readonly string[]
  placeholder?: string
  min?: number
  max?: number
}

interface ContextPanelFieldProps {
  config: ContextPanelFieldConfig
  value: unknown
  onChange: (id: string, value: unknown) => void
}

function DebouncedInput({
  initialValue,
  onCommit,
  placeholder,
  type,
  min,
  max,
}: {
  initialValue: string
  onCommit: (value: string) => void
  placeholder?: string
  type?: 'text' | 'number'
  min?: number
  max?: number
}) {
  const [local, setLocal] = useState(initialValue)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevRef = useRef(initialValue)

  if (prevRef.current !== initialValue) {
    prevRef.current = initialValue
    setLocal(initialValue)
  }

  const handleChange = useCallback(
    (next: string) => {
      setLocal(next)
      if (timer.current) {
        clearTimeout(timer.current)
      }
      timer.current = setTimeout(() => onCommit(next), 300)
    },
    [onCommit],
  )

  return (
    <Input
      className="h-9 text-sm"
      max={max}
      min={min}
      placeholder={placeholder ?? ''}
      type={type ?? 'text'}
      value={local}
      onChange={e => handleChange(e.target.value)}
    />
  )
}

function DebouncedTextarea({
  initialValue,
  onCommit,
  placeholder,
}: {
  initialValue: string
  onCommit: (value: string) => void
  placeholder?: string
}) {
  const [local, setLocal] = useState(initialValue)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevRef = useRef(initialValue)

  if (prevRef.current !== initialValue) {
    prevRef.current = initialValue
    setLocal(initialValue)
  }

  const handleChange = useCallback(
    (next: string) => {
      setLocal(next)
      if (timer.current) {
        clearTimeout(timer.current)
      }
      timer.current = setTimeout(() => onCommit(next), 300)
    },
    [onCommit],
  )

  return (
    <Textarea
      className="min-h-[72px] text-sm"
      placeholder={placeholder ?? ''}
      value={local}
      onChange={e => handleChange(e.target.value)}
    />
  )
}

export function ContextPanelField({ config, value, onChange }: ContextPanelFieldProps) {
  const isFilled = value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0)

  const handleSelectChange = useCallback(
    (val: string) => onChange(config.id, val),
    [config.id, onChange],
  )

  const handleSwitchChange = useCallback(
    (checked: boolean) => onChange(config.id, checked),
    [config.id, onChange],
  )

  const handleMultiToggle = useCallback(
    (option: string, checked: boolean) => {
      const current = Array.isArray(value) ? (value as string[]) : []
      const next = checked ? [...current, option] : current.filter(v => v !== option)
      onChange(config.id, next)
    },
    [config.id, value, onChange],
  )

  const handleTextCommit = useCallback(
    (val: string) => onChange(config.id, val),
    [config.id, onChange],
  )

  const handleNumberCommit = useCallback(
    (val: string) => {
      const parsed = Number.parseInt(val, 10)
      if (!Number.isNaN(parsed)) {
        onChange(config.id, parsed)
      }
    },
    [config.id, onChange],
  )

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Label className="text-xs font-medium text-muted-foreground">
          {config.label}
        </Label>
        {isFilled && (
          <Badge className="h-3.5 px-1 text-[9px]" variant="secondary">
            saved
          </Badge>
        )}
      </div>

      {config.type === 'select' && config.options
        ? (
            <Select value={typeof value === 'string' ? value : ''} onValueChange={handleSelectChange}>
              <SelectTrigger className="h-9 w-full text-sm">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {config.options.map(opt => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        : config.type === 'multi-select' && config.options
          ? (
              <div className="flex flex-col gap-1.5">
                {config.options.map((opt) => {
                  const checked = Array.isArray(value) && (value as string[]).includes(opt)
                  return (
                    <div key={opt} className="flex items-center gap-2">
                      <Checkbox
                        checked={checked}
                        id={`${config.id}-${opt}`}
                        onCheckedChange={c => handleMultiToggle(opt, c === true)}
                      />
                      <Label className="cursor-pointer text-xs font-normal" htmlFor={`${config.id}-${opt}`}>
                        {opt}
                      </Label>
                    </div>
                  )
                })}
              </div>
            )
          : config.type === 'boolean'
            ? (
                <Switch
                  checked={value === true}
                  onCheckedChange={handleSwitchChange}
                />
              )
            : config.type === 'textarea'
              ? (
                  <DebouncedTextarea
                    initialValue={typeof value === 'string' ? value : ''}
                    placeholder={config.placeholder}
                    onCommit={handleTextCommit}
                  />
                )
              : config.type === 'number'
                ? (
                    <DebouncedInput
                      initialValue={typeof value === 'number' ? String(value) : ''}
                      max={config.max}
                      min={config.min}
                      placeholder={config.placeholder}
                      type="number"
                      onCommit={handleNumberCommit}
                    />
                  )
                : (
                    <DebouncedInput
                      initialValue={typeof value === 'string' ? value : ''}
                      placeholder={config.placeholder}
                      type="text"
                      onCommit={handleTextCommit}
                    />
                  )}
    </div>
  )
}
