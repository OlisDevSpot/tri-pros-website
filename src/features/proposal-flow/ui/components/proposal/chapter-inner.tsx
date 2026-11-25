import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

interface Props {
  children: ReactNode
  className?: string
}

export function ChapterInner({ children, className }: Props) {
  return (
    <div className={cn('mx-auto grid max-w-230 grid-cols-[minmax(0,1fr)] gap-7 px-4.5 pt-14 pb-13 @min-[700px]/proposal:gap-9 @min-[700px]/proposal:px-10 @min-[700px]/proposal:pt-20 @min-[700px]/proposal:pb-18', className)}>
      {children}
    </div>
  )
}
