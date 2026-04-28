/* eslint-disable no-console */
/**
 * Pure-function verification of the document evaluator. No I/O, no DB,
 * no Zoho. Builds fixture ProposalContexts covering every interesting
 * scenario × senior × SOW-length combo, runs evaluateDocuments + the
 * validator, and asserts the partition matches the design plan's
 * locked-in scenario rules.
 *
 * Until this codebase has a test framework, this script IS the test.
 * Run: pnpm tsx scripts/verify-evaluate-documents.ts
 */
import type { EnvelopeDocumentId } from '@/shared/constants/enums'
import type { ProposalContext } from '@/shared/services/zoho-sign/documents/types'
import {
  EnvelopeSelectionError,
  evaluateDocuments,
  validateEnvelopeSelection,
} from '@/shared/services/zoho-sign/documents/evaluate'

interface FixtureInput {
  scenario: 'initial' | 'upsell'
  isSenior: boolean
  isLongSow: boolean
}

function makeContext({ scenario, isSenior, isLongSow }: FixtureInput): ProposalContext {
  // Only the four derived fields below matter for the evaluator's
  // predicates today. The proposal/customer fields aren't read, so we
  // cast a minimal stub through unknown to keep the fixture small.
  return {
    proposal: {} as ProposalContext['proposal'],
    scenario,
    isSenior,
    isLongSow,
    finalTcp: 50000,
    sowText: '',
  }
}

interface Expectation {
  name: string
  fixture: FixtureInput
  required: EnvelopeDocumentId[]
  optional: EnvelopeDocumentId[]
}

const cases: Expectation[] = [
  {
    name: 'initial • non-senior • short SOW',
    fixture: { scenario: 'initial', isSenior: false, isLongSow: false },
    required: ['main-hi-base', 'sow-pdf', 'esign-waiver'],
    optional: ['material-order'],
  },
  {
    name: 'initial • non-senior • long SOW',
    fixture: { scenario: 'initial', isSenior: false, isLongSow: true },
    required: ['main-hi-base', 'sow-pdf', 'esign-waiver'],
    optional: ['material-order'],
  },
  {
    name: 'initial • senior • short SOW',
    fixture: { scenario: 'initial', isSenior: true, isLongSow: false },
    required: ['main-hi-senior', 'sow-pdf', 'senior-ack', 'esign-waiver'],
    optional: ['material-order'],
  },
  {
    name: 'initial • senior • long SOW',
    fixture: { scenario: 'initial', isSenior: true, isLongSow: true },
    required: ['main-hi-senior', 'sow-pdf', 'senior-ack', 'esign-waiver'],
    optional: ['material-order'],
  },
  {
    name: 'upsell • non-senior • short SOW (sow-pdf forbidden, lives inline in AWD)',
    fixture: { scenario: 'upsell', isSenior: false, isLongSow: false },
    required: [],
    optional: ['material-order'],
  },
  {
    name: 'upsell • non-senior • long SOW (sow-pdf required)',
    fixture: { scenario: 'upsell', isSenior: false, isLongSow: true },
    required: ['sow-pdf'],
    optional: ['material-order'],
  },
  {
    name: 'upsell • senior (senior-ack and esign-waiver still initial-only)',
    fixture: { scenario: 'upsell', isSenior: true, isLongSow: false },
    required: [],
    optional: ['material-order'],
  },
]

let failures = 0

function arrayEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  const aSorted = [...a].sort()
  const bSorted = [...b].sort()
  return aSorted.every((v, i) => v === bSorted[i])
}

console.log('=== evaluateDocuments fixtures ===\n')
for (const c of cases) {
  const ctx = makeContext(c.fixture)
  const out = evaluateDocuments(ctx)
  const requiredOk = arrayEqual(out.required, c.required)
  const optionalOk = arrayEqual(out.optional, c.optional)
  const ok = requiredOk && optionalOk
  console.log(`${ok ? '✅' : '❌'} ${c.name}`)
  if (!ok) {
    failures++
    console.log(`   expected required: ${JSON.stringify(c.required)}`)
    console.log(`   actual   required: ${JSON.stringify(out.required)}`)
    console.log(`   expected optional: ${JSON.stringify(c.optional)}`)
    console.log(`   actual   optional: ${JSON.stringify(out.optional)}`)
  }
}

// --- validateEnvelopeSelection guards --------------------------------------

console.log('\n=== validateEnvelopeSelection guards ===\n')

// Case A: senior initial, missing senior-ack → EnvelopeSelectionError
{
  const ctx = makeContext({ scenario: 'initial', isSenior: true, isLongSow: false })
  let threw: unknown
  try {
    validateEnvelopeSelection(ctx, ['main-hi-senior', 'sow-pdf', 'esign-waiver'])
  }
  catch (e) {
    threw = e
  }
  const isExpectedError = threw instanceof EnvelopeSelectionError && threw.missing.includes('senior-ack')
  console.log(`${isExpectedError ? '✅' : '❌'} senior initial without senior-ack → throws (missing: senior-ack)`)
  if (!isExpectedError) {
    failures++
    console.log(`   got: ${threw instanceof Error ? threw.message : String(threw)}`)
  }
}

// Case B: non-senior initial, includes senior-ack → EnvelopeSelectionError
{
  const ctx = makeContext({ scenario: 'initial', isSenior: false, isLongSow: false })
  let threw: unknown
  try {
    validateEnvelopeSelection(ctx, ['main-hi-base', 'sow-pdf', 'esign-waiver', 'senior-ack'])
  }
  catch (e) {
    threw = e
  }
  const isExpectedError = threw instanceof EnvelopeSelectionError && threw.banned.includes('senior-ack')
  console.log(`${isExpectedError ? '✅' : '❌'} non-senior initial with senior-ack → throws (banned: senior-ack)`)
  if (!isExpectedError) {
    failures++
    console.log(`   got: ${threw instanceof Error ? threw.message : String(threw)}`)
  }
}

// Case C: valid senior initial selection → no throw
{
  const ctx = makeContext({ scenario: 'initial', isSenior: true, isLongSow: false })
  let threw: unknown
  try {
    validateEnvelopeSelection(ctx, ['main-hi-senior', 'sow-pdf', 'senior-ack', 'esign-waiver'])
  }
  catch (e) {
    threw = e
  }
  console.log(`${threw == null ? '✅' : '❌'} senior initial with full required set → does not throw`)
  if (threw != null) {
    failures++
    console.log(`   got: ${threw instanceof Error ? threw.message : String(threw)}`)
  }
}

// Case D: optional toggled on (material-order) is fine
{
  const ctx = makeContext({ scenario: 'initial', isSenior: false, isLongSow: false })
  let threw: unknown
  try {
    validateEnvelopeSelection(ctx, ['main-hi-base', 'sow-pdf', 'esign-waiver', 'material-order'])
  }
  catch (e) {
    threw = e
  }
  console.log(`${threw == null ? '✅' : '❌'} non-senior initial with material-order toggled on → does not throw`)
  if (threw != null) {
    failures++
    console.log(`   got: ${threw instanceof Error ? threw.message : String(threw)}`)
  }
}

console.log('')
if (failures > 0) {
  console.error(`${failures} failure(s)`)
  process.exit(1)
}
console.log('All evaluator + validator checks passed.')
