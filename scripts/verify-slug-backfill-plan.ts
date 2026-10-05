import assert from 'node:assert/strict'
import { planSlugBackfill, slugPropertyProblem } from './lib/plan-slug-backfill'

// --- classification: write / same / conflict, disabled rows included ---
const plan = planSlugBackfill([
  { pageId: 'a', title: 'Roof & Gutters', disabled: false, current: '', derived: 'roof-and-gutters' },
  { pageId: 'b', title: 'HVAC', disabled: false, current: 'hvac', derived: 'hvac' },
  { pageId: 'c', title: 'Solar', disabled: true, current: '', derived: 'solar' },
  { pageId: 'd', title: 'Tile', disabled: false, current: 'tiles', derived: 'tile' },
])
assert.deepEqual(plan.rows.map(r => r.action), ['write', 'same', 'write', 'conflict'])
assert.equal(plan.writes, 2, 'blank slugs are written, disabled rows included')
assert.equal(plan.conflicts, 1, 'a stored slug that differs from the derived one is a conflict, never overwritten')
assert.deepEqual(plan.duplicates, [])
assert.deepEqual(plan.unslugifiable, [])

// --- empty and colliding derived slugs are refused, not written ---
const bad = planSlugBackfill([
  { pageId: 'a', title: 'Tile', disabled: false, current: '', derived: 'tile' },
  { pageId: 'b', title: 'Tile ', disabled: true, current: '', derived: 'tile' },
  { pageId: 'c', title: '???', disabled: false, current: '', derived: '' },
])
assert.deepEqual(bad.duplicates, [{ slug: 'tile', titles: ['Tile', 'Tile '] }], 'duplicates are detected across disabled rows too')
assert.deepEqual(bad.unslugifiable, ['???'], 'a title that derives an empty slug is reported by title')
assert.equal(bad.rows.find(r => r.pageId === 'c')?.action, 'write', 'the row is still classified; the caller refuses on unslugifiable')

// --- idempotency: re-planning the applied state is all `same` ---
const applied = plan.rows.filter(r => r.action !== 'conflict').map(r => ({ ...r, current: r.derived }))
assert.ok(planSlugBackfill(applied).rows.every(r => r.action === 'same'), 'after apply, every row is same')

// --- the Slug property must exist and be rich_text ---
assert.equal(slugPropertyProblem(undefined), 'no "Slug" property — create it in the Notion UI as type "Text"')
assert.equal(slugPropertyProblem({ type: 'title' }), '"Slug" is type "title", not rich_text — recreate it as type "Text"')
assert.equal(slugPropertyProblem({ type: 'rich_text' }), null)

console.log('✅ slug backfill plan: write/same/conflict, duplicates, unslugifiable, idempotent, property check')
