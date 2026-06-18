'use client'

import type { VoipCampaign } from '@/shared/db/schema/voip-campaigns'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Switch } from '@/shared/components/ui/switch'
import { TableCell, TableRow } from '@/shared/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'

// shadcn Select forbids an empty-string item value; use a sentinel for "no default".
const NO_DEFAULT = '__none__'

interface SourcePolicySummary {
  sourceSlug: string
  name: string
  defaultCampaignId: string | null
  enabled: boolean
  autoEnroll: boolean
  eligibleCount: number
  enrolledCount: number
}

interface SourcePolicyPatch {
  enabled?: boolean
  autoEnroll?: boolean
  defaultCampaignId?: string | null
}

interface SourcePolicyRowProps {
  source: SourcePolicySummary
  campaigns: VoipCampaign[]
  busy: boolean
  onPatch: (sourceSlug: string, patch: SourcePolicyPatch) => void
}

export function SourcePolicyRow({ source, campaigns, busy, onPatch }: SourcePolicyRowProps) {
  // Auto-enroll is inert without a master switch + a default campaign
  // (enroll() would reject no_dialable_campaign), so gate the control to match.
  const autoEnrollDisabled = busy || !source.enabled || !source.defaultCampaignId

  return (
    <TableRow>
      <TableCell className="font-medium text-foreground">{source.name}</TableCell>
      <TableCell>
        <Select
          value={source.defaultCampaignId ?? NO_DEFAULT}
          disabled={busy}
          onValueChange={value =>
            onPatch(source.sourceSlug, { defaultCampaignId: value === NO_DEFAULT ? null : value })}
        >
          <SelectTrigger className="h-8 w-52 text-xs">
            <SelectValue placeholder="— none —" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_DEFAULT}>— none —</SelectItem>
            {campaigns.map(campaign => (
              <SelectItem key={campaign.id} value={campaign.id}>
                {campaign.ctCampaignName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Switch
          checked={source.enabled}
          disabled={busy}
          onCheckedChange={checked => onPatch(source.sourceSlug, { enabled: checked })}
          aria-label={`Enable VoIP campaigns for ${source.name}`}
        />
      </TableCell>
      <TableCell>
        {autoEnrollDisabled && !busy
          ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Switch
                      checked={source.autoEnroll}
                      disabled
                      aria-label={`Auto-enroll new leads for ${source.name}`}
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Set a default campaign and enable the source first.</TooltipContent>
              </Tooltip>
            )
          : (
              <Switch
                checked={source.autoEnroll}
                disabled={autoEnrollDisabled}
                onCheckedChange={checked => onPatch(source.sourceSlug, { autoEnroll: checked })}
                aria-label={`Auto-enroll new leads for ${source.name}`}
              />
            )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground tabular-nums">
        {source.eligibleCount}
        {' / '}
        {source.enrolledCount}
      </TableCell>
    </TableRow>
  )
}
