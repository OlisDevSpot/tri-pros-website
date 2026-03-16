import type { LucideIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import type { Button } from '@/shared/components/ui/button'

export interface EntityActionButtonProps extends Omit<ComponentProps<typeof Button>, 'children' | 'asChild'> {
  icon?: LucideIcon
  label?: string
  showLabel?: boolean
  href?: string
  external?: boolean
}
