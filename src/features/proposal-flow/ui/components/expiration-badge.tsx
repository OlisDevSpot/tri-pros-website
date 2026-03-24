import { format } from 'date-fns'
import { ClockIcon } from 'lucide-react'

interface Props {
  expiresAt: Date
}

export function ExpirationBadge({ expiresAt }: Props) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
      <ClockIcon className="h-3 w-3 shrink-0" />
      <span>
        Eligible to be claimed until
        {' '}
        {format(expiresAt, 'MMMM d, yyyy \'at\' h:mm a')}
      </span>
    </div>
  )
}
