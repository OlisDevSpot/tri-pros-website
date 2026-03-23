'use client'

import { XIcon } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog'

interface Props {
  close: () => void
  isOpen: boolean
  title: React.ReactNode
  description?: React.ReactNode
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
        showCloseButton={false}
        className={cn(
          'sm:max-w-106.25 space-y-2 flex flex-col items-start',
          // Mobile: fullscreen
          'max-w-full h-dvh rounded-none border-0 p-4',
          // Desktop: normal dialog
          'sm:h-auto sm:max-h-[85vh] sm:rounded-lg sm:border sm:p-6',
          className,
        )}
      >
        <div className="flex w-full items-start justify-between gap-4">
          <DialogHeader className="flex-1 min-w-0">
            <DialogTitle>{title}</DialogTitle>
            {description != null && (
              <DialogDescription asChild={typeof description !== 'string'}>
                {typeof description === 'string' ? description : <div>{description}</div>}
              </DialogDescription>
            )}
          </DialogHeader>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 -mt-1 -mr-2"
            onClick={close}
          >
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  )
}
