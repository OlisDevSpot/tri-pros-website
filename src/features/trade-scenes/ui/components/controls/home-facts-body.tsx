'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { useId } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { HOME_PROFILE_CHOICES } from '@/features/trade-scenes/constants/home-profile-choices'
import { CONTROLS_COPY, PROFILE_COPY, ROOF_FORM_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { missingFacts } from '@/features/trade-scenes/lib/missing-facts'
import { fromChoice, toChoice } from '@/features/trade-scenes/lib/profile-choice'
import { ChoicePill } from '@/features/trade-scenes/ui/components/controls/choice-pill'
import { FactRow } from '@/features/trade-scenes/ui/components/controls/fact-row'
import { HomeFactsTabs } from '@/features/trade-scenes/ui/components/controls/home-facts-tabs'
import { SoonTiles } from '@/features/trade-scenes/ui/components/controls/soon-tiles'
import { ScaleField } from '@/features/trade-scenes/ui/components/fields/scale-field'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { TabsContent } from '@/shared/components/ui/tabs'
import { customerAgeGroups } from '@/shared/constants/enums/customers'
import { CLIMATE_LABELS, CLIMATES } from '@/shared/modules/construction/core/constants/climate-presets'
import { ROOF_FORMS } from '@/shared/modules/construction/core/constants/roof-forms'
import { roofFormOf } from '@/shared/modules/construction/core/lib/roof-form-of'

// Not sure records null, so a fact left at it stays missing. A home always has a roof form and sits coastal or inland,
// so those two offer no Not sure and an unset one simply has nothing pressed; Age group keeps its scale, as the card's.
export function HomeFactsBody() {
  const { shape } = useSceneVisibleArea()
  const property = useSceneInputs((state: TradeSceneInputs) => state.property)
  const household = useSceneInputs((state: TradeSceneInputs) => state.household)
  const climate = useSceneInputs((state: TradeSceneInputs) => state.climate)
  const missing = useSceneInputs(useShallow((state: TradeSceneInputs) => missingFacts(state)))
  const applyChange = useApplySceneChange()
  const ageLabelId = useId()
  const { foundationType, householdType, ageGroup } = HOME_PROFILE_CHOICES
  const roofForm = roofFormOf(property.roofType)
  const panel = 'min-h-50 pt-1'

  return (
    <div className={CONTROLS_CLASSES.body}>
      {shape !== 'landscape' && <HomeFactsTabs />}
      <TabsContent value="main" className={panel}>
        <FactRow id="foundation" label={PROFILE_COPY.foundationType} missing={missing.includes('foundation')} value={foundationType.labels[toChoice(property.foundationType)]}>
          <ChoicePill
            label={PROFILE_COPY.foundationType}
            value={toChoice(property.foundationType)}
            {...foundationType}
            onChange={choice => applyChange({ kind: 'property', patch: { foundationType: fromChoice(choice) } })}
          />
        </FactRow>
        <FactRow id="roof-form" label={CONTROLS_COPY.facts.roofForm} missing={missing.includes('roof-form')} value={roofForm && ROOF_FORM_LABELS[roofForm]}>
          <ChoicePill
            label={CONTROLS_COPY.facts.roofForm}
            value={roofForm}
            options={ROOF_FORMS}
            labels={ROOF_FORM_LABELS}
            onChange={form => applyChange({ kind: 'roof-form', form })}
          />
        </FactRow>
      </TabsContent>
      <TabsContent value="household" className={panel}>
        <FactRow id="household" label={PROFILE_COPY.householdType} missing={missing.includes('household')} value={householdType.labels[toChoice(household.type)]}>
          <ChoicePill
            label={PROFILE_COPY.householdType}
            value={toChoice(household.type)}
            {...householdType}
            onChange={choice => applyChange({ kind: 'household', patch: { type: fromChoice(choice) } })}
          />
        </FactRow>
        <FactRow id="age-group" label={PROFILE_COPY.ageGroup} labelId={ageLabelId} missing={missing.includes('age-group')} value={ageGroup.labels[toChoice(household.ageGroup)]}>
          <ScaleField
            labelledBy={ageLabelId}
            label={PROFILE_COPY.ageGroup}
            value={toChoice(household.ageGroup)}
            options={customerAgeGroups}
            labels={ageGroup.labels}
            onChange={choice => applyChange({ kind: 'household', patch: { ageGroup: fromChoice(choice) } })}
          />
        </FactRow>
      </TabsContent>
      <TabsContent value="area" className={panel}>
        <FactRow id="climate" label={CONTROLS_COPY.facts.climate} missing={missing.includes('climate')} value={climate && CLIMATE_LABELS[climate]}>
          <ChoicePill
            label={CONTROLS_COPY.facts.climate}
            value={climate}
            options={CLIMATES}
            labels={CLIMATE_LABELS}
            onChange={next => applyChange({ kind: 'climate', climate: next })}
          />
        </FactRow>
        <SoonTiles tiles={CONTROLS_COPY.facts.soonTiles.area} />
      </TabsContent>
      <TabsContent value="lot" className={panel}>
        <SoonTiles tiles={CONTROLS_COPY.facts.soonTiles.lot} />
      </TabsContent>
    </div>
  )
}
