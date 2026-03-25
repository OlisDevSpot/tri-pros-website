'use client'

import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

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
  const [draft, setDraft] = useState<Date | undefined>(value)
  const openRef = useRef(false)

  // Sync draft from external value when popover is closed
  useEffect(() => {
    if (!openRef.current) {
      setDraft(value)
    }
  }, [value])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && openRef.current) {
      // Popover closing — commit draft if it changed
      if (draft?.getTime() !== value?.getTime()) {
        onChange(draft)
      }
    }
    openRef.current = nextOpen
    setOpen(nextOpen)
  }

  function handleDateSelect(date: Date | undefined) {
    if (!date) {
      setDraft(undefined)
      return
    }
    const merged = new Date(date)
    if (draft) {
      merged.setHours(draft.getHours(), draft.getMinutes(), 0, 0)
    }
    setDraft(merged)
  }

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const [h, m] = e.target.value.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) {
      return
    }
    const next = draft ? new Date(draft) : new Date()
    next.setHours(h, m, 0, 0)
    setDraft(next)
  }

  const timeValue = draft
    ? `${String(draft.getHours()).padStart(2, '0')}:${String(draft.getMinutes()).padStart(2, '0')}`
    : ''

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
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
          selected={draft}
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
