'use client'

import type { ComponentPropsWithoutRef } from 'react'

import { TabsTrigger } from '@/shared/components/ui/tabs'
import { cn } from '@/shared/lib/utils'

type SourceTabTriggerProps = ComponentPropsWithoutRef<typeof TabsTrigger>

export function SourceTabTrigger({ className, ...props }: SourceTabTriggerProps) {
  // The list scrolls sideways, so a tab can't hang past it onto the divider; the list overlaps the divider instead.
  return <TabsTrigger {...props} className={cn('mb-0', className)} />
}
