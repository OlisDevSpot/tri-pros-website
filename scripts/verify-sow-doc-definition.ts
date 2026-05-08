/* eslint-disable no-console */
import type { Content } from 'pdfmake/interfaces'
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

assert.ok(Array.isArray(docDef.content), 'content is an array')
const content: Content[] = docDef.content

function textOf(c: Content): string | undefined {
  if (typeof c === 'object' && c !== null && 'text' in c && typeof c.text === 'string') {
    return c.text
  }
  return undefined
}

function styleOf(c: Content): string | undefined {
  if (typeof c === 'object' && c !== null && 'style' in c && typeof c.style === 'string') {
    return c.style
  }
  return undefined
}

function pageBreakOf(c: Content): string | undefined {
  if (typeof c === 'object' && c !== null && 'pageBreak' in c && typeof c.pageBreak === 'string') {
    return c.pageBreak
  }
  return undefined
}

assert.equal(textOf(content[0]), 'Scope of Work', 'first block is doc title')
const subtitle = textOf(content[1]) ?? ''
assert.ok(subtitle.includes('Test Proposal'), 'subtitle mentions proposal label')
assert.ok(subtitle.includes('Test Customer'), 'subtitle mentions customer')

const itemTitles = content.filter(c => styleOf(c) === 'itemTitle')
assert.equal(itemTitles.length, 2, 'two item titles')
assert.equal(pageBreakOf(itemTitles[0]), undefined, 'first item has no pageBreak')
assert.equal(pageBreakOf(itemTitles[1]), 'before', 'second item has pageBreak:before')
assert.ok((textOf(itemTitles[0]) ?? '').includes('Sod installation'), 'first title correct')
assert.ok((textOf(itemTitles[1]) ?? '').includes('Cabinet refinish'), 'second title correct')

assert.ok(docDef.styles, 'styles declared')
assert.ok(docDef.styles?.itemTitle, 'itemTitle style')
assert.ok(docDef.styles?.h2, 'h2 style')

console.log('✅ buildSowDocDefinition verified')
