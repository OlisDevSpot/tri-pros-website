import type { AssemblyKit } from '@/features/trade-scenes/constants/assembly-kits'
import type { AssemblyTargets, HomeShell, SceneResolveInputs, SceneTargets } from '@/features/trade-scenes/types'
import type { AssemblyId } from '@/shared/modules/construction/core/constants/assembly-ids'
import type { TradeBillCuts } from '@/shared/modules/construction/core/schemas/bill-cuts'
import type { Assembly, ExistingConditions, HomeFacts, ResolvedHomeMaterials, ResolvedPart, WaterFlow } from '@/shared/modules/construction/core/types'

import { ASSEMBLY_KITS } from '@/features/trade-scenes/constants/assembly-kits'
import { CLIMATE_FALLBACK } from '@/features/trade-scenes/constants/climate-bills'
import { INFER_EXISTING_CONDITIONS } from '@/features/trade-scenes/constants/existing-conditions'
import { METER_LEVEL } from '@/features/trade-scenes/constants/home-heat-figures'
import { ASSEMBLY_HEADINGS, ERA_PHRASE } from '@/features/trade-scenes/constants/home-scene-copy'
import { castResidents } from '@/features/trade-scenes/lib/cast-residents'
import { comfortFromReadings } from '@/features/trade-scenes/lib/comfort-from-readings'
import { currentYear } from '@/features/trade-scenes/lib/current-year'
import { homeHeat } from '@/features/trade-scenes/lib/home-heat'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { sceneSavings } from '@/features/trade-scenes/lib/scene-savings'
import { ASSEMBLIES } from '@/shared/modules/construction/core/constants/assemblies'
import { ASSEMBLY_IDS } from '@/shared/modules/construction/core/constants/assembly-ids'
import { CLIMATE_PRESETS } from '@/shared/modules/construction/core/constants/climate-presets'
import { ERA_FALLBACK } from '@/shared/modules/construction/core/constants/era-defaults'
import { relativeWaterFlow } from '@/shared/modules/construction/core/lib/relative-water-flow'
import { resolveAssembly } from '@/shared/modules/construction/core/lib/resolve-assembly'
import { resolveHomeMaterials, wearInForce } from '@/shared/modules/construction/core/lib/resolve-home-materials'

interface ResolvedAssembly {
  assembly: Assembly
  parts: ResolvedPart[]
  existing: ExistingConditions
  targets: AssemblyTargets
  water: WaterFlow | null
}

// Rain gets in only through a worn or failing roof, so a sounder one sheds with the parts it has: its worn parts count as retained.
function partsForRain(parts: ResolvedPart[], id: AssemblyId, home: ResolvedHomeMaterials): ResolvedPart[] {
  const roof = home.roof
  if (id !== 'roof-attic' || !roof) {
    return parts
  }
  const wear = wearInForce(roof)
  if (wear === 'worn' || wear === 'failing') {
    return parts
  }
  return parts.map(part => part.condition === 'worn' ? { ...part, condition: 'retained' } : part)
}

function resolveHomeAssembly(id: Exclude<AssemblyId, 'yard-ground'>, kit: AssemblyKit | undefined, inputs: SceneResolveInputs, facts: HomeFacts, home: ResolvedHomeMaterials): ResolvedAssembly {
  const assembly = ASSEMBLIES[id]
  const { weather } = inputs
  const existing = INFER_EXISTING_CONDITIONS[id](facts, home)
  const parts = resolveAssembly(assembly, { existing, proposedScopeIds: inputs.proposedScopeIds, view: inputs.view, efficiencyUpgrades: inputs.efficiencyUpgrades })

  const modelMode = assembly.modes[weather] ?? null
  const water = modelMode === 'water' ? relativeWaterFlow(weather === 'rain' ? partsForRain(parts, id, home) : parts, weather === 'rain' ? 'rain' : 'irrigation') : null
  const drawn = kit?.weathers.includes(weather) ?? false

  return {
    assembly,
    parts,
    existing,
    water,
    targets: {
      assemblyId: id,
      form: existing.form,
      basis: existing.basis,
      parts,
      mode: drawn ? modelMode : null,
      water: drawn ? water : null,
    },
  }
}

