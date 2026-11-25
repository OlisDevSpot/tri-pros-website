import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { baseDefaultValues } from '@/features/proposal-flow/schemas/form-schema'
import { dirtyParts, firstErrorPart, partOfFieldPath, summarizeParts } from './form-parts'

function buildValues(sectionCount: number): ProposalFormSchema {
  const [template] = baseDefaultValues.project.data.sow
  const sow = Array.from({ length: sectionCount }, () => structuredClone(template))
  if (sow[0]) {
    sow[0] = {
      ...sow[0],
      financials: {
        ...sow[0].financials,
        incentives: [{ id: '7f9c1c1e-6a53-4b6e-9a43-2f6b9a0f2a11', label: 'Seasonal', amount: 200 }],
      },
    }
  }
  return {
    ...baseDefaultValues,
    project: {
      ...baseDefaultValues.project,
      data: { ...baseDefaultValues.project.data, type: 'general-remodeling', timeAllocated: '4-6 weeks', sow },
    },
    funding: {
      ...baseDefaultValues.funding,
      startingTcp: 50000,
      incentives: [{ type: 'discount', amount: 1000 }],
    },
  }
}

describe('partOfFieldPath', () => {
  it('maps SOW paths to sow', () => {
    assert.equal(partOfFieldPath('project.data.sow.2.financials.incentives.0.amount'), 'sow')
  })
  it('maps funding paths and priceDisplayMode to funding', () => {
    assert.equal(partOfFieldPath('funding.depositAmount'), 'funding')
    assert.equal(partOfFieldPath('priceDisplayMode'), 'funding')
  })
  it('maps general paths', () => {
    assert.equal(partOfFieldPath('project.data.timeAllocated'), 'general')
  })
  it('returns null for unowned fields and partial-segment matches', () => {
    assert.equal(partOfFieldPath('project.data.label'), null)
    assert.equal(partOfFieldPath('fundingX'), null)
  })
})

describe('dirtyParts', () => {
  it('collects parts that own a true leaf and ignores unowned or false leaves', () => {
    const dirty = { project: { data: { label: true, sow: [undefined, { title: true }] } }, funding: { depositAmount: false } }
    assert.deepEqual(dirtyParts(dirty), new Set(['sow']))
  })
  it('is empty for nothing dirty', () => {
    assert.deepEqual(dirtyParts({}), new Set())
  })
})

describe('firstErrorPart', () => {
  it('returns the earliest part in order that has an error', () => {
    const errors = {
      funding: { depositAmount: { type: 'custom', message: 'x' } },
      project: { data: { sow: [{ financials: { sectionPrice: { type: 'custom', message: 'y' } } }] } },
    }
    assert.equal(firstErrorPart(errors), 'sow')
  })
  it('treats a field named type as a field, not as an error object', () => {
    assert.equal(firstErrorPart({ project: { data: { type: { type: 'custom', message: 'x' } } } }), 'general')
  })
  it('returns null with no errors', () => {
    assert.equal(firstErrorPart({}), null)
  })
})

describe('summarizeParts', () => {
  it('summarizes each part', () => {
    const s = summarizeParts(buildValues(2), 3)
    assert.deepEqual(s.general, { rail: '4-6 weeks', list: 'General Remodeling · 4-6 weeks' })
    assert.equal(s.sow.rail, '2 sections')
    assert.equal(s.funding.rail, '$48,800')
    assert.equal(s.files.rail, '3 files')
    for (const id of ['sow', 'funding', 'files'] as const) {
      assert.equal(s[id].list, s[id].rail)
    }
  })
  it('handles singular, zero and unknown counts', () => {
    assert.equal(summarizeParts(buildValues(1), 1).sow.rail, '1 section')
    assert.equal(summarizeParts(buildValues(1), 1).files.rail, '1 file')
    assert.equal(summarizeParts(buildValues(0), 0).sow.rail, '0 sections')
    assert.equal(summarizeParts(buildValues(1), undefined).files.rail, '')
  })
})
