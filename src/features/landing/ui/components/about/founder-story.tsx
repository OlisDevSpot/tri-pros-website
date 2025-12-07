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
    <div className="flex flex-col gap-8">
      <div
        className="min-h-[400px] flex flex-col lg:flex-row gap-4 lg:gap-16 w-full rounded-lg overflow-hidden"
      >
        <div className={cn('relative w-full min-h-[200px] h-auto flex items-end justify-center rounded-lg overflow-hidden pb-8 flex-1', !isMobile && flipOrder && 'order-2')}>
          <img
            src={founderImgSrc}
            className="absolute top-0 left-0 right-0 sm:inset-0 grayscale-50 sm:h-full object-cover z-[-1] w-full"
          />
          <h3 className="text-2xl lg:text-3xl font-bold text-foreground whitespace-pre-line text-center">
            {founderName}
          </h3>
        </div>
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
          transition={{ duration: 0.8 }}
          className="space-y-6 flex-1"
        >
          <div className="space-y-4 text-foreground/80 leading-relaxed font-semibold">
            <TextWithLine text="The Founder&apos;s Vision" />
            {children}
          </div>

          {Quote && <Quote />}
        </motion.div>
      </div>
    </div>
  )
}
