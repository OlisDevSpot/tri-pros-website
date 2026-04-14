'use client'

import type { TimelineStepState } from '../lib/derive-timeline-state'
import { Check, Circle, FileCheck, FileSignature, ScrollText } from 'lucide-react'
import { motion } from 'motion/react'
import { cn } from '@/shared/lib/utils'
import { AGREEMENT_STEPS } from '../constants/agreement-timeline'

const STEP_ICONS = {
  'proposal-created': ScrollText,
  'agreement-drafted': FileCheck,
  'contractor-accepted': FileSignature,
  'homeowner-accepted': Check,
} as const

interface AgreementTimelineProps {
  steps: TimelineStepState[]
}

export function AgreementTimeline({ steps }: AgreementTimelineProps) {
  return (
    <div className="flex flex-col gap-0">
      {steps.map((step, i) => {
        const config = AGREEMENT_STEPS[i]
        const Icon = STEP_ICONS[step.key]
        const isLast = i === steps.length - 1

        return (
          <div key={step.key} className="relative flex gap-4">
            {/* Vertical connector line */}
            {!isLast && (
              <div
                className={cn(
                  'absolute left-4.25 top-9 w-0.5',
                  'h-[calc(100%-12px)]',
                  step.state === 'completed' ? 'bg-primary/40' : 'bg-border',
                )}
              />
            )}

            {/* Step indicator */}
            <div className="relative z-10 flex shrink-0 items-start pt-1">
              {step.state === 'completed'
                ? (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.1, duration: 0.3 }}
                      className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm"
                    >
                      <Icon className="size-4" />
                    </motion.div>
                  )
                : step.state === 'active'
                  ? (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: i * 0.1, duration: 0.3 }}
                        className="relative flex size-9 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-primary shadow-sm"
                      >
                        <Icon className="size-4" />
                        <span className="absolute inset-0 animate-ping rounded-full border-2 border-primary/20" />
                      </motion.div>
                    )
                  : (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: i * 0.1, duration: 0.3 }}
                        className="flex size-9 items-center justify-center rounded-full border-2 border-border bg-muted text-muted-foreground"
                      >
                        <Circle className="size-3.5" />
                      </motion.div>
                    )}
            </div>

            {/* Step content */}
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 + 0.05, duration: 0.3 }}
              className={cn(
                'flex flex-col pb-6',
                isLast && 'pb-0',
              )}
            >
              <span
                className={cn(
                  'pt-1.5 text-sm font-semibold leading-tight',
                  step.state === 'completed' && 'text-foreground',
                  step.state === 'active' && 'text-primary',
                  step.state === 'upcoming' && 'text-muted-foreground',
                )}
              >
                {config.label}
              </span>
              <span
                className={cn(
                  'mt-0.5 text-xs leading-relaxed',
                  step.state === 'upcoming' ? 'text-muted-foreground/60' : 'text-muted-foreground',
                )}
              >
                {config.description}
              </span>
            </motion.div>
          </div>
        )
      })}
    </div>
  )
}
