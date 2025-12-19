import { motion } from 'motion/react'
import React from 'react'
import { TextWithLine } from '@/components/text-with-line'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

interface Props {
  founderName: string
  founderImgSrc: string
  children: React.ReactNode
  flipOrder?: boolean
  isInView: boolean
  Quote?: () => React.ReactNode
}

export function FounderStory({
  founderName,
  flipOrder = false,
  children,
  founderImgSrc,
  isInView,
  Quote,
}: Props) {
  const isMobile = useIsMobile()

  return (
    <div
      className="min-h-[400px] flex flex-col lg:flex-row gap-4 lg:gap-16 w-full rounded-lg overflow-hidden"
    >
      <div className={cn('relative rounded-lg grow min-h-0 h-auto overflow-hidden flex-1', !isMobile && flipOrder && 'order-2')}>
        <img
          src={founderImgSrc}
          className="absolute w-full grayscale-50 z-[-1] object-cover"
        />
        <h3 className="absolute bottom-16 text-2xl lg:text-3xl font-bold text-white whitespace-pre-line text-center w-full bg-primary/40">
          {founderName}
        </h3>
      </div>
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
        transition={{ duration: 0.8 }}
        className="space-y-6 flex-1 shrink-0"
      >
        <div className="space-y-4 text-foreground/80 leading-relaxed font-semibold">
          <TextWithLine text="The Founder&apos;s Vision" />
          {children}
        </div>

        {Quote && <Quote />}
      </motion.div>
    </div>
  )
}
