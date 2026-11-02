'use client'

import type { ReactNode } from 'react'
import type { CutawayProfile, CutawayScope } from '@/features/meeting-visualizations/types'
import { SlidersHorizontalIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'
import { yearBuiltRanges } from '@/shared/constants/enums/customers'
import { insulationLevels } from '@/shared/modules/construction/core/constants/enums'

const UNKNOWN = 'unknown'

const ROOF_OPTIONS = ['shingle', 'tile', 'woodshake'] as const

interface ProfileControlsProps {
  profile: CutawayProfile
  scope: CutawayScope
  onProfileChange: (profile: CutawayProfile) => void
  onScopeChange: (scope: CutawayScope) => void
}

function fromChoice<T extends string>(value: string, allowed: readonly T[]): T | null {
  return (allowed as readonly string[]).includes(value) ? (value as T) : null
}

/**
 * Prototype only. In a meeting these values come from the customer profile and the trade
 * selections; here they let the team see how each answer changes the drawing.
 */
export function ProfileControls({ profile, scope, onProfileChange, onScopeChange }: ProfileControlsProps) {
  return (
    <Popover>
      <PopoverTrigger className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 text-sm font-semibold text-white/85 backdrop-blur-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-(--presentation-accent)">
        <SlidersHorizontalIcon aria-hidden className="size-4" />
        Home profile
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-80 gap-4">
        <p className="text-xs text-muted-foreground">Prototype controls. A real meeting reads these from the customer profile.</p>

        <Field label="Roof type">
          <ToggleGroup
            type="single"
            variant="segmented"
            size="sm"
            value={profile.roofType ?? UNKNOWN}
            onValueChange={value => value && onProfileChange({ ...profile, roofType: fromChoice(value, ROOF_OPTIONS) })}
          >
            {ROOF_OPTIONS.map(option => <ToggleGroupItem key={option} value={option} className="capitalize">{option === 'woodshake' ? 'Shake' : option}</ToggleGroupItem>)}
            <ToggleGroupItem value={UNKNOWN}>Unknown</ToggleGroupItem>
          </ToggleGroup>
        </Field>

        <Field label="Year built">
          <ToggleGroup
            type="single"
            variant="segmented"
            size="sm"
            className="flex-wrap"
            value={profile.yearBuilt ?? UNKNOWN}
            onValueChange={value => value && onProfileChange({ ...profile, yearBuilt: fromChoice(value, yearBuiltRanges) })}
          >
            {yearBuiltRanges.map(option => <ToggleGroupItem key={option} value={option}>{option}</ToggleGroupItem>)}
            <ToggleGroupItem value={UNKNOWN}>Unknown</ToggleGroupItem>
          </ToggleGroup>
        </Field>

        <Field label="Insulation today">
          <ToggleGroup
            type="single"
            variant="segmented"
            size="sm"
            value={profile.insulationLevel ?? UNKNOWN}
            onValueChange={value => value && onProfileChange({ ...profile, insulationLevel: fromChoice(value, insulationLevels) })}
          >
            {insulationLevels.map(option => <ToggleGroupItem key={option} value={option} className="capitalize">{option}</ToggleGroupItem>)}
            <ToggleGroupItem value={UNKNOWN}>Unknown</ToggleGroupItem>
          </ToggleGroup>
        </Field>

        <Field label="Trades in scope">
          <ToggleGroup
            type="multiple"
            variant="segmented"
            size="sm"
            value={[scope.roof && 'roof', scope.attic && 'attic'].filter((value): value is string => Boolean(value))}
            onValueChange={values => onScopeChange({ roof: values.includes('roof'), attic: values.includes('attic') })}
          >
            <ToggleGroupItem value="roof">Roof</ToggleGroupItem>
            <ToggleGroupItem value="attic">Attic</ToggleGroupItem>
          </ToggleGroup>
        </Field>
      </PopoverContent>
    </Popover>
  )
}

function Field({ label, children }: { label: string, children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      {children}
    </div>
  )
}