function headingFor(inputs: SceneResolveInputs, resolved: readonly ResolvedAssembly[]): SceneTargets['heading'] {
  // The zoomed assembly speaks first; at home, the first kit with copy does.
  const candidates = [resolved.find(entry => entry.targets.assemblyId === inputs.zoom), ...resolved]
  const headed = candidates.find(entry => entry !== undefined && ASSEMBLY_HEADINGS[entry.targets.assemblyId] !== undefined)
  const copy = headed && ASSEMBLY_HEADINGS[headed.targets.assemblyId]
  if (!headed || !copy) {
    throw new Error('No registered assembly kit has heading copy')
  }
  return {
    eyebrow: copy.eyebrow,
    title: copy.title[headed.targets.basis](ERA_PHRASE[inputs.property.yearBuilt ?? ERA_FALLBACK]),
    lead: copy.lead[inputs.view][inputs.weather],
  }
}

// One call composes the construction model for every surface (home, assembly kit, panel), so a colour, a reading, a ribbon width and a
// dollar figure can never disagree.
export function resolveScene(inputs: SceneResolveInputs, cuts: TradeBillCuts, kits: Partial<Record<AssemblyId, AssemblyKit>> = ASSEMBLY_KITS, year: number = currentYear()): SceneTargets {
  const climate = inputs.climate ?? CLIMATE_FALLBACK
  // The drawing-only facts (AC size, shingle colour, paint wear) never reach the resolver, and no inference reads them.
  const facts: HomeFacts = { property: inputs.property, materials: { ...inputs.homeMaterials, acTons: null, shingleColor: null, paintWear: {} }, year }
  const home = resolveHomeMaterials(facts)
  const resolved = ASSEMBLY_IDS.flatMap((id) => {
    if (id === 'yard-ground' || !(ASSEMBLIES[id].appliesTo?.(inputs.property) ?? true)) {
      return []
    }
    return [resolveHomeAssembly(id, kits[id], inputs, facts, home)]
  })

  const roofAttic = resolved.find(entry => entry.targets.assemblyId === 'roof-attic')
  const shell: HomeShell = {
    parts: resolved.flatMap(entry => entry.parts),
    form: homeRoofForm(roofAttic?.targets.form),
  }
  const heat = inputs.weather === 'rain' ? null : homeHeat(climate, inputs.weather, shell)
  const comfort = inputs.weather === 'rain' || heat === null
    ? null
    : comfortFromReadings(heat.readings, CLIMATE_PRESETS[climate][inputs.weather].setpoint)
  const equipmentLoad = heat?.load ?? 0

  const rain = inputs.weather === 'rain' ? resolved.flatMap(entry => entry.water ? [entry.water] : []) : []
  const leak = {
    reachesInside: Math.max(0, ...rain.map(water => water.reachesInside)),
    // The rain walk also records worn parts it never reached, at zero.
    soakedPartIds: rain.flatMap(water => Object.keys(water.soaked).filter(id => water.soaked[id] > 0)),
  }

  const savings = sceneSavings({ ...inputs, climate, resolved, home }, cuts)
  const { electric } = savings.cuts
  // The meter is electric: a month's draw in this weather, less the share the bill's cut takes off.
  const meterSpeed = inputs.weather === 'rain' ? 0 : METER_LEVEL[inputs.weather] * (1 - electric.combined)

  return {
    assemblies: Object.fromEntries(resolved.map(entry => [entry.targets.assemblyId, entry.targets])),
    heat,
    comfort,
    equipmentLoad,
    meterSpeed,
    leak,
    home,
    residents: castResidents(inputs.household),
    savings,
    heading: headingFor(inputs, resolved.filter(entry => kits[entry.targets.assemblyId])),
  }
}
