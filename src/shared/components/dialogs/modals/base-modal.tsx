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
          // Hero mode: when a descendant opts in via [data-modal-hero], strip
          // padding so the body spans edge-to-edge and float the header chrome
          // (a custom visual header renders inside the hero body; the default
          // DialogTitle is kept in DOM for a11y but visually hidden).
          'has-data-modal-hero:p-0 has-data-modal-hero:sm:p-0 has-data-modal-hero:space-y-0',
          // Float the header row over the hero. Extra top/right offset gives
          // it the same visual padding as the modal's body content.
          'has-data-modal-hero:*:data-modal-header-row:absolute',
          'has-data-modal-hero:*:data-modal-header-row:w-auto',
          'has-data-modal-hero:*:data-modal-header-row:right-4',
          'has-data-modal-hero:*:data-modal-header-row:sm:right-5',
          'has-data-modal-hero:*:data-modal-header-row:top-[max(env(safe-area-inset-top),1rem)]',
          'has-data-modal-hero:*:data-modal-header-row:sm:top-5',
          'has-data-modal-hero:*:data-modal-header-row:z-30',
          'has-data-modal-hero:*:data-modal-header-row:m-0',
          'has-data-modal-hero:*:data-modal-header-row:items-center',
          'has-data-modal-hero:*:data-modal-header-row:gap-2',
          // Visually hide the default DialogHeader — a custom hero header is
          // rendered in the body. Preserves Radix a11y via the unmodified DOM.
          'has-data-modal-hero:[&>[data-modal-header-row]_[data-slot="dialog-header"]]:sr-only',
          // Style the close button as a glass chip sized to match the
          // adjacent view toggle (same height, same roundness, same material).
          // h-7 matches the inline height of HeroViewToggle.
          'has-data-modal-hero:**:data-modal-close:h-7',
          'has-data-modal-hero:**:data-modal-close:w-7',
          'has-data-modal-hero:**:data-modal-close:rounded-full',
          'has-data-modal-hero:**:data-modal-close:border',
          'has-data-modal-hero:**:data-modal-close:border-white/15',
          'has-data-modal-hero:**:data-modal-close:bg-black/40',
          'has-data-modal-hero:**:data-modal-close:backdrop-blur-md',
          'has-data-modal-hero:**:data-modal-close:text-white',
          'has-data-modal-hero:**:data-modal-close:hover:bg-black/60',
          'has-data-modal-hero:**:data-modal-close:hover:text-white',
          className,
        )}
      >
        <div data-modal-header-row className="flex w-full items-start justify-between gap-4">
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
              data-modal-close
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
