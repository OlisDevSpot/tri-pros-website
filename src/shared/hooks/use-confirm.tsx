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
}

export function useConfirm({ title, message }: UseConfirmProps): [() => JSX.Element, () => Promise<boolean>] {
  const [promise, setPromise] = useState<{ resolve: (value: boolean) => void } | null>(null)

  const confirm = () => {
    return new Promise<boolean>((resolve) => {
      setPromise({ resolve })
    })
  }

  const handleClose = () => {
    setPromise(null)
  }

  const handleConfirm = () => {
    promise?.resolve(true)
    handleClose()
  }

  const handleCancel = () => {
    promise?.resolve(false)
    handleClose()
  }

  const ConfirmDialog = () => (
    <Dialog open={promise !== null} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="pt-2">
          <Button onClick={handleCancel} variant="outline">Cancel</Button>
          <Button onClick={handleConfirm} variant="destructive">Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return [ConfirmDialog, confirm]
}
