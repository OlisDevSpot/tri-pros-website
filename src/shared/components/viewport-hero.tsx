'use client'

import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/lib/utils'

interface ViewportHeroProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
}

export function ViewportHero({
  children,
  className,
  ...props
}: ViewportHeroProps) {
  const isMobile = useIsMobile()

  return (
    <div
      className={cn(
        'min-h-screen h-auto lg:h-screen w-full relative flex items-center justify-center overflow-hidden p-6',
        isMobile && 'p-0',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
