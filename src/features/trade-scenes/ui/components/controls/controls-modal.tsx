'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { ControlsSection } from '@/features/trade-scenes/types'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'

import { CONTROLS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { CONTROLS_EASE, SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'
import { useSceneControls } from '@/features/trade-scenes/contexts/scene-controls-context'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { ControlsScrim } from '@/features/trade-scenes/ui/components/controls/controls-scrim'
import { FOCUSABLE_SELECTOR } from '@/shared/components/dialogs/sheets/constants/focusable'
import { Dialog, DialogPortal, DialogTitle } from '@/shared/components/ui/dialog'
import { isToastTarget } from '@/shared/lib/is-toast-target'
import { cn } from '@/shared/lib/utils'

interface ControlsModalProps {
  // What the group's section buttons point at.
  id: string
  // The open section's head, body and foot.
  children: ReactNode
  // The open section's own Escape, run before the window closes; preventing it keeps the window open.
  onEscapeKeyDown?: (event: KeyboardEvent) => void
}

// One shell for every section but Systems: a switch swaps the body and moves the shell, so the shell never closes and
// reopens between two sections. Non-modal, so the group stays pressable while it is open; it portals into the stage, so
// the scene's keys still count focus inside it as the stage's.
export function ControlsModal({ id, children, onEscapeKeyDown }: ControlsModalProps) {
  const { open, close } = useSceneControls()
  const { shape, stage, stageElement } = useSceneVisibleArea()
  const reduceMotion = useReducedMotion()
  // The last section shown, kept while the window closes, so focus can go back to its button.
  const [section, setSection] = useState<Exclude<ControlsSection, 'systems'>>('facts')
  const shown = open !== null && open !== 'systems'
  if (shown && open !== section) {
    setSection(open)
  }

  const { controls } = SCENE_LAYOUT
  const portrait = shape === 'portrait'
  const top = portrait ? controls.modalTop.portrait : controls.modalTop.wide
  const bottom = portrait ? controls.modalBottom.portrait : controls.modalBottom.wide
  const side = portrait ? controls.modalSide.portrait : controls.modalSide.wide
  const width = Math.min(controls.modalWidth, stage.width - 2 * side)
  const left = (stage.width - width) / 2
  const maxHeight = stage.height - top - bottom
  // Modify hangs from the top, so the field typed in never moves as its results change; Home facts grows up from the
  // group; Benefits keeps one size. A portrait iPad caps every window at the wide width, centred.
  const placement: CSSProperties = section === 'modify'
    ? { top, left, width, maxHeight }
    : section === 'facts'
      ? { bottom, left, width, maxHeight }
      : portrait ? { top, bottom, left, width } : { top, bottom, left: side, right: side }

  return (
    <Dialog open={shown} onOpenChange={close} modal={false}>
      <DialogPortal container={stageElement}>
        <ControlsScrim />
        <DialogPrimitive.Content
          asChild
          id={id}
          aria-describedby={undefined}
          onEscapeKeyDown={onEscapeKeyDown}
          onInteractOutside={(event) => {
            const target = event.target
            // The group and the value menus are part of the window's work; a toast's action must not close it either.
            if (isToastTarget(target) || (target instanceof Element && target.closest('[data-scene-controls], [data-value-menu]'))) {
              event.preventDefault()
            }
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            const content = event.currentTarget as HTMLElement
            const first = [...content.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].find(element => !element.closest('[data-controls-modal-head]'))!
            first.focus()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            // Focus left with the window's content; a press on another control has already taken it there. A switch to
            // Systems closes the window too, and a tap that never focused the Systems button must not send focus back here.
            // This runs after the close has rendered, so the group's buttons, not this render's state, say what is open.
            const switched = stageElement!.querySelector('[data-section-button][aria-expanded="true"]') !== null
            if (document.activeElement === document.body && !switched) {
              stageElement!.querySelector<HTMLElement>(`[data-section-button="${section}"]`)!.focus()
            }
          }}
        >
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: CONTROLS_EASE }}
            // The scroll columns inside bleed by the padding set here.
            style={{ ...placement, '--panel-padding': '16px' } as CSSProperties}
            className={cn('absolute z-20 flex flex-col overflow-hidden border bg-card shadow-2xl outline-none', portrait ? 'rounded-[20px]' : 'rounded-2xl')}
          >
            {section === 'modify' && <DialogTitle className="sr-only">{CONTROLS_COPY.sections.modify}</DialogTitle>}
            <AnimatePresence initial={false}>
              <motion.div
                key={section}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.16, ease: CONTROLS_EASE }}
                className="flex min-h-0 flex-1 flex-col"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
