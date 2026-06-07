'use client'

import type { VoipCampaign } from '@/shared/db/schema/voip-campaigns'

import { Badge } from '@/shared/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Switch } from '@/shared/components/ui/switch'
import { TableCell, TableRow } from '@/shared/components/ui/table'

// Sentinel for the "unbound" option — shadcn SelectItem cannot use an empty
// string value, so we map this token to `null` at the boundary.
const UNBOUND_VALUE = '__unbound__'

interface SourceOption {
  sourceSlug: string
  name: string
}

interface CampaignBindingRowProps {
  campaign: VoipCampaign
  sources: SourceOption[]
  /** Is this campaign currently the default for its bound source? */
  isDefault: boolean
  busy: boolean
  onBind: (campaignId: string, sourceSlug: string | null) => void
  onToggleDefault: (sourceSlug: string, campaignId: string, makeDefault: boolean) => void
}

export function CampaignBindingRow({
  campaign,
  sources,
  isDefault,
  busy,
  onBind,
  onToggleDefault,
}: CampaignBindingRowProps) {
  const isActive = campaign.ctStatus === 'active'
  const boundSlug = campaign.sourceSlug

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
          value={boundSlug ?? UNBOUND_VALUE}
          disabled={busy}
          onValueChange={value => onBind(campaign.id, value === UNBOUND_VALUE ? null : value)}
        >
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Unbound" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNBOUND_VALUE}>Unbound</SelectItem>
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
            disabled={busy || !boundSlug}
            onCheckedChange={checked => boundSlug && onToggleDefault(boundSlug, campaign.id, checked)}
            aria-label="Set as default campaign for this source"
          />
          <span className="text-xs text-muted-foreground">
            {boundSlug ? (isDefault ? 'Default' : 'Set default') : '—'}
          </span>
        </div>
      </TableCell>
    </TableRow>
  )
}
