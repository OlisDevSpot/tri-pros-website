import { SearchX } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface Props extends React.ComponentProps<'div'> {
  title: string
  description?: string
  children?: React.ReactNode
}

export function EmptyState({ title, description, children, className, ...props }: Props) {
  return (
    <div className={cn('w-full h-full flex flex-col items-center justify-center border border-dashed rounded-lg', className)} {...props}>
      <div className="flex items-center px-8 py-8 justify-center gap-2 w-full h-full">
        <SearchX className="mr-2 size-5" />
        <div className="flex flex-col">
          <p>{title}</p>
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}
