import type { EntityActionButtonProps } from '@/shared/components/entity-actions/types'

import { EyeIcon } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

export function EntityViewButton({
  icon: Icon = EyeIcon,
  label = 'View',
  showLabel = false,
  variant = 'ghost',
  size = 'icon',
  className,
  href,
  external,
  ...props
}: EntityActionButtonProps) {
  const content = (
    <>
      <Icon className="h-3.5 w-3.5" />
      {showLabel ? <span>{label}</span> : <span className="sr-only">{label}</span>}
    </>
  )

  if (href && external) {
    return (
      <Button variant={variant} size={size} className={cn('h-7 w-7', className)} asChild {...props}>
        <a href={href} target="_blank" rel="noopener noreferrer">{content}</a>
      </Button>
    )
  }

  if (href) {
    return (
      <Button variant={variant} size={size} className={cn('h-7 w-7', className)} asChild {...props}>
        <Link href={href}>{content}</Link>
      </Button>
    )
  }

  return (
    <Button variant={variant} size={size} className={cn('h-7 w-7', className)} {...props}>
      {content}
    </Button>
  )
}
