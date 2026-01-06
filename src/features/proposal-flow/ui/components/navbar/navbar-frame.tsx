import type { HTMLMotionProps } from 'motion/react'
import { motion } from 'motion/react'
import { cn } from '@/shared/lib/utils'

interface Props extends HTMLMotionProps<'div'> {
  children: React.ReactNode
}

export function ProposalNavbarFrame({ children, className, ...props }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-14 bg-foreground/20 shrink-0"
    >
      <div className="h-full w-full flex justify-between overflow-hidden">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          {...props}
          className={
            cn(
              'flex justify-between items-center w-full',
              className,
            )
          }
        >
          {children}
        </motion.div>
      </div>
    </motion.div>
  )
}
