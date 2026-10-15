'use client'

import type { JSX } from 'react'

import { useState } from 'react'

import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'

interface UseConfirmProps {
  title: string
  message: string
  /** Defaults to "Confirm". */
  confirmLabel?: string
  /** Defaults to destructive: most confirms guard a delete. */
  confirmVariant?: 'default' | 'destructive'
}

export function useConfirm({ title, message, confirmLabel = 'Confirm', confirmVariant = 'destructive' }: UseConfirmProps): [() => JSX.Element, () => Promise<boolean>] {
  const [promise, setPromise] = useState<{ resolve: (value: boolean) => void } | null>(null)

  const confirm = () => {
    return new Promise<boolean>((resolve) => {
      setPromise({ resolve })
    })
  }

  // Escape and an outside click close the dialog too; settling `false` there keeps an awaiting caller from hanging.
  const settle = (value: boolean) => {
    promise?.resolve(value)
    setPromise(null)
  }

  const ConfirmDialog = () => (
    <Dialog open={promise !== null} onOpenChange={open => !open && settle(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="pt-2">
          <Button onClick={() => settle(false)} variant="outline">Cancel</Button>
          <Button onClick={() => settle(true)} variant={confirmVariant}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return [ConfirmDialog, confirm]
}
