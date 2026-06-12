'use client'

import type { VoipCampaign } from '@/shared/entities/voip-campaigns/types'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'

const REMOVE_VALUE = '__remove__'

interface CampaignSelectProps {
  campaigns: VoipCampaign[]
  value: string | undefined
  onChange: (campaignId: string) => void
  /** When provided, renders a "Remove from campaign" item; the `__remove__` sentinel is handled internally. */
  onRemove?: () => void
  /** Hide one campaign from the list (e.g. the contact's current campaign). */
  excludeId?: string | null
  placeholder?: string
  triggerClassName?: string
}

/**
 * Props-driven campaign picker shared across the leads table cell, bulk-enroll,
 * switch-campaign, and enroll-all surfaces. NEVER fetches — the owning view
 * supplies `campaigns` (see frontend-stack.md: components don't call tRPC).
 */
export function CampaignSelect({ campaigns, value, onChange, onRemove, excludeId, placeholder, triggerClassName }: CampaignSelectProps) {
  const options = excludeId ? campaigns.filter(c => c.id !== excludeId) : campaigns

  function handleValueChange(next: string) {
    if (next === REMOVE_VALUE) {
      onRemove?.()
      return
    }
    onChange(next)
  }

  return (
    <Select value={value} onValueChange={handleValueChange}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder ?? 'Select campaign…'} />
      </SelectTrigger>
      <SelectContent>
        {options.map(c => (
          <SelectItem key={c.id} value={c.id}>{c.ctCampaignName}</SelectItem>
        ))}
        {onRemove && (
          <SelectItem value={REMOVE_VALUE}>Remove from campaign</SelectItem>
        )}
      </SelectContent>
    </Select>
  )
}
