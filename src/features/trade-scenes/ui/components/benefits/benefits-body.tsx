'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import { BENEFITS_RAIL } from '@/features/trade-scenes/constants/benefits-rail'
import { CONTROLS_EASE } from '@/features/trade-scenes/constants/scene-layout'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { useBenefits } from '@/features/trade-scenes/hooks/use-benefits'
import { useBenefitsFigures } from '@/features/trade-scenes/hooks/use-benefits-figures'
import { BenefitsEmpty } from '@/features/trade-scenes/ui/components/benefits/benefits-empty'
import { BenefitsMatrix } from '@/features/trade-scenes/ui/components/benefits/benefits-matrix'
import { BenefitsRail } from '@/features/trade-scenes/ui/components/benefits/benefits-rail'
import { FutureWhyPanel } from '@/features/trade-scenes/ui/components/benefits/future-why-panel'
import { TwoFuturesBand } from '@/features/trade-scenes/ui/components/benefits/two-futures-band'
import { cn } from '@/shared/lib/utils'

// The band keeps one height, so the matrix area under it never moves; the "?" opens over both. No z-index here: the
// panel must stack above the costs editor, which hangs from the head over this body. Beside the matrix the rail's
// wrapper widens and the matrix gives way to it frame by frame; on the phone the rail is a sheet over the matrix.
export function BenefitsBody() {
  const { whyOpen, selection } = useBenefits()
  const { empty } = useBenefitsFigures()
  const { shape } = useSceneVisibleArea()
  const reduceMotion = useReducedMotion()
  const portrait = shape === 'portrait'

  return (
    <div data-benefits-body className={cn('relative flex min-h-0 flex-1 flex-col', portrait ? 'gap-2 p-2.5' : 'gap-2.5 px-5.5 pt-3.5 pb-3.5')}>
      {/* What the "?" covers takes no focus; the head stays live, as its "?" and Edit costs sit beside the panel. */}
      <TwoFuturesBand inert={whyOpen} />
      <div data-benefits-matrix-area inert={whyOpen} className="relative flex min-h-0 flex-1">
        <BenefitsMatrix portrait={portrait} />
        <AnimatePresence>
          {selection && (portrait
            ? (
                <motion.div
                  key="rail"
                  data-benefits-rail-wrap
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 12 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2, ease: CONTROLS_EASE }}
                  className="absolute inset-0 z-4"
                >
                  <BenefitsRail selection={selection} portrait />
                </motion.div>
              )
            : (
                <motion.div
                  key="rail"
                  data-benefits-rail-wrap
                  initial={reduceMotion ? false : { width: 0, marginLeft: 0 }}
                  animate={{ width: BENEFITS_RAIL.width, marginLeft: BENEFITS_RAIL.gap }}
                  exit={{ width: 0, marginLeft: 0 }}
                  transition={{ duration: reduceMotion ? 0 : BENEFITS_RAIL.seconds, ease: BENEFITS_RAIL.ease }}
                  className="shrink-0 overflow-hidden"
                >
                  <BenefitsRail selection={selection} portrait={false} />
                </motion.div>
              ))}
        </AnimatePresence>
        {empty && <BenefitsEmpty />}
      </div>
      <AnimatePresence>
        {whyOpen && <FutureWhyPanel key="why" portrait={portrait} />}
      </AnimatePresence>
    </div>
  )
}
