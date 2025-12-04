import { cn } from '@/lib/utils'

interface HeroContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
}

export function HeroContainer({
  children,
  className,
  ...props
}: HeroContainerProps) {
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
