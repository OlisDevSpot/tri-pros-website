import { cn } from '@/shared/lib/utils'
import { SpinnerLoader2 } from '../loaders/spinner-loader-2'

interface Props {
  title: string
  description?: string
  className?: string
}

export function LoadingState({ title, description, className }: Props) {
  return (
    <div className={cn(
      'w-full h-full flex items-center justify-center border rounded-lg p-4',
      className,
    )}
    >
      <div className="w-full h-full px-8 py-8 flex items-center justify-center gap-2">
        <SpinnerLoader2 />
        <div className="flex flex-col">
          <p>{title}</p>
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
      </div>
    </div>
  )
}
