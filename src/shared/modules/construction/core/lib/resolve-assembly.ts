import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'
import type { InstallStyleId } from '@/shared/modules/construction/core/constants/install-styles'
import type { Assembly, ExistingConditions, PartCopy, PartDefinition, ResolvedPart, ScopeInstall } from '@/shared/modules/construction/core/types'

import { SCOPE_INSTALLS } from '@/shared/modules/construction/core/constants/scope-installs'
import { installedMaterialId } from '@/shared/modules/construction/core/lib/installed-material'

interface ResolveInput {
  existing: ExistingConditions
  proposedScopeIds: readonly string[]
  view: 'existing' | 'proposed'
  efficiencyUpgrades?: readonly EfficiencyUpgradeId[]
  installStyles?: readonly InstallStyleId[]
}

function copyFor(part: PartDefinition, material: string | null, condition: ResolvedPart['condition']): PartCopy {
  if (material === null) {
    return part.absentCopy ?? { label: `No ${part.id.replaceAll('-', ' ')}`, detail: '' }
  }
  const definition = part.materials[material]
  return definition.conditionCopy?.[condition] ?? definition.copy
}

// Runs on the final installed materials so a later swap of an install cannot dodge it. Mutates `installed` and returns the wording for the parts it overrode.
function installBases(assembly: Assembly, existing: ExistingConditions, installed: Map<string, string>): Map<string, PartCopy> {
  const copies = new Map<string, PartCopy>()
  for (const [partId, materialId] of [...installed]) {
    const needsBase = assembly.parts.find(part => part.id === partId)?.materials[materialId]?.needsBase
    if (!needsBase) {
      continue
    }
    const base = assembly.parts.find(part => part.id === needsBase.part)
    if (!base) {
      throw new Error(`Material "${materialId}" on part "${partId}" needs a base on part "${needsBase.part}", which assembly ${assembly.id} does not have`)
    }
    if (!base.materials[needsBase.with]) {
      throw new Error(`Material "${materialId}" on part "${partId}" needs base "${needsBase.with}" on part "${needsBase.part}", which does not offer it`)
    }
    const current = installed.get(needsBase.part) ?? existing.parts[needsBase.part]?.material ?? null
    if (current !== null && needsBase.replaces.includes(current)) {
      installed.set(needsBase.part, needsBase.with)
      copies.set(needsBase.part, needsBase.copy)
    }
  }
  return copies
}

// A deck the build leaves in place under the new covering says so; a part the build installs is all new wood and never counts.
function woodReplacements(assembly: Assembly, proposedScopeIds: readonly string[], installed: ReadonlyMap<string, string>, installs: Partial<Record<string, ScopeInstall>>): Set<string> {
  const replaced = new Set<string>()
  for (const scopeId of proposedScopeIds) {
    const entry = installs[scopeId]
    if (entry?.assembly !== assembly.id) {
      continue
    }
    for (const partId of entry.replacesWood ?? []) {
      if (!installed.has(partId)) {
        replaced.add(partId)
      }
    }
  }
  return replaced
}

// One resolver for every assembly: parts, forms and copy are data, so a new assembly never adds a branch here.
export function resolveAssembly(assembly: Assembly, { existing, proposedScopeIds, view, efficiencyUpgrades = [], installStyles = [] }: ResolveInput, installs: Partial<Record<string, ScopeInstall>> = SCOPE_INSTALLS): ResolvedPart[] {
  const installed = new Map<string, string>()
  const addedTo = new Set<string>()
  if (view === 'proposed') {
    for (const scopeId of proposedScopeIds) {
      const entry = installs[scopeId]
      if (entry?.assembly !== assembly.id) {
        continue
      }
      for (const install of entry.installs) {
        const { part } = install
        // Swapped here, before the base pass, so a swapped covering still brings the deck it needs.
        const material = installedMaterialId(install, efficiencyUpgrades, installStyles)
        const definition = assembly.parts.find(candidate => candidate.id === part)
        if (!definition) {
          throw new Error(`Scope ${scopeId} installs part "${part}", which assembly ${assembly.id} does not have`)
        }
        const materialDefinition = definition.materials[material]
        if (!materialDefinition) {
          throw new Error(`Scope ${scopeId} installs material "${material}" on part "${part}", which does not offer it`)
        }
        if (materialDefinition.forms && (existing.form === null || !materialDefinition.forms.includes(existing.form))) {
          continue
        }
        installed.set(part, material)
        if (install.addsTo) {
          addedTo.add(part)
        }
        else {
          addedTo.delete(part)
        }
      }
    }
  }

  const baseCopy = installBases(assembly, existing, installed)
  const woodReplaced = view === 'proposed' ? woodReplacements(assembly, proposedScopeIds, installed, installs) : new Set<string>()

  // Skipped on purpose, never thrown: a part the current form lacks (a ridge vent on a flat roof), and a material that cannot be built on the home's form (torch-down on a pitched home with a flat section). The existing part stays as it is.
  return assembly.parts
    .filter(part => !part.forms || (existing.form !== null && part.forms.includes(existing.form)))
    .map((part) => {
      const installedMaterial = installed.get(part.id)
      const material = installedMaterial ?? existing.parts[part.id]?.material ?? null
      const condition = installedMaterial ? 'installed' : existing.parts[part.id]?.condition ?? 'absent'
      const wear = installedMaterial ? undefined : existing.parts[part.id]?.wear
      const definition = material === null ? null : part.materials[material]
      const replacementCopy = woodReplaced.has(part.id) ? definition?.woodReplacementCopy : undefined
      const copy = replacementCopy ?? baseCopy.get(part.id) ?? copyFor(part, material, condition)
      const under = installedMaterial && addedTo.has(part.id) ? existing.parts[part.id]?.material ?? null : null
      return {
        id: part.id,
        group: part.group,
        role: part.role,
        ...(part.edge ? { edge: true as const } : {}),
        ...(replacementCopy ? { woodReplaced: true as const } : {}),
        material,
        condition,
        ...(wear ? { wear } : {}),
        label: copy.label,
        detail: copy.detail,
        thermal: definition?.thermal ?? null,
        water: definition?.water ?? null,
        ...(under !== null ? { over: under } : {}),
      }
    })
}
