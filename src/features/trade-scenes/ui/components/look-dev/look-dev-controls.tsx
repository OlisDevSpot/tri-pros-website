'use client'

import type { LookDevOptions } from '@/features/trade-scenes/types'

import { HEAT_STATE_LABELS, HEAT_STATES, LOOK_DEV_RENDERERS, LOOK_DEV_SEASONS, LOOK_DEV_VIEW_LABELS, LOOK_DEV_VIEWS, MATERIAL_TREATMENT_LABELS, MATERIAL_TREATMENTS, RENDERER_LABELS, RIBBON_STYLE_LABELS, SEASON_LABELS, THERMAL_STYLE_LABELS } from '@/features/trade-scenes/constants/look-dev-options'
import { OptionGroup } from '@/features/trade-scenes/ui/components/look-dev/option-group'
import { RIBBON_STYLES } from '@/shared/components/scene/constants/ribbon-styles'
import { THERMAL_STYLES } from '@/shared/components/scene/constants/thermal-palettes'

interface LookDevControlsProps {
  options: LookDevOptions
  onChange: (patch: Partial<LookDevOptions>) => void
}

export function LookDevControls({ options, onChange }: LookDevControlsProps) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-4">
      <OptionGroup label="Model" value={options.treatment} options={MATERIAL_TREATMENTS} labels={MATERIAL_TREATMENT_LABELS} onChange={treatment => onChange({ treatment })} />
      <OptionGroup label="View" value={options.view} options={LOOK_DEV_VIEWS} labels={LOOK_DEV_VIEW_LABELS} onChange={view => onChange({ view })} />
      <OptionGroup label="Heat" value={options.heat ? 'on' : 'off'} options={HEAT_STATES} labels={HEAT_STATE_LABELS} onChange={heat => onChange({ heat: heat === 'on' })} />
      <OptionGroup label="Season" value={options.season} options={LOOK_DEV_SEASONS} labels={SEASON_LABELS} onChange={season => onChange({ season })} />
      <OptionGroup label="Thermal paint" value={options.thermalStyle} options={THERMAL_STYLES} labels={THERMAL_STYLE_LABELS} onChange={thermalStyle => onChange({ thermalStyle })} />
      <OptionGroup label="Heat flow" value={options.ribbonStyle} options={RIBBON_STYLES} labels={RIBBON_STYLE_LABELS} onChange={ribbonStyle => onChange({ ribbonStyle })} />
      <OptionGroup label="Renderer" value={options.renderer} options={LOOK_DEV_RENDERERS} labels={RENDERER_LABELS} onChange={renderer => onChange({ renderer })} />
    </div>
  )
}
