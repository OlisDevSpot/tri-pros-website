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
  headerActions?: React.ReactNode
}

export function Modal({
  close,
  isOpen,
  title,
  description,
  children,
  className,
  headerActions,
}: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={close}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'sm:max-w-106.25 space-y-2 flex flex-col items-start',
          // Mobile: fullscreen
          'max-w-full h-full rounded-none border-0 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]',
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
          <div className="flex shrink-0 items-center gap-1 -mt-1 -mr-2">
            {headerActions}
            <Button
              variant="ghost"
              size="icon"
              onClick={close}
            >
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  )
}
