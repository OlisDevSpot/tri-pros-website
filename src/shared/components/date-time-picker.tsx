'use client'

import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/shared/components/ui/button'
import { Calendar } from '@/shared/components/ui/calendar'
import { Input } from '@/shared/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { cn } from '@/shared/lib/utils'

interface Props {
  value: Date | undefined
  onChange: (date: Date | undefined) => void
  className?: string
  placeholder?: string
  children?: React.ReactNode
}

export function DateTimePicker({ value, onChange, className, placeholder = 'Pick date & time', children }: Props) {
  const [open, setOpen] = useState(false)

  function handleDateSelect(date: Date | undefined) {
    if (!date) {
      onChange(undefined)
      return
    }
    const merged = new Date(date)
    if (value) {
      merged.setHours(value.getHours(), value.getMinutes(), 0, 0)
    }
    onChange(merged)
  }

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const [h, m] = e.target.value.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) {
      return
    }
    const next = value ? new Date(value) : new Date()
    next.setHours(h, m, 0, 0)
    onChange(next)
  }

  const timeValue = value
    ? `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
    : ''

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'justify-start text-left font-normal h-auto px-2 py-1',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          {children ?? (
            <>
              <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {value
                ? (
                    <span className="text-xs tabular-nums">{format(value, 'MMM d, yyyy h:mm a')}</span>
                  )
                : (
                    <span className="text-xs">{placeholder}</span>
                  )}
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={handleDateSelect}
          initialFocus
        />
        <div className="border-t px-3 py-2">
          <Input
            type="time"
            value={timeValue}
            onChange={handleTimeChange}
            className="h-8 text-sm"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
