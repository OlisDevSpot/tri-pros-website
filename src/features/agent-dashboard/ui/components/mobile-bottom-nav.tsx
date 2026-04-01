'use client'

import { MenuIcon, ZapIcon } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { useSidebar } from '@/shared/components/ui/sidebar'

interface MobileBottomNavProps {
  onActionCenterClick?: () => void
}

export function MobileBottomNav({ onActionCenterClick }: MobileBottomNavProps) {
  const { setOpenMobile } = useSidebar()

  return (
    <div className="fixed bottom-[max(env(safe-area-inset-bottom),1rem)] left-4 right-4 z-30 md:hidden">
      <div className="flex items-center gap-2 rounded-2xl border bg-background/80 px-3 py-2 shadow-lg backdrop-blur-md">
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          onClick={() => setOpenMobile(true)}
        >
          <MenuIcon className="size-5" />
          <span className="sr-only">Open menu</span>
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          onClick={onActionCenterClick}
        >
          <ZapIcon className="size-5" />
          <span className="sr-only">Action Center</span>
        </Button>
      </div>
    </div>
  )
}
