'use client'

import { AnimatePresence, motion } from 'motion/react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { TRADE_PAIRINGS } from '@/features/meeting-flow/constants/trade-pairings'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { useTradeSelections } from '@/features/meeting-flow/contexts/trade-selections-context'
import { useTradeStage } from '@/features/meeting-flow/contexts/trade-stage-context'
import { isTradeSelected } from '@/features/meeting-flow/lib/trade-selection'
import { Button } from '@/shared/components/ui/button'
import { COLLAPSE_HEIGHT_VARIANTS, COLLAPSE_TRANSITION } from '@/shared/constants/motion'

interface PairingCardProps {
  slug: string
  selected: boolean
}

/** The playbook pairing for this trade. Appears once the trade is selected; `initial={false}` so it never replays on unrelated updates. */
export function PairingCard({ slug, selected }: PairingCardProps) {
  const selections = useTradeSelections()
  const { catalog } = useTradeCatalogContext()
  const { showTrade } = useTradeStage()
  const pairing = TRADE_PAIRINGS[slug]
  const paired = pairing ? catalog.tradesBySlug.get(pairing.pairedSlug) : undefined
  const visible = selected && pairing && paired ? { pairing, paired } : null
  const pairedSelected = paired ? isTradeSelected(selections, paired.id) : false

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          key="pairing"
          animate={COLLAPSE_HEIGHT_VARIANTS.animate}
          className="overflow-hidden"
          exit={COLLAPSE_HEIGHT_VARIANTS.exit}
          initial={COLLAPSE_HEIGHT_VARIANTS.initial}
          transition={COLLAPSE_TRANSITION}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed bg-muted/40 px-3 py-2.5 text-base">
            <p>
              {pairedSelected
                ? (
                    <>
                      <strong>{visible.paired.name}</strong>
                      {' '}
                      {SPECIALTIES_COPY.sheet.pairedOnProject}
                    </>
                  )
                : (
                    <>
                      {SPECIALTIES_COPY.sheet.pairsWith}
                      {' '}
                      <strong>{visible.paired.name}</strong>
                      :
                      {' '}
                      {visible.pairing.reason}
                      .
                    </>
                  )}
            </p>
            <Button className="h-11" size="sm" variant={pairedSelected ? 'ghost' : 'default'} onClick={() => showTrade(visible.paired.id)}>
              {pairedSelected ? SPECIALTIES_COPY.sheet.open : `${SPECIALTIES_COPY.sheet.open} ${visible.paired.name}`}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
