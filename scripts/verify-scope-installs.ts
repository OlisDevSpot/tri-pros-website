/* eslint-disable perfectionist/sort-imports -- load-env must run before any module that reads process.env */
import './lib/load-env'
import process from 'node:process'
import { ASSEMBLIES } from '@/shared/modules/construction/core/constants/assemblies'
import { FASCIA_REPLACEMENT_SCOPE_ID } from '@/shared/modules/construction/core/constants/fascia-replacement'
import { SCOPE_INSTALLS } from '@/shared/modules/construction/core/constants/scope-installs'
import { NOT_DRAWN } from '@/shared/modules/construction/core/constants/scope-not-drawn'
import { catalogSource } from '@/shared/modules/construction/sources'
/* eslint-enable perfectionist/sort-imports */

// Scope ids are Notion ids, so tsc cannot see a renamed, recreated or re-parented scope; this read-only check can.
async function main() {
  const [trades, scopes] = await Promise.all([catalogSource.getTrades(), catalogSource.getScopes()])
  const slugByTradeId = new Map(trades.map(trade => [trade.id, trade.slug]))
  const scopeById = new Map(scopes.map(scope => [scope.id, scope]))
  const errors: string[] = []
  const coveredTrades = new Map<string, Set<string>>()

  for (const [scopeId, entry] of Object.entries(SCOPE_INSTALLS)) {
    if (!entry) {
      continue
    }
    const scope = scopeById.get(scopeId)
    if (!scope) {
      errors.push(`SCOPE_INSTALLS key ${scopeId} is not a live scope (renamed or recreated in Notion?)`)
      continue
    }
    if (NOT_DRAWN[scopeId]) {
      errors.push(`${scope.name} (${scopeId}) is in both SCOPE_INSTALLS and NOT_DRAWN`)
    }
    const assembly = ASSEMBLIES[entry.assembly]
    const slug = slugByTradeId.get(scope.tradeId)
    if (!slug || !(assembly.trades as readonly string[]).includes(slug)) {
      errors.push(`${scope.name} (${scopeId}) belongs to ${slug}, not a trade of ${entry.assembly}`)
      continue
    }
    if (entry.trade !== slug) {
      errors.push(`${scope.name} (${scopeId}) belongs to ${slug}, but SCOPE_INSTALLS says ${entry.trade}`)
    }
    const covered = coveredTrades.get(assembly.id) ?? new Set<string>()
    covered.add(slug)
    coveredTrades.set(assembly.id, covered)

    let fittingForms: readonly string[] = assembly.forms ?? []
    for (const { part, material } of entry.installs) {
      const definition = assembly.parts.find(candidate => candidate.id === part)
      if (!definition) {
        errors.push(`${scope.name}: ${entry.assembly} has no part ${part}`)
        continue
      }
      const materialDefinition = definition.materials[material]
      if (!materialDefinition) {
        errors.push(`${scope.name}: ${part} has no material ${material}`)
        continue
      }
      const materialForms = materialDefinition.forms
      if (materialForms) {
        fittingForms = fittingForms.filter(form => (materialForms as readonly string[]).includes(form))
      }
    }
    if (assembly.forms && fittingForms.length === 0) {
      errors.push(`${scope.name} (${scopeId}) installs materials that no single ${entry.assembly} form can hold together`)
    }
  }

  for (const scopeId of Object.keys(NOT_DRAWN)) {
    if (!scopeById.has(scopeId)) {
      errors.push(`NOT_DRAWN key ${scopeId} is not a live scope (renamed or recreated in Notion?)`)
    }
  }

  // The fascia replacement is accounted for on its own: it installs no part, yet the scene draws it.
  if (!scopeById.has(FASCIA_REPLACEMENT_SCOPE_ID)) {
    errors.push(`FASCIA_REPLACEMENT_SCOPE_ID ${FASCIA_REPLACEMENT_SCOPE_ID} is not a live scope (renamed or recreated in Notion?)`)
  }
  if (SCOPE_INSTALLS[FASCIA_REPLACEMENT_SCOPE_ID] || NOT_DRAWN[FASCIA_REPLACEMENT_SCOPE_ID]) {
    errors.push(`FASCIA_REPLACEMENT_SCOPE_ID ${FASCIA_REPLACEMENT_SCOPE_ID} is also in SCOPE_INSTALLS or NOT_DRAWN`)
  }

  for (const assembly of Object.values(ASSEMBLIES)) {
    const covered = coveredTrades.get(assembly.id)
    for (const slug of assembly.trades) {
      const unmapped = scopes.filter(scope => slugByTradeId.get(scope.tradeId) === slug && !SCOPE_INSTALLS[scope.id] && !NOT_DRAWN[scope.id] && scope.id !== FASCIA_REPLACEMENT_SCOPE_ID)
      for (const scope of unmapped) {
        if (covered?.has(slug)) {
          errors.push(`${scope.name} (${scope.id}) of trade ${slug} is in neither SCOPE_INSTALLS nor NOT_DRAWN`)
        }
        else {
          console.log(`  ${assembly.id} · ${slug} · unmapped: ${scope.id} ${scope.name} (${scope.kind})`)
        }
      }
    }
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`✗ ${error}`)
    }
    process.exit(1)
  }
  console.log(`✓ scope installs (${Object.keys(SCOPE_INSTALLS).length} mapped, ${Object.keys(NOT_DRAWN).length} not drawn, the fascia replacement drawn on its own)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
