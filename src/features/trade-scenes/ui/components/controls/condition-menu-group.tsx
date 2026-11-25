'use client'

import type { ReactNode } from 'react'
import type { Wear } from '@/shared/modules/construction/core/constants/enums'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { conditionTitle } from '@/features/trade-scenes/lib/condition-title'

interface ConditionMenuGroupProps {
  // Mixed where one chip covers ground of several wears.
  wear: Wear | 'mixed' | null
  // The wear dots, and whatever rides with them.
  children: ReactNode
}

// A chip menu's Condition: its heading names the wear, and the dots sit under it.
export function ConditionMenuGroup({ wear, children }: ConditionMenuGroupProps) {
  return (
    <>
      <div data-menu-header className={CONTROLS_CLASSES.menuHeader}>
        {conditionTitle(wear)}
      </div>
      <div className={CONTROLS_CLASSES.menuRow}>
        {/* The dots keep their own bottom margin for the card's tray; the menu's row already pads them. A container has no
            width of its own to give the menu, so its floor is the dots' row: a menu of short names still holds all five. */}
        <div className="grid w-full min-w-50 gap-2 @container [&>[data-slot=radio-group]]:mb-0">
          {children}
        </div>
      </div>
    </>
  )
}
