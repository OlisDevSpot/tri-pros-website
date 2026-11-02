import type { SceneChangeSlot, SceneChangeSlotId, SceneTargets, TradeSceneInputs } from '@/features/trade-scenes/types'
import type { CustomerAgeGroup, HouseholdType, YearBuiltRange } from '@/shared/constants/enums/customers'
import type { Climate } from '@/shared/modules/construction/core/constants/climate-presets'
import type { AcTons, CrawlInsulation, DuctMaterial, ExteriorPaint, FoundationType, GutterOption, HVACComponent, HVACType, InsulationLevel, RoofType, Wear, WindowsType } from '@/shared/modules/construction/core/constants/enums'
import type { HomeMaterialId } from '@/shared/modules/construction/core/constants/home-material-ids'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { ScopeId } from '@/shared/modules/construction/core/constants/scope-ids'
import type { HomeFacts, ResolvedHomeMaterial } from '@/shared/modules/construction/core/types'

import { AC_TON_LABELS, AGE_GROUP_LABELS, CONTROLS_COPY, CRAWL_INSULATION_LABELS, DUCT_LABELS, EFFICIENCY_UPGRADE_LABELS, EXTERIOR_PAINT_LABELS, FOUNDATION_TYPE_LABELS, GUTTER_LABELS, HOME_MATERIAL_LABELS, HOME_MATERIALS_COPY, HOUSEHOLD_TYPE_LABELS, HVAC_COMPONENT_LABELS, HVAC_TYPE_LABELS, INSULATION_LEVEL_LABELS, PANEL_COPY, PART_LABELS, PROFILE_COPY, ROOF_FORM_LABELS, ROOF_TYPE_LABELS, SAVINGS_COPY, SCOPES_AND_ADDONS_COPY, WEAR_LABELS, WINDOWS_TYPE_LABELS, YEAR_BUILT_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { SAVINGS_CATEGORIES } from '@/features/trade-scenes/constants/savings-categories'
import { SCENE_CHANGE_WORDS } from '@/features/trade-scenes/constants/scene-change-words'
import { NO_CHANGE_CHOICE } from '@/features/trade-scenes/constants/scene-controls'
import { SCOPE_VERBS } from '@/features/trade-scenes/constants/scope-verbs'
import { existingDuctChoices, hasAcUnit, roofTypeChoices, showsEquipment } from '@/features/trade-scenes/lib/material-option-choices'
import { upgradeRowState } from '@/features/trade-scenes/lib/upgrade-row-state'
import { upgradeRows } from '@/features/trade-scenes/lib/upgrade-rows'
import { customerAgeGroups, householdTypes, yearBuiltRanges } from '@/shared/constants/enums/customers'
import { CLIMATE_LABELS, CLIMATES } from '@/shared/modules/construction/core/constants/climate-presets'
import { acTonnages, crawlInsulations, exteriorPaints, foundationTypes, gutterOptions, hvacComponents, hvacTypes, insulationLevels, wears, windowsTypes } from '@/shared/modules/construction/core/constants/enums'
import { HOME_MATERIAL_IDS } from '@/shared/modules/construction/core/constants/home-material-ids'
import { ROOF_FORMS } from '@/shared/modules/construction/core/constants/roof-forms'
import { roofFormOf } from '@/shared/modules/construction/core/lib/roof-form-of'

type SlotFields = Pick<SceneChangeSlot, 'id' | 'group' | 'name' | 'options' | 'current' | 'change'> & Partial<Pick<SceneChangeSlot, 'isFact' | 'offersNotSure' | 'bill' | 'unavailable'>>

function slot(fields: SlotFields): SceneChangeSlot {
  return { words: SCENE_CHANGE_WORDS[fields.id], isFact: false, offersNotSure: false, bill: null, unavailable: null, ...fields }
}

function optionsOf<T extends string>(values: readonly T[], labels: Record<T, string>): { value: T, label: string }[] {
  return values.map(value => ({ value, label: labels[value] }))
}

function existingSlot(id: SceneChangeSlotId, name: string, options: SceneChangeSlot['options'], current: string | null, change: SceneChangeSlot['change']): SceneChangeSlot {
  return slot({ id, group: 'existing', name, options, current, change })
}

// A material's own slot, then the facts that ride with it, then its Condition; an absent material has no Condition to set.
function materialSlots(id: HomeMaterialId, material: ResolvedHomeMaterial, state: TradeSceneInputs): SceneChangeSlot[] {
  const { property, homeMaterials } = state
  const name = id === 'roof' ? CONTROLS_COPY.modify.roofName : HOME_MATERIAL_LABELS[id]
  const own: SceneChangeSlot[] = []
  switch (id) {
    case 'roof':
      own.push(
        existingSlot(id, name, optionsOf(roofTypeChoices(roofFormOf(property.roofType)), ROOF_TYPE_LABELS), property.roofType, value => ({ kind: 'property', patch: { roofType: value as RoofType } })),
        existingSlot('gutters', HOME_MATERIALS_COPY.gutters, optionsOf(gutterOptions, GUTTER_LABELS), homeMaterials.gutters, value => ({ kind: 'fact', patch: { gutters: value as GutterOption } })),
      )
      break
    case 'attic-insulation':
      own.push(existingSlot(id, name, optionsOf(insulationLevels, INSULATION_LEVEL_LABELS), material.option, value => ({ kind: 'option', field: 'insulationLevel', value: value as InsulationLevel })))
      break
    case 'windows':
      own.push(existingSlot(id, name, optionsOf(windowsTypes, WINDOWS_TYPE_LABELS), material.option, value => ({ kind: 'option', field: 'windowsType', value: value as WindowsType })))
      break
    case 'exterior-paint':
      own.push(existingSlot(id, name, optionsOf(exteriorPaints, EXTERIOR_PAINT_LABELS), material.option, value => ({ kind: 'option', field: 'exteriorPaint', value: value as ExteriorPaint })))
      break
    case 'heating-cooling':
      own.push(existingSlot(id, name, optionsOf(hvacTypes, HVAC_TYPE_LABELS), property.hvacType, value => ({ kind: 'property', patch: { hvacType: value as HVACType } })))
      if (showsEquipment(property)) {
        own.push(existingSlot('hvac-components', PROFILE_COPY.hvacComponents, optionsOf(hvacComponents, HVAC_COMPONENT_LABELS), property.hvacComponents, value => ({ kind: 'property', patch: { hvacComponents: value as HVACComponent } })))
      }
      if (hasAcUnit(property)) {
        own.push(existingSlot('ac-tons', HOME_MATERIALS_COPY.acSize, optionsOf(acTonnages, AC_TON_LABELS), homeMaterials.acTons, value => ({ kind: 'fact', patch: { acTons: value as AcTons } })))
      }
      break
    case 'ducts':
      own.push(existingSlot(id, name, optionsOf(existingDuctChoices(), DUCT_LABELS), material.option, value => ({ kind: 'option', field: 'ducts', value: value as DuctMaterial })))
      break
    case 'crawl-insulation':
      own.push(existingSlot(id, name, optionsOf(crawlInsulations, CRAWL_INSULATION_LABELS), material.option, value => ({ kind: 'option', field: 'crawlInsulation', value: value as CrawlInsulation })))
      break
  }
  if (material.absent) {
    return own
  }
  return [...own, existingSlot(`wear:${id}`, CONTROLS_COPY.modify.wearName(name), optionsOf(wears, WEAR_LABELS), material.wear, value => ({ kind: 'wear', id, wear: value as Wear }))]
}

// Every change Modify can make, in the order it lists them. The system card reads the same slots, so an option list is
// worked out once. Paint wear has no slot: it is set in the system card only.
export function sceneChangeSlots(state: TradeSceneInputs, targets: SceneTargets, year: number): SceneChangeSlot[] {
  const { property, household } = state
  const facts: HomeFacts = { property, materials: state.homeMaterials, year }
  const rows = upgradeRows(facts, state.proposedScopeIds, state.efficiencyUpgrades).flatMap(system => system.rows)
  const everyState = rows.map(row => ({ row, ...upgradeRowState(row, state.proposedScopeIds, state.efficiencyUpgrades) }))
  const states = everyState.filter(entry => entry.row.blocked === null)
  // A row the home cannot take yet still holds its upgrade, so the upgrade is listed with why.
  const coolRoof = everyState.find(entry => entry.holdsCoolRoof)
  const r8Taken = states.find(entry => entry.holdsR8 && entry.picked !== null)
  const r8 = r8Taken ?? everyState.find(entry => entry.holdsR8)
  const toggleOptions = optionsOf(['on', 'off'] as const, CONTROLS_COPY.modify.upgradeChoices)
  // An upgrade a row holds stays listed while no pick can take it yet, and says why in place of its options.
  const upgradeSlot = (upgrade: 'cool-roof' | 'r8-ducts', taken: boolean, on: boolean) => slot({
    id: `upgrade:${upgrade}`,
    group: 'proposed',
    name: EFFICIENCY_UPGRADE_LABELS[upgrade],
    options: taken ? toggleOptions : [],
    current: taken ? (on ? 'on' : 'off') : null,
    unavailable: taken ? null : PANEL_COPY.efficiencyUpgradeHints[upgrade],
    change: value => ({ kind: 'efficiency-upgrade', upgrade, on: value === 'on' }),
  })

  return [
    slot({ id: 'household', group: 'facts', name: PROFILE_COPY.householdType, options: optionsOf(householdTypes, HOUSEHOLD_TYPE_LABELS), current: household.type, isFact: true, offersNotSure: true, change: value => ({ kind: 'household', patch: { type: value as HouseholdType } }) }),
    slot({ id: 'age-group', group: 'facts', name: PROFILE_COPY.ageGroup, options: optionsOf(customerAgeGroups, AGE_GROUP_LABELS), current: household.ageGroup, isFact: true, offersNotSure: true, change: value => ({ kind: 'household', patch: { ageGroup: value as CustomerAgeGroup } }) }),
    slot({ id: 'foundation', group: 'facts', name: PROFILE_COPY.foundationType, options: optionsOf(foundationTypes, FOUNDATION_TYPE_LABELS), current: property.foundationType, isFact: true, offersNotSure: true, change: value => ({ kind: 'property', patch: { foundationType: value as FoundationType } }) }),
    slot({ id: 'roof-form', group: 'facts', name: CONTROLS_COPY.facts.roofForm, options: optionsOf(ROOF_FORMS, ROOF_FORM_LABELS), current: roofFormOf(property.roofType), isFact: true, change: value => ({ kind: 'roof-form', form: value as RoofForm }) }),
    slot({ id: 'year-built', group: 'systems', name: CONTROLS_COPY.systems.yearBuilt, options: optionsOf(yearBuiltRanges, YEAR_BUILT_LABELS), current: property.yearBuilt, change: value => ({ kind: 'property', patch: { yearBuilt: value as YearBuiltRange } }) }),
    ...HOME_MATERIAL_IDS.flatMap((id) => {
      const material = targets.home[id]
      return material ? materialSlots(id, material, state) : []
    }),
    ...states.map(({ row, picked }) => slot({
      id: `build:${row.part}`,
      group: 'proposed',
      name: PART_LABELS[row.offer.partId],
      options: [{ value: NO_CHANGE_CHOICE, label: SCOPES_AND_ADDONS_COPY.noChange }, ...row.scopeIds.map(scopeId => ({ value: scopeId, label: SCOPES_AND_ADDONS_COPY.verbs[SCOPE_VERBS[scopeId]] }))],
      current: picked ?? NO_CHANGE_CHOICE,
      change: value => ({ kind: 'scope', offer: row.offer, scopeId: value === NO_CHANGE_CHOICE ? null : value as ScopeId }),
    })),
    ...coolRoof ? [upgradeSlot('cool-roof', coolRoof.coolRoofOffered, coolRoof.coolRoofOn)] : [],
    ...r8 ? [upgradeSlot('r8-ducts', r8 === r8Taken, r8.r8On)] : [],
    slot({ id: 'climate', group: 'area', name: CONTROLS_COPY.facts.climate, options: optionsOf(CLIMATES, CLIMATE_LABELS), current: state.climate, isFact: true, change: value => ({ kind: 'climate', climate: value as Climate }) }),
    // A cleared field goes back to the climate's default bill.
    ...SAVINGS_CATEGORIES.map(category => slot({ id: `bill:${category}`, group: 'bills', name: SAVINGS_COPY.billLabel(category), options: [], current: String(targets.savings.cuts[category].bill), bill: category, change: value => ({ kind: 'bill', category, now: value === '' ? null : Number(value) }) })),
  ]
}
