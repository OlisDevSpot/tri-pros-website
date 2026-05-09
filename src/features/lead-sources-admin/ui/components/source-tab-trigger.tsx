'use client'

import type { ComponentPropsWithoutRef } from 'react'

import { TabsTrigger } from '@/shared/components/ui/tabs'
import { cn } from '@/shared/lib/utils'

type SourceTabTriggerProps = ComponentPropsWithoutRef<typeof TabsTrigger>

export function SourceTabTrigger({ className, ...props }: SourceTabTriggerProps) {
  return (
    <TabsTrigger
      {...props}
      className={cn(
        'rounded-none border-b-2 border-transparent bg-transparent px-2 py-3 text-sm font-medium text-muted-foreground shadow-none',
        'data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none',
        className,
      )}
    />
  )
}
