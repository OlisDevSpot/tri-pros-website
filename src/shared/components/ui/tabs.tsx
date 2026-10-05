'use client'

import type { VariantProps } from 'class-variance-authority'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cva } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/shared/lib/utils'

const tabsListVariants = cva('text-muted-foreground inline-flex items-center', {
  variants: {
    variant: {
      default: 'bg-muted h-9 w-fit justify-center rounded-lg p-0.75',
      underline: 'h-auto w-full justify-start gap-1 border-b border-border',
      // A bottom tab bar's tab group. Layout comes from the caller (a grid that also holds plain
      // buttons beside the tabs), so this only clears the default pill track.
      bar: 'h-auto items-stretch bg-transparent p-0',
    },
  },
  defaultVariants: { variant: 'default' },
})

const tabsTriggerVariants = cva(
  'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring inline-flex items-center justify-center gap-1.5 text-sm font-medium whitespace-nowrap transition-[color,background-color,box-shadow,border-color] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4',
  {
    variants: {
      variant: {
        default: 'data-[state=active]:bg-popover dark:data-[state=active]:text-foreground dark:data-[state=active]:border-border text-foreground dark:text-muted-foreground h-[calc(100%-1px)] flex-1 rounded-md border border-transparent px-2 py-1 data-[state=active]:shadow-sm data-[state=inactive]:pressed:bg-press',
        underline: '-mb-px min-h-10 rounded-none border-b-2 border-transparent px-3 text-muted-foreground hover:text-foreground pressed:text-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground',
        bar: 'h-14 min-w-0 flex-col gap-1 rounded-xl px-0 text-xs font-semibold text-muted-foreground hover:text-foreground data-[state=active]:bg-muted data-[state=inactive]:pressed:bg-press data-[state=active]:text-primary motion-reduce:transition-none',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

type TabsVariant = VariantProps<typeof tabsListVariants>['variant']

const TabsVariantContext = React.createContext<TabsVariant>('default')

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsVariantContext value={variant}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        data-variant={variant ?? 'default'}
        className={cn(tabsListVariants({ variant }), className)}
        {...props}
      />
    </TabsVariantContext>
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const variant = React.use(TabsVariantContext)
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(tabsTriggerVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsContent, TabsList, TabsTrigger, tabsTriggerVariants }
