/* eslint-disable no-console */
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import assert from 'node:assert/strict'
import { pageToPainPoint } from '@/shared/modules/construction/sources/notion/pain-points/adapter'
import { pageToScope } from '@/shared/modules/construction/sources/notion/scopes/adapter'
import { SCOPE_PROPERTIES_MAP } from '@/shared/modules/construction/sources/notion/scopes/properties-map'
import { pageToSowTemplate } from '@/shared/modules/construction/sources/notion/sows/adapter'
import { SOW_TEMPLATE_PROPERTIES_MAP } from '@/shared/modules/construction/sources/notion/sows/properties-map'
import { pageToTrade } from '@/shared/modules/construction/sources/notion/trades/adapter'
import { TRADE_PROPERTIES_MAP } from '@/shared/modules/construction/sources/notion/trades/properties-map'

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
function richText(text: string) {
  return { type: 'rich_text', rich_text: [{ plain_text: text }] }
}
function checkbox(checked: boolean) {
  return { type: 'checkbox', checkbox: checked }
}
function page(properties: Record<string, unknown>, id = SCOPE_ID): PageObjectResponse {
  return { id, cover: null, properties } as unknown as PageObjectResponse
}

// --- scopes ---
const validScope = page({
  [SCOPE_PROPERTIES_MAP.name.label]: title('Cabinet Replacement'),
  [SCOPE_PROPERTIES_MAP.kind.label]: select('Scope'),
  [SCOPE_PROPERTIES_MAP.unitOfPricing.label]: select('unit'),
  [SCOPE_PROPERTIES_MAP.tradeId.label]: relation([TRADE_ID]),
  [SCOPE_PROPERTIES_MAP.sowIds.label]: relation([]),
})
const scope = pageToScope(validScope)
assert.ok(scope, 'a valid scope page adapts to an entity')
assert.equal(scope.name, 'Cabinet Replacement', 'scope name extracted')
assert.equal(scope.kind, 'scope', 'Entry Type \'Scope\' maps to kind \'scope\'')

const addonPage = page({
  [SCOPE_PROPERTIES_MAP.name.label]: title('Soft-Close Hinges'),
  [SCOPE_PROPERTIES_MAP.kind.label]: select('Addon'),
  [SCOPE_PROPERTIES_MAP.unitOfPricing.label]: select('unit'),
  [SCOPE_PROPERTIES_MAP.tradeId.label]: relation([TRADE_ID]),
  [SCOPE_PROPERTIES_MAP.sowIds.label]: relation([]),
})
assert.equal(pageToScope(addonPage)?.kind, 'addon', 'Entry Type \'Addon\' maps to kind \'addon\'')

// B17: a scope with no trade relation used to throw.
const orphanScope = page({
  [SCOPE_PROPERTIES_MAP.name.label]: title('Orphan'),
  [SCOPE_PROPERTIES_MAP.kind.label]: select('Scope'),
  [SCOPE_PROPERTIES_MAP.unitOfPricing.label]: select('unit'),
  [SCOPE_PROPERTIES_MAP.tradeId.label]: relation([]),
  [SCOPE_PROPERTIES_MAP.sowIds.label]: relation([]),
})
assert.equal(pageToScope(orphanScope), null, 'a scope with no trade relation returns null, never throws')

// A missing required property used to throw out of the extractor.
assert.equal(pageToScope(page({})), null, 'a page missing every property returns null')

// --- trades ---
function tradePage(slug: unknown) {
  return page({
    [TRADE_PROPERTIES_MAP.name.label]: title('Roof & Gutters'),
    [TRADE_PROPERTIES_MAP.slug.label]: slug,
    [TRADE_PROPERTIES_MAP.category.label]: select('Energy Efficiency'),
    [TRADE_PROPERTIES_MAP.scopeIds.label]: relation([SCOPE_ID]),
    [TRADE_PROPERTIES_MAP.disabled.label]: checkbox(false),
  }, TRADE_ID)
}
assert.equal(pageToTrade(tradePage(richText('roofing-custom')))?.slug, 'roofing-custom', 'the slug comes from the Slug property, not from the title')
assert.equal(pageToTrade(tradePage(richText(''))), null, 'a blank Slug fails schema: the trade is not in the catalog')
// A human can type anything into the Slug cell; a slug that is not a URL segment must not reach a URL.
assert.equal(pageToTrade(tradePage(richText('Roof Gutters'))), null, 'spaces or capitals in a stored slug fail schema')
const noSlugProperty = page({ [TRADE_PROPERTIES_MAP.name.label]: title('Roof & Gutters') }, TRADE_ID)
assert.equal(pageToTrade(noSlugProperty), null, 'a page without the Slug property returns null, never throws')
const disabledTrade = page({ ...tradePage(richText('roofing-custom')).properties, [TRADE_PROPERTIES_MAP.disabled.label]: checkbox(true) }, TRADE_ID)
assert.equal(pageToTrade(disabledTrade), null, 'the disabled gate still runs before the slug is read')

// --- sows ---
const validSow = page({
  [SOW_TEMPLATE_PROPERTIES_MAP.name.label]: title('Demo & Haul'),
  [SOW_TEMPLATE_PROPERTIES_MAP.scopeIds.label]: relation([SCOPE_ID]),
})
const sow = pageToSowTemplate(validSow)
assert.ok(sow, 'a valid SOW page adapts to an entity')
assert.equal(pageToSowTemplate(page({})), null, 'a malformed SOW page returns null')

// --- pain points ---
assert.equal(pageToPainPoint(page({})), null, 'a malformed pain-point page returns null')

console.log('✅ notion adapters return entity-or-null and never throw; trade slugs are stored')
