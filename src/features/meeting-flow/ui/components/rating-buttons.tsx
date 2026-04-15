'use client'

import type { CollectionField } from '@/features/meeting-flow/types'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface RatingButtonsProps {
  field: CollectionField
  savedValue: number | null
  onSave: (field: CollectionField, value: number) => void
}

export function RatingButtons({ field, savedValue, onSave }: RatingButtonsProps) {
  const min = field.min ?? 1
  const max = field.max ?? 10
  const buttons = Array.from({ length: max - min + 1 }, (_, i) => i + min)

  return (
    <div className="flex flex-wrap gap-1.5">
      {buttons.map(n => (
        <Button
          key={n}
          className={cn(
            'size-9 rounded-lg border p-0 text-sm font-semibold transition-all hover:scale-105 active:scale-95',
            savedValue === n
              ? 'border-primary bg-primary text-primary-foreground hover:bg-primary'
              : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:bg-card hover:text-foreground',
          )}
          size="icon"
          type="button"
          variant="outline"
          onClick={() => onSave(field, n)}
        >
          {n}
        </Button>
      ))}
    </div>
  )
}
