/* eslint-disable no-console */
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import assert from 'node:assert/strict'
import { pageToPainPoint } from '@/shared/modules/construction/sources/notion/pain-points/adapter'
import { pageToScope } from '@/shared/modules/construction/sources/notion/scopes/adapter'
import { SCOPE_OR_ADDON_PROPERTIES_MAP } from '@/shared/modules/construction/sources/notion/scopes/properties-map'
import { pageToSOW } from '@/shared/modules/construction/sources/notion/sows/adapter'
import { SOW_PROPERTIES_MAP } from '@/shared/modules/construction/sources/notion/sows/properties-map'

const TRADE_ID = '6240ca1b-548b-837d-a9c0-01acc1fb530a'
const SCOPE_ID = '7351db2c-659c-948e-b0d1-12bdd2ac641b'

function title(text: string) {
  return { type: 'title', title: [{ plain_text: text }] }
}
function select(name: string) {
  return { type: 'select', select: { name } }
}
function relation(ids: string[]) {
  return { type: 'relation', relation: ids.map(id => ({ id })) }
}
function page(properties: Record<string, unknown>, id = SCOPE_ID): PageObjectResponse {
  return { id, cover: null, properties } as unknown as PageObjectResponse
}

// --- scopes ---
const validScope = page({
  [SCOPE_OR_ADDON_PROPERTIES_MAP.name.label]: title('Cabinet Replacement'),
  [SCOPE_OR_ADDON_PROPERTIES_MAP.entryType.label]: select('Scope'),
  [SCOPE_OR_ADDON_PROPERTIES_MAP.unitOfPricing.label]: select('unit'),
  [SCOPE_OR_ADDON_PROPERTIES_MAP.relatedTrade.label]: relation([TRADE_ID]),
  [SCOPE_OR_ADDON_PROPERTIES_MAP.relatedScopesOfWork.label]: relation([]),
})
const scope = pageToScope(validScope)
assert.ok(scope, 'a valid scope page adapts to an entity')
assert.equal(scope.name, 'Cabinet Replacement', 'scope name extracted')

// B17: a scope with no trade relation used to throw.
const orphanScope = page({
  [SCOPE_OR_ADDON_PROPERTIES_MAP.name.label]: title('Orphan'),
  [SCOPE_OR_ADDON_PROPERTIES_MAP.entryType.label]: select('Scope'),
  [SCOPE_OR_ADDON_PROPERTIES_MAP.unitOfPricing.label]: select('unit'),
  [SCOPE_OR_ADDON_PROPERTIES_MAP.relatedTrade.label]: relation([]),
  [SCOPE_OR_ADDON_PROPERTIES_MAP.relatedScopesOfWork.label]: relation([]),
})
assert.equal(pageToScope(orphanScope), null, 'a scope with no trade relation returns null, never throws')

// A missing required property used to throw out of the extractor.
assert.equal(pageToScope(page({})), null, 'a page missing every property returns null')

// --- sows ---
const validSow = page({
  [SOW_PROPERTIES_MAP.name.label]: title('Demo & Haul'),
  [SOW_PROPERTIES_MAP.relatedScope.label]: relation([SCOPE_ID]),
})
const sow = pageToSOW(validSow)
assert.ok(sow, 'a valid SOW page adapts to an entity')
assert.equal(pageToSOW(page({})), null, 'a malformed SOW page returns null')

// --- pain points ---
assert.equal(pageToPainPoint(page({})), null, 'a malformed pain-point page returns null')

console.log('✅ notion adapters return entity-or-null and never throw')
