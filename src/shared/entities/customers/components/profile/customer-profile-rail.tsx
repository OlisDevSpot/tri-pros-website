'use client'

import type { HeroView } from './hero-view-toggle'
import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import type { CustomerProfileData, CustomerProfileMeeting } from '@/shared/entities/customers/types'
import type { ProfileCommands } from '@/shared/entities/customers/types/profile-modal'
import { getInitials } from '@/shared/entities/users/lib/get-initials'
import { CustomerAddressHero } from './customer-address-hero'
import { CustomerHeroActions } from './customer-hero-actions'
import { CustomerHeroHeader } from './customer-hero-header'
import { CustomerProfileKeyInsights } from './customer-profile-key-insights'
import { HeroViewToggle } from './hero-view-toggle'

interface Props {
  commands: ProfileCommands
  customer: CustomerProfileData['customer']
  editForm: ReturnType<typeof useCustomerEditForm>
  heroAddress: string | null
  heroView: HeroView
  meetings: CustomerProfileMeeting[]
  onClose: () => void
  onHeroViewChange: (view: HeroView) => void
}

// Who the customer is, top to bottom, ending in what to do next. The identity block scrolls on a
// short screen; the command stack stays pinned at the foot.
export function CustomerProfileRail({ commands, customer, editForm, heroAddress, heroView, meetings, onClose, onHeroViewChange }: Props) {
  return (
    <aside className="flex min-h-0 w-95 shrink-0 flex-col border-r border-border bg-card" data-profile-rail>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="dark relative isolate h-47.5 overflow-hidden" data-profile-map>
          <CustomerAddressHero address={heroAddress} key={heroAddress} view={heroView} />
          {heroAddress && (
            <div className="absolute top-3 right-3 z-10">
              <HeroViewToggle onChange={onHeroViewChange} value={heroView} />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 px-6 pb-5">
          <div aria-hidden className="relative z-10 -mt-8.5 grid size-17 place-items-center rounded-2xl bg-primary text-xl font-semibold text-primary-foreground shadow-lg ring-4 ring-card">
            {getInitials(customer.name) || '—'}
          </div>
          <CustomerHeroHeader customer={customer} editForm={editForm} layout="rail" />
          <CustomerProfileKeyInsights customer={customer} />
        </div>
      </div>
      <CustomerHeroActions commands={commands} meetings={meetings} onClose={onClose} />
    </aside>
  )
}
