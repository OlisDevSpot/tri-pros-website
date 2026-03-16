import type { EntityActionButtonProps } from '@/shared/components/entity-actions/types'

import { UserIcon } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

export function EntityProfileButton({
  icon: Icon = UserIcon,
  label = 'Profile',
  showLabel = true,
  variant = 'ghost',
  size = 'sm',
  className,
  href: _href,
  external: _external,
  ...props
}: EntityActionButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      className={cn('h-6 px-2 text-[11px]', className)}
      {...props}
    >
      <Icon className="mr-1 h-3 w-3" />
      {showLabel ? <span>{label}</span> : <span className="sr-only">{label}</span>}
    </Button>
  )
}
