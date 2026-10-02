'use client'

import type { CustomerProfileTab } from '@/shared/entities/customers/types/profile-modal'
import { TabsTrigger } from '@/shared/components/ui/tabs'
import { PROFILE_TAB_ICONS, PROFILE_TAB_LABELS } from '@/shared/entities/customers/constants/profile-modal'

interface Props {
  className?: string
  count?: number
  value: CustomerProfileTab
}

export function CustomerProfileTabBarTrigger({ className, count, value }: Props) {
  const Icon = PROFILE_TAB_ICONS[value]
  const label = PROFILE_TAB_LABELS[value]
  return (
    <TabsTrigger aria-label={count ? `${label} (${count})` : label} className={className} value={value}>
      <span className="relative">
        <Icon className="size-5" />
        {count
          ? (
              <span className="absolute -top-1.5 -right-2.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-xs leading-none font-semibold text-primary-foreground">
                {count}
              </span>
            )
          : null}
      </span>
      <span className="truncate">{label}</span>
    </TabsTrigger>
  )
}
