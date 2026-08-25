'use client'

import type { HTMLMotionProps } from 'motion/react'

import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'
import { AnimatePresence, motion } from 'motion/react'

import { COLLAPSE_HEIGHT_VARIANTS, COLLAPSE_TRANSITION } from '@/shared/constants/motion'
import { cn } from '@/shared/lib/utils'

function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      {...props}
    />
  )
}

function CollapsibleContent({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      {...props}
    />
  )
}

interface AnimatedCollapsibleContentProps extends HTMLMotionProps<'div'> {
  /**
   * Controlled open state — pass the SAME value given to the parent <Collapsible>.
   * Radix keeps the trigger/a11y wiring; this component owns the height reveal
   * (which Radix's own CollapsibleContent leaves un-animated).
   */
  open: boolean
}

/**
 * Animated drop-in for <CollapsibleContent>. Renders inside a Radix <Collapsible>
 * (alongside <CollapsibleTrigger>) and smoothly reveals its height instead of
 * snapping. Extra props (className, event handlers) forward to the motion.div.
 *
 * The canonical collapse across the app — reach for this rather than hand-rolling
 * AnimatePresence + motion.div, so timing/easing stay consistent (see
 * `src/shared/constants/motion.ts`).
 */
function AnimatedCollapsibleContent({
  open,
  className,
  children,
  ...props
}: AnimatedCollapsibleContentProps) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="animated-collapsible-content"
          initial={COLLAPSE_HEIGHT_VARIANTS.initial}
          animate={COLLAPSE_HEIGHT_VARIANTS.animate}
          exit={COLLAPSE_HEIGHT_VARIANTS.exit}
          transition={COLLAPSE_TRANSITION}
          className={cn('overflow-hidden', className)}
          {...props}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export {
  AnimatedCollapsibleContent,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
}
