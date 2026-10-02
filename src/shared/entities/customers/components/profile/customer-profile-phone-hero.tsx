'use client'

import type { HeroView } from './hero-view-toggle'
import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import type { CustomerProfileData } from '@/shared/entities/customers/types'
import { CustomerAddressHero } from './customer-address-hero'
import { CustomerHeroHeader } from './customer-hero-header'
import { CustomerProfileKeyInsights } from './customer-profile-key-insights'
import { HeroViewToggle } from './hero-view-toggle'

interface Props {
  customer: CustomerProfileData['customer']
  editForm: ReturnType<typeof useCustomerEditForm>
  heroAddress: string | null
  heroView: HeroView
  onHeroViewChange: (view: HeroView) => void
}

// Pinned above the scrolling tab content, so the name and the call/email discs never scroll away.
// It sizes to its content: edit mode grows it and the content area below gives up the room.
export function CustomerProfilePhoneHero({ customer, editForm, heroAddress, heroView, onHeroViewChange }: Props) {
  return (
    <div
      className="dark relative isolate flex min-h-56 shrink-0 flex-col justify-end overflow-hidden px-4 pt-[calc(env(safe-area-inset-top)+3.25rem)] pb-4 text-white"
      data-profile-hero
    >
      <CustomerAddressHero address={heroAddress} key={heroAddress} view={heroView} />
      {heroAddress && (
        // Inline `top`: an arbitrary `top-[max(env(…),…)]` class resolved to top:0 here when
        // measured, so the safe-area offset bypasses the class.
        <div className="absolute right-3 z-10" style={{ top: 'max(env(safe-area-inset-top), 0.75rem)' }}>
          <HeroViewToggle onChange={onHeroViewChange} value={heroView} />
        </div>
      )}
      <div className="relative z-10 flex min-w-0 flex-col gap-3">
        <CustomerHeroHeader customer={customer} editForm={editForm} layout="photo" />
        <CustomerProfileKeyInsights customer={customer} />
      </div>
    </div>
  )
}
