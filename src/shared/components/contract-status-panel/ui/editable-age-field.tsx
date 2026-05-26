'use client'

import { useMutation } from '@tanstack/react-query'
import { Check, Loader2, Lock, Pencil, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { HybridPopoverTooltip } from '@/shared/components/hybridPopoverTooltip'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

interface EditableAgeFieldProps {
  proposalId: string
  value: number | null
  locked: boolean
  lockReason?: string
}

/**
 * Inline age display + edit control. Locked when an active envelope
 * exists (changing age might desync the saved doc selection from the
 * required-doc rules).
 */
export function EditableAgeField({ proposalId, value, locked, lockReason }: EditableAgeFieldProps) {
  const trpc = useTRPC()
  const { invalidateProposal } = useInvalidation()
  const [isEditing, setIsEditing] = useState(false)
  const [draftValue, setDraftValue] = useState<string>(value != null ? String(value) : '')

  const submit = useMutation(
    trpc.customersRouter.submitCustomerAge.mutationOptions({
      onSuccess: () => {
        invalidateProposal()
        setIsEditing(false)
        toast.success('Customer age updated')
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to update age')
      },
    }),
  )

  const parsedAge = Number.parseInt(draftValue, 10)
  const isValid = !Number.isNaN(parsedAge) && parsedAge >= 18 && parsedAge <= 120

  function handleStart() {
    setDraftValue(value != null ? String(value) : '')
    setIsEditing(true)
  }

  function handleSave() {
    if (!isValid) {
      return
    }
    submit.mutate({ proposalId, age: parsedAge })
  }

  if (locked) {
    return (
      <HybridPopoverTooltip content={lockReason ?? 'Locked'} side="top">
        <button
          type="button"
          className="inline-flex cursor-help items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground"
          aria-label={lockReason ?? 'Age is locked'}
        >
          <span className="font-medium text-foreground">{value ?? '—'}</span>
          <Lock className="size-3 text-muted-foreground" aria-hidden />
        </button>
      </HybridPopoverTooltip>
    )
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min={18}
          max={120}
          value={draftValue}
          onChange={e => setDraftValue(e.target.value)}
          className="h-8 w-20 text-sm"
          autoFocus
          disabled={submit.isPending}
          aria-label="Customer age"
        />
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!isValid || submit.isPending}
          className="h-8 px-2"
          aria-label="Save age"
        >
          {submit.isPending
            ? <Loader2 className="size-3.5 animate-spin" />
            : <Check className="size-3.5" />}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsEditing(false)}
          disabled={submit.isPending}
          className="h-8 px-2"
          aria-label="Cancel age edit"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleStart}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 -mx-1.5 -my-1',
        'hover:bg-muted/60 transition-colors',
        'text-sm',
      )}
      aria-label="Edit customer age"
    >
      <span className="font-medium text-foreground">{value ?? 'Not set'}</span>
      <Pencil className="size-3 text-muted-foreground" aria-hidden />
    </button>
  )
}
