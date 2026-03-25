import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { cn } from '@/shared/lib/utils'

interface RepProfileSnapshotProps {
  className?: string
  image: string | null
  name: string
  subtitle?: string
  subtitleClassName?: string
}

export function RepProfileSnapshot({ className, image, name, subtitle, subtitleClassName }: RepProfileSnapshotProps) {
  const initials = name
    .split(' ')
    .map(n => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className={cn('flex items-center gap-2 min-w-0', className)}>
      <Avatar className="size-5 shrink-0">
        <AvatarImage src={image ?? undefined} alt={name} />
        <AvatarFallback className="text-[9px] font-medium">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate leading-tight">{name}</p>
        {subtitle && (
          <p className={cn('text-[11px] text-muted-foreground truncate leading-tight', subtitleClassName)}>{subtitle}</p>
        )}
      </div>
    </div>
  )
}
