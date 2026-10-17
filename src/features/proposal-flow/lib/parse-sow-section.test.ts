import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'

import { parseSowSection } from './parse-sow-section'

// A roof-replacement part as getFullView returns it.
const ROOF = { type: 'doc', content: [{ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Description: ' }, { type: 'text', marks: [{ type: 'italic' }], text: 'Replace waterproofing & asphalt shingles with synthetic underlayment & Cool Roof Shingles' }] }, { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Site Preparation' }] }, { type: 'horizontalRule' }, { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Provide dumpster to jobsite' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Protect HVAC condensers and fragile items as needed nylon ' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Prepare jobsite to collect roof debris in an organized fashion' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pull city permit (see agreement notes)' }] }] }] }, { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Phase I: Demo' }] }, { type: 'horizontalRule' }, { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Demo existing roofing system in all work areas (see agreement notes)' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Clean wood deck from all nails and debris and prepare for new roof installation' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Demo existing roof underlayment to decking' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Inspect the wood decking for structural soundness and replace wood to match as necessary.' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Replace wood substrate (up to amount budgeted in agreement notes) of damaged plywood' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Clean all debris & haul away' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pass tear off inspection with local city inspector' }] }] }] }, { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Phase II: Install new roofing material' }] }, { type: 'horizontalRule' }, { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Prep work area, HVAC condensers as needed, cover with nylon and tarps as needed' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Install new synthetic underlayment (UDL30 or equivalent) and fasten down with 1" plastic cap nails per code' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Install new powder coated 2x2/2x3 drip edge metal flashings along perimeter (Eaves/gutters and Rakes)' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Install starter shingles around the perimeter per manufacturer standards' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Install ice & water shield (weather-lock) on all penetrations and valleys as needed' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Install, seal and paint all metal flashings, pipes vents to match' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Install new low profile attic vents to match ' }, { type: 'text', marks: [{ type: 'bold' }], text: '[optional]' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Install new Owens Corning Cool Shingles or GAF (35 yr Warranty) (Color to be selected by customer)' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Install decorative hip / ridge caps' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'LOL' }] }] }] }, { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Agreement Notes' }] }, { type: 'horizontalRule' }, { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Areas included: ' }, { type: 'text', marks: [{ type: 'bold' }], text: 'entire main house + garage' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Existing roof system: ' }, { type: 'text', marks: [{ type: 'bold' }], text: 'asphalt shingles' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'New roof system: ' }, { type: 'text', marks: [{ type: 'bold' }], text: 'Cool Roof shingles' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Permit fee: city fees are ' }, { type: 'text', marks: [{ type: 'bold' }], text: 'not included' }, { type: 'text', text: ' in the contract price unless otherwise specified in writing. Homeowner to reimburse contractor for permit pulling costs and related expenses' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Wood replacement: up to ' }, { type: 'text', marks: [{ type: 'bold' }], text: '15%' }, { type: 'text', text: ' wood replacement at no additional charges. Any additional dry-rot repair beyond this scope to be charged at $135/man-hour + material' }] }] }, { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '1 BSQ = 100 square feet' }] }] }] }, { type: 'paragraph' }] }

function withDescriptionAsParagraph(json: string): string {
  const doc = JSON.parse(json)
  const [heading, ...rest] = doc.content
  return JSON.stringify({ ...doc, content: [{ type: 'paragraph', content: heading.content }, ...rest] })
}

describe('parseSowSection', () => {
  it('reads a description written as a heading', () => {
    const parsed = parseSowSection(JSON.stringify(ROOF))
    assert.ok(parsed)
    assert.match(parsed.description ?? '', /^Replace /)
  })

  it('reads a description written as a paragraph', () => {
    const parsed = parseSowSection(withDescriptionAsParagraph(JSON.stringify(ROOF)))
    assert.ok(parsed)
    assert.match(parsed.description ?? '', /^Replace /)
  })

  it('keeps every phase with steps and none without', () => {
    const parsed = parseSowSection(JSON.stringify(ROOF))
    assert.ok(parsed)
    assert.deepEqual(parsed.phases.map(phase => phase.title), ['Site Preparation', 'Phase I: Demo', 'Phase II: Install new roofing material'])
    assert.ok(parsed.phases.every(phase => phase.steps.length > 0))
  })

  it('drops a phase heading with no steps', () => {
    const doc = JSON.parse(JSON.stringify(ROOF))
    doc.content.splice(1, 0, { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Empty phase' }] })
    const parsed = parseSowSection(JSON.stringify(doc))
    assert.ok(parsed)
    assert.ok(!parsed.phases.some(phase => phase.title === 'Empty phase'))
    assert.ok(parsed.phases.every(phase => phase.steps.length > 0))
  })

  it('sorts agreement notes into details, exclusions and notes', () => {
    const parsed = parseSowSection(JSON.stringify(ROOF))
    assert.ok(parsed)
    assert.ok(parsed.specs.length > 0)
    assert.ok(parsed.specs.some(([label]) => /areas included/i.test(label)))
  })

  it('returns null for a node the card cannot lay out, so the HTML shows', () => {
    const doc = JSON.parse(JSON.stringify(ROOF))
    doc.content.push({ type: 'codeBlock', content: [{ type: 'text', text: 'unlaid-out text' }] })
    assert.equal(parseSowSection(JSON.stringify(doc)), null)
  })

  it('returns null for content that is not a document', () => {
    assert.equal(parseSowSection('not json'), null)
    assert.equal(parseSowSection('{"type":"paragraph"}'), null)
  })
})
