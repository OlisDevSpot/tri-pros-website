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
  // "Live" = actively auto-dialing new leads: the master switch on, auto-enroll
  // on, and a default campaign set. This is the tab's one primary-color moment
  // and the at-a-glance answer to "is this source working?". see ui-design-playbook.md
  const isLive = source.enabled && source.autoEnroll && Boolean(source.defaultCampaignId)
  // Auto-enroll is inert without a master switch + a default campaign
  // (enroll() would reject no_dialable_campaign), so gate the control to match.
  const autoEnrollDisabled = busy || !source.enabled || !source.defaultCampaignId

  return (
    <TableRow>
      <TableCell className="max-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-foreground">{source.name}</span>
          {isLive && (
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
              Live
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Select
          value={source.defaultCampaignId ?? NO_DEFAULT}
          disabled={busy}
          onValueChange={value =>
            onPatch(source.sourceSlug, { defaultCampaignId: value === NO_DEFAULT ? null : value })}
        >
          <SelectTrigger aria-label={`Default campaign for ${source.name}`} className="h-9 w-52 text-xs">
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
      <TableCell className="text-center">
        <Switch
          checked={source.enabled}
          disabled={busy}
          onCheckedChange={checked => onPatch(source.sourceSlug, { enabled: checked })}
          aria-label={`Enable VoIP campaigns for ${source.name}`}
        />
      </TableCell>
      <TableCell className="text-center">
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
      <TableCell className="text-right text-sm tabular-nums">
        <span className="text-foreground">{source.eligibleCount}</span>
        <span className="px-1 text-muted-foreground/60">/</span>
        <span className="text-muted-foreground">{source.enrolledCount}</span>
      </TableCell>
    </TableRow>
  )
}
