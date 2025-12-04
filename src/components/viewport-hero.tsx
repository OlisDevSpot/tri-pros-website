import { cn } from '@/lib/utils'

interface ViewportHeroProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
}

export function ViewportHero({
  children,
  className,
  ...props
}: ViewportHeroProps) {
  return (
    <div
      className={cn(
        'h-screen w-full relative flex items-center justify-center overflow-hidden',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
