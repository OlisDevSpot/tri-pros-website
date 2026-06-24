'use client'

import type { ConfirmationStep, StepProps } from '@/shared/domains/funnels/types'
import { CircleCheck, Phone } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'
import { contactInfo } from '@/shared/constants/company/contact-info'
import { FunnelProjectCarousel } from '@/shared/domains/funnels/ui/blocks/funnel-project-carousel'
import { ConfirmationTimeline } from '@/shared/domains/funnels/ui/steps/confirmation-timeline'
import { mainSiteUrl } from '@/shared/lib/main-site-url'
import { toDialString } from '@/shared/lib/phone'

export function ConfirmationStepView({ content, ctx }: StepProps<ConfirmationStep>) {
  const reduceMotion = useReducedMotion()
  const phone = contactInfo.find(info => info.accessor === 'phone')!.value

  // Per-block entrance: each section fades up in sequence on mount, gated on
  // reduced motion. Climbing delays land the eye top→bottom.
  function entrance(delay: number) {
    if (reduceMotion) {
      return {}
    }
    return {
      initial: { opacity: 0, y: 22 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.5, ease: [0.32, 0.72, 0, 1] as const, delay },
    }
  }

  return (
    <div className="flex flex-col items-center gap-8 py-6 text-center">
      <motion.div className="flex flex-col items-center gap-3" {...entrance(0)}>
        <span className="relative flex size-16 items-center justify-center">
          {/* Looping "alive" pulse ring radiating out from behind the check.
              Opacity self-closes (0 → peak → 0) so the infinite loop has no
              visible reset flash at the boundary. */}
          {reduceMotion
            ? null
            : (
                <motion.span
                  aria-hidden
                  className="bg-success/20 absolute inset-0 rounded-full"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: [0.9, 1.3, 1.7], opacity: [0, 0.5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', times: [0, 0.25, 1], delay: 0.6 }}
                />
              )}
          <motion.span
            className="bg-success/10 text-success relative flex size-16 items-center justify-center rounded-full"
            initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
            animate={reduceMotion ? undefined : { scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 13, delay: 0.15 }}
          >
            <CircleCheck className="size-9" aria-hidden />
          </motion.span>
        </span>
        <h2 className="text-2xl font-semibold">{content.title}</h2>
        {content.subtitle ? <p className="text-muted-foreground max-w-prose">{content.subtitle}</p> : null}
      </motion.div>

      {content.whatNext && content.whatNext.length > 0
        ? (
            <motion.div className="border-border bg-card w-full rounded-2xl border p-6" {...entrance(0.15)}>
              <ConfirmationTimeline steps={content.whatNext} />
            </motion.div>
          )
        : null}

      <motion.div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center" {...entrance(0.28)}>
        <Button asChild size="lg" className="h-14 gap-2 text-base font-semibold shadow-sm sm:flex-1">
          <a href={`tel:${toDialString(phone)}`}>
            <Phone className="size-4" aria-hidden />
            {`Call ${phone}`}
          </a>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-14 text-base sm:w-auto">
          <a href={mainSiteUrl(ROOTS.landing.portfolioProjects())} target="_blank" rel="noopener noreferrer">See our work</a>
        </Button>
      </motion.div>

      {content.scarcityLine
        ? <motion.p className="text-muted-foreground text-sm font-medium" {...entrance(0.36)}>{content.scarcityLine}</motion.p>
        : null}

      <motion.section className="flex w-full flex-col gap-4" {...entrance(0.44)}>
        <h3 className="text-foreground text-lg font-semibold">Recent Tri Pros work</h3>
        <FunnelProjectCarousel slug={ctx.slug} />
      </motion.section>
    </div>
  )
}
