import type { EntityActionButtonProps } from '@/shared/components/entity-actions/types'

import { CopyIcon } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

export function EntityDuplicateButton({
  icon: Icon = CopyIcon,
  label = 'Duplicate',
  showLabel = false,
  variant = 'ghost',
  size = 'icon',
  className,
  href: _href,
  external: _external,
  ...props
}: EntityActionButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      className={cn('h-7 w-7', className)}
      {...props}
    >
      <Icon className="h-3.5 w-3.5" />
      {showLabel ? <span>{label}</span> : <span className="sr-only">{label}</span>}
    </Button>
  )
}
