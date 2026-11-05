'use client'

import { Fragment } from 'react'

import { SHORTCUT_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { KEYCAP_CLASS, SHORTCUT_SHEET_ROWS } from '@/features/trade-scenes/constants/scene-shortcuts'
import { keycapLabel } from '@/features/trade-scenes/lib/keycap-label'
import { Dialog, DialogContent, DialogTitle } from '@/shared/components/ui/dialog'
import { cn } from '@/shared/lib/utils'

interface ShortcutKeysDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Opened by a key or a button, never by its own trigger, so the opener decides where focus goes back to.
  onCloseAutoFocus: (event: Event) => void
}

export function ShortcutKeysDialog({ open, onOpenChange, onCloseAutoFocus }: ShortcutKeysDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Scoped dark like the stage it opens over, since the portal leaves the stage's scope. Its caps are read aloud, not
          hidden like a control's: this is the list everyone gets. */}
      <DialogContent
        aria-describedby={undefined}
        onCloseAutoFocus={onCloseAutoFocus}
        overlayClassName="bg-[oklch(var(--presentation-scrim)/0.55)]"
        className="dark w-105 gap-3 rounded-[12px] border-0 bg-popover px-6 py-5.5 text-foreground shadow-lg outline-none sm:max-w-105"
      >
        <DialogTitle className="text-lg leading-tight">{SHORTCUT_COPY.title}</DialogTitle>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3.5 gap-y-2 text-sm">
          {SHORTCUT_SHEET_ROWS.map(row => (
            <Fragment key={row.line}>
              <dt className="flex gap-1">
                {row.keys.map(key => <kbd key={key} className={cn(KEYCAP_CLASS, 'h-5 min-w-5.5')}>{keycapLabel(key)}</kbd>)}
              </dt>
              <dd>{SHORTCUT_COPY.lines[row.line]}</dd>
            </Fragment>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
