/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { buildSowDocDefinition } from '@/shared/services/pdf/sow-doc-definition'

const proposal = {
  id: 'test-id',
  label: 'Test Proposal',
  projectJSON: {
    data: {
      sow: [
        {
          title: 'Sod installation',
          trade: { id: 't1', label: 'Dryscaping' },
          scopes: [{ id: 's1', label: 'Install sod' }],
          price: 6600,
          contentJSON: JSON.stringify({
            type: 'doc',
            content: [
              { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Site Preparation' }] },
              { type: 'paragraph', content: [{ type: 'text', text: 'Prepare the site.' }] },
            ],
          }),
          html: '<h2>Site Preparation</h2><p>Prepare the site.</p>',
        },
        {
          title: 'Cabinet refinish',
          trade: { id: 't2', label: 'Kitchen Remodel' },
          scopes: [{ id: 's2', label: 'Cabinet re-finish' }],
          price: 17930,
          contentJSON: JSON.stringify({
            type: 'doc',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'Refinish all cabinets.' }] },
            ],
          }),
          html: '<p>Refinish all cabinets.</p>',
        },
      ],
    },
  },
  customer: { name: 'Test Customer' },
} as unknown as Parameters<typeof buildSowDocDefinition>[0]

const docDef = buildSowDocDefinition(proposal)

assert.ok(docDef.content, 'has content array')
assert.ok(Array.isArray(docDef.content), 'content is array')

const content = docDef.content as unknown as Array<Record<string, unknown>>
assert.equal(content[0].text, 'Scope of Work', 'first block is doc title')
assert.ok(String(content[1].text ?? '').includes('Test Proposal'), 'subtitle mentions proposal label')
assert.ok(String(content[1].text ?? '').includes('Test Customer'), 'subtitle mentions customer')

const itemTitles = content.filter(c => c.style === 'itemTitle')
assert.equal(itemTitles.length, 2, 'two item titles')
assert.equal(itemTitles[0].pageBreak, undefined, 'first item has no pageBreak')
assert.equal(itemTitles[1].pageBreak, 'before', 'second item has pageBreak:before')
assert.ok(String(itemTitles[0].text).includes('Sod installation'), 'first title correct')
assert.ok(String(itemTitles[1].text).includes('Cabinet refinish'), 'second title correct')

assert.ok(docDef.styles, 'styles declared')
const styles = docDef.styles as Record<string, unknown>
assert.ok(styles.itemTitle, 'itemTitle style')
assert.ok(styles.h2, 'h2 style')

console.log('✅ buildSowDocDefinition verified')
