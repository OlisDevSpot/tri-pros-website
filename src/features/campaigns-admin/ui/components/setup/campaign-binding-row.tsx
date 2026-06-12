'use client'

import type { VoipCampaign } from '@/shared/db/schema/voip-campaigns'

import { useState } from 'react'

import { Badge } from '@/shared/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Switch } from '@/shared/components/ui/switch'
import { TableCell, TableRow } from '@/shared/components/ui/table'

interface SourceOption {
  sourceSlug: string
  name: string
}

interface CampaignBindingRowProps {
  campaign: VoipCampaign
  sources: SourceOption[]
  /**
   * Map of sourceSlug → its default campaignId.
   * Used to derive whether this campaign is the default for the selected source.
   */
  defaultBySlug: Map<string, string | null>
  busy: boolean
  onToggleDefault: (sourceSlug: string, campaignId: string, makeDefault: boolean) => void
}

export function CampaignBindingRow({
  campaign,
  sources,
  defaultBySlug,
  busy,
  onToggleDefault,
}: CampaignBindingRowProps) {
  const isActive = campaign.ctStatus === 'active'
  // Local: which source the admin wants to set/clear the default for.
  const [selectedSource, setSelectedSource] = useState<string | null>(null)

  // This campaign is the default for the selected source iff the map says so.
  const isDefault = selectedSource != null && defaultBySlug.get(selectedSource) === campaign.id

  return (
    <TableRow>
      <TableCell className="font-medium text-foreground">{campaign.ctCampaignName}</TableCell>
      <TableCell>
        <Badge variant={isActive ? 'default' : 'secondary'}>
          {isActive ? 'Active' : 'Inactive'}
        </Badge>
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{campaign.ctMembershipTag}</TableCell>
      <TableCell>
        <Select
          value={selectedSource ?? ''}
          disabled={busy}
          onValueChange={value => setSelectedSource(value || null)}
        >
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Pick source…" />
          </SelectTrigger>
          <SelectContent>
            {sources.map(source => (
              <SelectItem key={source.sourceSlug} value={source.sourceSlug}>
                {source.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch
            checked={isDefault}
            disabled={busy || selectedSource == null}
            onCheckedChange={checked =>
              selectedSource && onToggleDefault(selectedSource, campaign.id, checked)}
            aria-label="Set as default campaign for the selected source"
          />
          <span className="text-xs text-muted-foreground">
            {selectedSource == null ? '—' : (isDefault ? 'Default' : 'Set default')}
          </span>
        </div>
      </TableCell>
    </TableRow>
  )
}
