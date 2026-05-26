'use client'

import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog'
import { cn } from '@/shared/lib/utils'

interface ActionConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  details?: ReactNode
  confirmLabel: string
  confirmVariant?: 'default' | 'destructive'
  onConfirm: () => void
  isPending?: boolean
}

/**
 * Confirmation dialog used for any action that's destructive OR sends
 * the customer a notification. `description` is rendered inside an
 * AlertDialogDescription (a `<p>`); pass richer block content via
 * `details` to render below the description.
 */
export function ActionConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  details,
  confirmLabel,
  confirmVariant = 'default',
  onConfirm,
  isPending,
}: ActionConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {details && (
          <div className="text-sm text-muted-foreground">{details}</div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className={cn(
              confirmVariant === 'destructive' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
            )}
          >
            {isPending
              ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Working...
                  </>
                )
              : (
                  confirmLabel
                )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
