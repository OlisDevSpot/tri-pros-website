'use client'

import type { FaqBlockContent, FunnelContext } from '@/shared/domains/funnels/types'
import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { Decor } from '@/shared/components/decor/decor'
import { FUNNEL_TRANSITION } from '@/shared/domains/funnels/constants/funnel-motion'
import { Block } from '@/shared/domains/funnels/ui/block/block'
import { cn } from '@/shared/lib/utils'

/**
 * Single-open accordion. motion/react drives it: the open answer animates its
 * height + opacity (enter/exit via AnimatePresence) and every item carries
 * `layout`, so the surrounding questions glide to their new positions instead
 * of snapping. Reduced-motion collapses all of it to instant show/hide.
 */
export function FaqBlock({ content }: { content: FaqBlockContent, ctx: FunnelContext }) {
  const reduceMotion = useReducedMotion()
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <Block surface="plain" align="center">
      {/* Block.Decor self-clips the corner decor (the Root is a no-overflow frame) */}
      <Block.Decor><Decor shape="square" /></Block.Decor>
      {/* z-1 lifts content above the corner Decor (z-0) within the Root's isolate */}
      <Block.Content className="relative z-1">
        {content.title ? <Block.Headline>{content.title}</Block.Headline> : null}
        <div className="flex w-full flex-col gap-2">
          {content.items.map((item, i) => {
            const isOpen = openIndex === i
            const panelId = `faq-panel-${i}`
            return (
              <motion.div
                key={item.q}
                layout={!reduceMotion}
                transition={FUNNEL_TRANSITION}
                className={cn(
                  'border-border bg-card overflow-hidden rounded-md border shadow-sm transition-colors',
                  isOpen && 'border-foreground/20',
                )}
              >
                <motion.button
                  layout={!reduceMotion}
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className="text-foreground flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-3 text-left font-medium"
                >
                  {item.q}
                  <motion.span
                    animate={reduceMotion ? undefined : { rotate: isOpen ? 180 : 0 }}
                    transition={FUNNEL_TRANSITION}
                    className="shrink-0"
                  >
                    <ChevronDown className="size-4" style={{ color: 'var(--primary)' }} aria-hidden="true" />
                  </motion.span>
                </motion.button>
                <AnimatePresence initial={false}>
                  {isOpen
                    ? (
                        <motion.div
                          key={panelId}
                          id={panelId}
                          initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                          transition={FUNNEL_TRANSITION}
                          className="overflow-hidden"
                        >
                          <p className="px-4 pb-3 text-left text-sm" style={{ color: 'var(--body-text)' }}>{item.a}</p>
                        </motion.div>
                      )
                    : null}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      </Block.Content>
    </Block>
  )
}
