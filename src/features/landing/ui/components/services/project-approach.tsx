'use client'

import { motion, useInView } from 'motion/react'

import { useRef } from 'react'
import { cn } from '@/shared/lib/utils'

interface ProjectApproachProps {
  steps: { title: string, description: string }[]
}

export function ProjectApproach({ steps }: ProjectApproachProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={ref} className="container py-16 lg:py-24">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12"
      >
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
          How We Approach Your Project
        </h2>
      </motion.div>

      <div className={cn(
        'flex flex-col lg:flex-row gap-8 lg:gap-6',
        'items-stretch',
      )}
      >
        {steps.map((step, index) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.5, delay: index * 0.15 }}
            className="flex-1 flex flex-row lg:flex-col items-start gap-4"
          >
            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold shrink-0">
              {index + 1}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
