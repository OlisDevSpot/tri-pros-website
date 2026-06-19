'use client'

import type { FaqBlockContent, FunnelContext } from '@/shared/domains/funnels/types'
import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { FUNNEL_TRANSITION } from '@/shared/domains/funnels/constants/funnel-motion'
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
    <section className="flex w-full flex-col gap-4 py-10">
      {content.title ? <h2 className="text-foreground text-center text-2xl font-semibold">{content.title}</h2> : null}
      <div className="flex flex-col gap-2">
        {content.items.map((item, i) => {
          const isOpen = openIndex === i
          const panelId = `faq-panel-${i}`
          return (
            <motion.div
              key={item.q}
              layout={!reduceMotion}
              transition={FUNNEL_TRANSITION}
              className={cn(
                'border-border bg-card overflow-hidden rounded-lg border shadow-sm transition-colors',
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
                  <ChevronDown className="text-muted-foreground size-4" aria-hidden="true" />
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
                        <p className="text-muted-foreground px-4 pb-3 text-sm">{item.a}</p>
                      </motion.div>
                    )
                  : null}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
