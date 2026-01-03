'use client'

import { cn } from '@/shared/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog'

interface Props {
  close: () => void
  isOpen: boolean
  title: string
  description: string
  children: React.ReactNode
  className?: string
}

export function Modal({
  close,
  isOpen,
  title,
  description,
  children,
  className,
}: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={close}>
      <DialogContent
        className={cn('sm:max-w-[425px] space-y-2 flex flex-col items-start', className)}
        onInteractOutside={(event) => {
          // Prevent closing when clicking Google Places dropdown
          if (
            event.target instanceof HTMLElement
            && event.target.closest('.pac-container')
          ) {
            event.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
