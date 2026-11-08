'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'
import type { PaintComboId } from '@/shared/modules/construction/core/constants/cool-life-colors'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { PAINT_COLOR_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { paintComboState } from '@/features/trade-scenes/lib/paint-combo-state'
import { pickPaintColor } from '@/features/trade-scenes/lib/pick-paint-color'
import { ChoicePill } from '@/features/trade-scenes/ui/components/controls/choice-pill'
import { PaintColorList } from '@/features/trade-scenes/ui/components/panel/paint-color-list'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { PAINT_COMBOS } from '@/shared/modules/construction/core/constants/cool-life-colors'

const COMBO_IDS = PAINT_COMBOS.map(combo => combo.id)
// Object.fromEntries widens its keys to string; the list holds every combo.
const COMBO_LABELS = Object.fromEntries(PAINT_COMBOS.map(combo => [combo.id, combo.name])) as Record<PaintComboId, string>

// Body and trim, each a colour of its own. The Build side adds the combos as a shortcut to both; the existing side has none,
// because the rep is matching what is there. Gap working number, settled by shot.
export function PaintColors({ side }: { side: 'existing' | 'proposed' }) {
  const existing = useSceneInputs((state: TradeSceneInputs) => state.homeMaterials.existingPaintColors)
  const proposed = useSceneInputs((state: TradeSceneInputs) => state.homeMaterials.proposedPaintColors)
  const applyChange = useApplySceneChange()

  if (side === 'existing') {
    return (
      <div className="grid w-full gap-4">
        <PaintColorList label={PAINT_COLOR_COPY.body} value={existing.body} onPick={body => applyChange({ kind: 'fact', patch: { existingPaintColors: { ...existing, body } } })} />
        <PaintColorList label={PAINT_COLOR_COPY.trim} value={existing.trim} onPick={trim => applyChange({ kind: 'fact', patch: { existingPaintColors: { ...existing, trim } } })} />
      </div>
    )
  }

  const materials = { existingPaintColors: existing, proposedPaintColors: proposed }
  const { picked, from } = paintComboState(materials)
  const pickCombo = (id: PaintComboId) => {
    const combo = PAINT_COMBOS.find(candidate => candidate.id === id)!
    applyChange({ kind: 'fact', patch: { proposedPaintColors: { body: combo.body, trim: combo.trim, combo: id } } })
  }

  return (
    <div className="grid w-full gap-4">
      <div className="grid gap-2">
        <span className={CONTROLS_CLASSES.capsLabel}>{PAINT_COLOR_COPY.combos}</span>
        <ChoicePill label={PAINT_COLOR_COPY.combos} value={picked} options={COMBO_IDS} labels={COMBO_LABELS} onChange={pickCombo} />
        {from !== null && <p className="text-xs text-muted-foreground">{PAINT_COLOR_COPY.customFrom(COMBO_LABELS[from])}</p>}
      </div>
      <PaintColorList label={PAINT_COLOR_COPY.body} value={proposed.body ?? existing.body} onPick={body => applyChange({ kind: 'fact', patch: { proposedPaintColors: pickPaintColor(materials, 'body', body) } })} />
      <PaintColorList label={PAINT_COLOR_COPY.trim} value={proposed.trim ?? existing.trim} onPick={trim => applyChange({ kind: 'fact', patch: { proposedPaintColors: pickPaintColor(materials, 'trim', trim) } })} />
    </div>
  )
}
