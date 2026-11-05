'use client'

import { PencilIcon, XIcon } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useId } from 'react'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { BENEFITS_COPY, CONTROLS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { CONTROLS_SECTION_ICONS } from '@/features/trade-scenes/constants/scene-control-icons'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { useBenefits } from '@/features/trade-scenes/hooks/use-benefits'
import { CostsEditor } from '@/features/trade-scenes/ui/components/benefits/costs-editor'
import { TodayCostsLine } from '@/features/trade-scenes/ui/components/benefits/today-costs-line'
import { Button } from '@/shared/components/ui/button'
import { DialogClose, DialogTitle } from '@/shared/components/ui/dialog'
import { cn } from '@/shared/lib/utils'

// The 36 px buttons reach 42 px past their edge, as the scene's chips do.
const HEAD_BUTTON = 'relative h-9 after:absolute after:-inset-0.75'

// Benefits shows only the build, and its tag says so. Not ControlsModalHead: this head wraps to two rows on the phone, and
// it is left unmarked so the window opens on Edit costs, as it opened on the bills before.
export function BenefitsHead() {
  const { costsOpen, whyOpen, setCostsOpen, setWhyOpen, openers } = useBenefits()
  const { shape } = useSceneVisibleArea()
  const editorId = useId()
  const Icon = CONTROLS_SECTION_ICONS.benefits
  const portrait = shape === 'portrait'

  return (
    <div data-benefits-head className={cn('flex shrink-0 items-center gap-2.5 border-b border-border px-3.5 py-3', portrait ? 'flex-wrap gap-y-2 pb-2.5' : 'min-h-16.75')}>
      <span aria-hidden className={CONTROLS_CLASSES.tile}><Icon /></span>
      <DialogTitle className="whitespace-nowrap">{CONTROLS_COPY.sections.benefits}</DialogTitle>
      <span data-benefits-tag className={cn(CONTROLS_CLASSES.tag, CONTROLS_CLASSES.tagProposed)}>{BENEFITS_COPY.tag}</span>
      {/* Raised over the body, so the editor it anchors paints above what follows the head. */}
      <div data-today-costs className={cn('relative z-10 flex min-w-0 items-center', portrait ? 'order-last basis-full gap-1.5' : 'flex-1 justify-end gap-2.5')}>
        <TodayCostsLine />
        <Button
          ref={openers.costs}
          type="button"
          variant="outline"
          size="sm"
          data-edit-costs
          aria-expanded={costsOpen}
          aria-controls={costsOpen ? editorId : undefined}
          onClick={() => setCostsOpen(!costsOpen)}
          className={cn(HEAD_BUTTON, 'aria-expanded:bg-control-selected aria-expanded:hover:bg-control-selected')}
        >
          <PencilIcon aria-hidden />
          {BENEFITS_COPY.head.editCosts}
        </Button>
        <Button
          ref={openers.why}
          type="button"
          variant="ghost"
          size="icon"
          data-why-button
          aria-label={BENEFITS_COPY.head.why}
          aria-expanded={whyOpen}
          onClick={() => setWhyOpen(!whyOpen)}
          className={cn(HEAD_BUTTON, 'w-9 text-base font-bold aria-expanded:bg-muted')}
        >
          ?
        </Button>
        <AnimatePresence>
          {costsOpen && <CostsEditor key="costs-editor" id={editorId} />}
        </AnimatePresence>
      </div>
      <DialogClose aria-label={CONTROLS_COPY.close} className={CONTROLS_CLASSES.closeButton}>
        <XIcon aria-hidden />
      </DialogClose>
    </div>
  )
}
