'use client'

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/shared/components/ui/sheet'

interface BaseSheetProps {
  close: () => void
  isOpen: boolean
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}

export function BaseSheet({
  close,
  isOpen,
  title,
  description,
  children,
  className,
  side = 'right',
}: BaseSheetProps) {
  return (
    <Sheet open={isOpen} onOpenChange={close}>
      <SheetContent side={side} className={className}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description != null && (
            <SheetDescription>
              {typeof description === 'string' ? description : <div>{description}</div>}
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
