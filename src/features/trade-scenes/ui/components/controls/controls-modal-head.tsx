'use client'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { XIcon } from 'lucide-react'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { CONTROLS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { DialogClose, DialogTitle } from '@/shared/components/ui/dialog'

interface ControlsModalHeadProps {
  icon: LucideIcon
  title: string
  // What sits beside the title: a tag, or Home facts' tabs.
  children?: ReactNode
}

// Marked so the window's opening focus skips it for the body's first control.
export function ControlsModalHead({ icon: Icon, title, children }: ControlsModalHeadProps) {
  return (
    <div data-controls-modal-head className="flex min-h-16.75 shrink-0 items-center gap-2.5 border-b border-border px-3.5 py-3">
      <span aria-hidden className={CONTROLS_CLASSES.tile}><Icon /></span>
      <DialogTitle className="whitespace-nowrap">{title}</DialogTitle>
      {children}
      <DialogClose aria-label={CONTROLS_COPY.close} className={CONTROLS_CLASSES.closeButton}>
        <XIcon aria-hidden />
      </DialogClose>
    </div>
  )
}
