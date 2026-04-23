# Zoho Sign SOW Overflow Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore reliable Zoho Sign draft creation for proposals whose SOW plaintext exceeds Zoho's 4,096-char template capacity, by conditionally attaching the full SOW as a separate PDF in the same envelope.

**Architecture:** Two-path dispatch inside `contractService.createDraft`. Short path (SOW ≤ 3,600 chars) uses an improved paragraph-aware packer that fills `sow-1` before `sow-2` without mid-word cuts. Long path generates a SOW-focused PDF via pdfmake, attaches it to the template-created draft via Zoho's `addFilesToRequest` multipart endpoint, and writes a pointer string into `sow-1` ("See attached Scope of Work document — N pages"). The Zoho template itself is never modified.

**Tech Stack:** TypeScript, Next.js 15, Zoho Sign REST API v1, Upstash QStash (job orchestration), pdfmake (PDF generation), pdf-lib (page count), pg (ad-hoc scripts), Node `node:assert` for verification.

**Spec:** [`docs/superpowers/specs/2026-04-23-zoho-sow-multi-doc-design.md`](../specs/2026-04-23-zoho-sow-multi-doc-design.md)
**Issue:** [#135](https://github.com/OlisDevSpot/tri-pros-website/issues/135)
**Branch:** `fix/135-zoho-sow-overflow` (already created, 2 commits ahead of main)

**Verification gates for every task that modifies code:**
- `pnpm tsc` — passes with no errors
- `pnpm lint` — passes with no errors
- Any task-specific verification script exits with status 0

**Commit convention:** conventional commits (`feat(zoho-sign):`, `fix(zoho-sign):`, `chore(zoho-sign):`, `test(zoho-sign):`) with `Refs #135` trailer. Branch already configured.

---

## Phase 0 — Pre-flight Zoho endpoint verification

This phase is a **GATE**. If it fails or reveals unexpected behavior, stop and revise the spec before any production code lands.

### Task 0: Verify `addFilesToRequest` endpoint + reference-only file support

**Files:**
- Create: `scripts/verify-add-files-endpoint.ts`
- Modify (after confirmation): `docs/superpowers/specs/2026-04-23-zoho-sow-multi-doc-design.md` §6.5

**Why this task exists:** The spec hypothesizes `POST /api/v1/requests/{id}` multipart for attaching files, but Zoho's public REST docs don't explicitly document this path. We have strong signal from the PHP SDK's `addFilesToRequest` wrapper, but need a live confirmation before writing production code that depends on the exact path/body shape. This also confirms that reference-only files (attached PDFs with no signer fields) render correctly in the signed packet.

- [ ] **Step 1: Write the verification script**

Create `scripts/verify-add-files-endpoint.ts`:

```ts
/* eslint-disable no-console */
/**
 * Verifies that we can attach an additional PDF file to a template-created
 * signing draft, and that the attached file stays as a reference-only page
 * (no signatures required on it). Cleans up the test draft afterward.
 *
 * Run: DATABASE_URL=... ZOHO_SIGN_*=... pnpm tsx scripts/verify-add-files-endpoint.ts
 */
import { Buffer } from 'node:buffer'
import { getZohoAccessToken } from '@/shared/services/zoho-sign/lib/get-access-token'
import { ZOHO_SIGN_BASE_URL, ZOHO_SIGN_TEMPLATES } from '@/shared/services/zoho-sign/constants'

async function main() {
  const token = await getZohoAccessToken()
  const auth = { Authorization: `Zoho-oauthtoken ${token}` }

  // 1. Create minimal template-based draft (base template, is_quicksend=false)
  const tpl = ZOHO_SIGN_TEMPLATES.base
  const body = {
    templates: {
      field_data: {
        field_text_data: {
          'ho-name': 'Endpoint Verification',
          'ho-email': 'info@triprosremodeling.com',
          'ho-age': '40',
          'start-date': '1/1/2030',
          'completion-date': '2/1/2030',
          'sow-1': 'See attached SOW (verification draft)',
          'sow-2': '',
          'tcp': '0',
          'deposit': '0',
          'ho-address': '—',
          'ho-city-state-zip': '—',
          'ho-phone': '—',
        },
        field_boolean_data: {},
        field_date_data: {},
      },
      actions: [
        {
          action_id: tpl.actions.contractor,
          action_type: 'SIGN',
          role: 'Contractor',
          recipient_name: 'Tri Pros Remodeling',
          recipient_email: 'info@triprosremodeling.com',
          verify_recipient: false,
        },
        {
          action_id: tpl.actions.homeowner,
          action_type: 'SIGN',
          role: 'Homeowner',
          recipient_name: 'Verification',
          recipient_email: 'info@triprosremodeling.com',
          verify_recipient: false,
        },
      ],
      notes: '',
    },
  }

  const createRes = await fetch(
    `${ZOHO_SIGN_BASE_URL}/api/v1/templates/${tpl.templateId}/createdocument?is_quicksend=false`,
    {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(JSON.stringify(body))}`,
    },
  )
  if (!createRes.ok) throw new Error(`create draft failed ${createRes.status}: ${await createRes.text()}`)
  const createJson = await createRes.json() as { requests: { request_id: string } }
  const requestId = createJson.requests.request_id
  console.log('✅ draft created:', requestId)

  // 2. Build a trivial 1-page PDF in memory (%PDF-1.4 minimal doc).
  const minimalPdf = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n'
    + '2 0 obj\n<</Type/Pages/Count 1/Kids[3 0 R]>>\nendobj\n'
    + '3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<<>>>>\nendobj\n'
    + '4 0 obj\n<</Length 44>>stream\nBT /F1 12 Tf 50 700 Td (Verification page) Tj ET\nendstream\nendobj\n'
    + 'xref\n0 5\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n'
    + '0000000103 00000 n\n0000000194 00000 n\ntrailer\n<</Size 5/Root 1 0 R>>\nstartxref\n275\n%%EOF\n',
    'utf8',
  )

  // 3. Try candidate endpoints in order until one succeeds.
  const candidates = [
    { url: `${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}`, note: 'spec hypothesis (most likely)' },
    { url: `${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}/documents`, note: 'fallback /documents' },
    { url: `${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}/addfiles`, note: 'fallback /addfiles' },
  ]

  let confirmedUrl: string | null = null
  for (const c of candidates) {
    const form = new FormData()
    form.append('data', JSON.stringify({}))
    form.append('file', new Blob([minimalPdf], { type: 'application/pdf' }), 'verification.pdf')
    const res = await fetch(c.url, { method: 'POST', headers: auth, body: form })
    const text = await res.text()
    console.log(`  ${c.note} (${c.url.split('/api/v1')[1]}): HTTP ${res.status}`)
    if (res.ok) {
      confirmedUrl = c.url
      console.log('    body:', text.slice(0, 200))
      break
    }
    else {
      console.log('    error:', text.slice(0, 200))
    }
  }

  if (!confirmedUrl) {
    await cleanupDraft(requestId, token)
    throw new Error('❌ No candidate endpoint worked. Revise the spec: check Zoho API docs or SDK source for the correct path.')
  }
  console.log(`\n✅ CONFIRMED ENDPOINT: ${confirmedUrl}\n`)

  // 4. Fetch draft details and verify 2 files + no actions on the attached one.
  const detailsRes = await fetch(`${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}`, { headers: auth })
  const details = await detailsRes.json() as {
    requests: {
      document_ids?: Array<{ document_id: string; document_name: string; document_order: string }>
      actions?: Array<{ action_id: string; recipient_email: string }>
    }
  }
  const docs = details.requests.document_ids ?? []
  console.log(`envelope has ${docs.length} documents:`)
  for (const d of docs) console.log(`  - ${d.document_name} (id=${d.document_id}, order=${d.document_order})`)
  if (docs.length !== 2) throw new Error(`expected 2 docs, got ${docs.length}`)

  // 5. Cleanup.
  await cleanupDraft(requestId, token)
  console.log('✅ cleanup done')

  console.log('\n--- ACTION REQUIRED ---')
  console.log(`Update spec §6.5 endpoint to: POST ${confirmedUrl.replace(requestId, '{requestId}')}`)
}

async function cleanupDraft(requestId: string, token: string) {
  await fetch(`${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}/delete`, {
    method: 'PUT',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recall_inprogress: true }),
  })
}

main().catch((err) => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Run the script**

```bash
export ZOHO_SIGN_CLIENT_ID="$(grep -E '^ZOHO_SIGN_CLIENT_ID=' .env | cut -d= -f2-)"
export ZOHO_SIGN_CLIENT_SECRET="$(grep -E '^ZOHO_SIGN_CLIENT_SECRET=' .env | cut -d= -f2-)"
export ZOHO_SIGN_REFRESH_TOKEN="$(grep -E '^ZOHO_SIGN_REFRESH_TOKEN=' .env | cut -d= -f2-)"
pnpm tsx scripts/verify-add-files-endpoint.ts
```

Expected: prints "✅ CONFIRMED ENDPOINT: ..." and "envelope has 2 documents". Exits 0.

- [ ] **Step 3: Update spec §6.5 with the confirmed endpoint string**

Edit `docs/superpowers/specs/2026-04-23-zoho-sow-multi-doc-design.md` §6.5 — replace the "Hypothesized endpoint" line with the exact confirmed path. Delete the "candidates" language. If the endpoint is the hypothesized one, keep the language minimal.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-add-files-endpoint.ts docs/superpowers/specs/2026-04-23-zoho-sow-multi-doc-design.md
git commit -m "chore(zoho-sign): pre-flight verify addFilesToRequest endpoint

Refs #135"
```

---

## Phase 1 — Dependencies + pure utilities

### Task 1: Install pdfmake and pdf-lib

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install deps**

```bash
pnpm add pdfmake pdf-lib
pnpm add -D @types/pdfmake
```

- [ ] **Step 2: Verify install**

```bash
pnpm tsc 2>&1 | head -5
```

Expected: no new errors. (`pnpm tsc` may still show errors unrelated to our change; just confirm no new ones about pdfmake/pdf-lib.)

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): add pdfmake and pdf-lib for SOW attachment PDFs

Refs #135"
```

### Task 2: Add `SOW_FIELD_MAX_CHARS` and `SOW_INLINE_MAX_CHARS` constants

**Files:**
- Modify: `src/shared/services/zoho-sign/constants/index.ts`

- [ ] **Step 1: Add constants**

At the bottom of `src/shared/services/zoho-sign/constants/index.ts`, add:

```ts
/**
 * Per-field safety cap for sow-1/sow-2 text fields.
 * Zoho's hard cap (text_property.max_field_length) is 2048. We leave a
 * 48-char margin to absorb encoding/whitespace quirks; never change this
 * above 2040 without testing.
 */
export const SOW_FIELD_MAX_CHARS = 2000

/**
 * Threshold (in plaintext chars) above which the signing request routes
 * to the long path (attached SOW PDF) instead of inlining into sow-1/sow-2.
 *
 * Derived: 2 × SOW_FIELD_MAX_CHARS = 4000 theoretical short-path capacity,
 * minus ~10% headroom so a paragraph-boundary break never falls outside
 * the cap. Auditable, not magic.
 */
export const SOW_INLINE_MAX_CHARS = 3600
```

- [ ] **Step 2: Typecheck**

```bash
pnpm tsc 2>&1 | grep -c "error TS"
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/zoho-sign/constants/index.ts
git commit -m "feat(zoho-sign): add SOW field/inline char-cap constants

Refs #135"
```

### Task 3: `isLongSow` predicate

**Files:**
- Create: `src/shared/services/zoho-sign/lib/is-long-sow.ts`
- Create: `scripts/verify-is-long-sow.ts`

- [ ] **Step 1: Write the module**

Create `src/shared/services/zoho-sign/lib/is-long-sow.ts`:

```ts
import { SOW_INLINE_MAX_CHARS } from '../constants'

/**
 * True when the SOW plaintext is long enough to require attachment-based
 * delivery instead of inlining into the template's sow-1/sow-2 fields.
 */
export function isLongSow(sowText: string): boolean {
  return sowText.length > SOW_INLINE_MAX_CHARS
}
```

- [ ] **Step 2: Write the verification script**

Create `scripts/verify-is-long-sow.ts`:

```ts
/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { isLongSow } from '@/shared/services/zoho-sign/lib/is-long-sow'
import { SOW_INLINE_MAX_CHARS } from '@/shared/services/zoho-sign/constants'

assert.equal(SOW_INLINE_MAX_CHARS, 3600, 'threshold constant drifted')

assert.equal(isLongSow(''), false, 'empty text')
assert.equal(isLongSow('a'.repeat(3599)), false, 'below threshold')
assert.equal(isLongSow('a'.repeat(3600)), false, 'exactly at threshold')
assert.equal(isLongSow('a'.repeat(3601)), true, 'just over threshold')
assert.equal(isLongSow('a'.repeat(10000)), true, 'well over')

console.log('✅ isLongSow verified')
```

- [ ] **Step 3: Run the verification**

```bash
pnpm tsx scripts/verify-is-long-sow.ts
```

Expected: prints `✅ isLongSow verified`, exits 0.

- [ ] **Step 4: Typecheck + lint**

```bash
pnpm tsc && pnpm lint
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/zoho-sign/lib/is-long-sow.ts scripts/verify-is-long-sow.ts
git commit -m "feat(zoho-sign): add isLongSow predicate

Routes SOWs longer than SOW_INLINE_MAX_CHARS to the multi-doc path.

Refs #135"
```

### Task 4: `packSowText` paragraph-aware packer

**Files:**
- Create: `src/shared/services/zoho-sign/lib/pack-sow-text.ts`
- Create: `scripts/verify-pack-sow-text.ts`

- [ ] **Step 1: Write the verification script FIRST (TDD)**

Create `scripts/verify-pack-sow-text.ts`:

```ts
/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { packSowText } from '@/shared/services/zoho-sign/lib/pack-sow-text'
import { SOW_FIELD_MAX_CHARS } from '@/shared/services/zoho-sign/constants'

// Case 1: input under the cap fits entirely in sow1
{
  const text = 'Short scope of work.'
  const { sow1, sow2, overflow } = packSowText(text)
  assert.equal(sow1, text)
  assert.equal(sow2, '')
  assert.equal(overflow, 0)
}

// Case 2: exactly 2000 chars, single paragraph, no split needed
{
  const text = 'a'.repeat(SOW_FIELD_MAX_CHARS)
  const { sow1, sow2, overflow } = packSowText(text)
  assert.equal(sow1.length, SOW_FIELD_MAX_CHARS)
  assert.equal(sow2, '')
  assert.equal(overflow, 0)
}

// Case 3: two paragraphs joined by \n\n, each ~1500 chars — cleanly splits on \n\n
{
  const p1 = 'First paragraph. '.repeat(90)     // ~1530 chars
  const p2 = 'Second paragraph. '.repeat(90)    // ~1620 chars
  const text = `${p1}\n\n${p2}`
  const { sow1, sow2, overflow } = packSowText(text)
  assert.ok(sow1.length <= SOW_FIELD_MAX_CHARS, `sow1 within cap: ${sow1.length}`)
  assert.ok(sow2.length <= SOW_FIELD_MAX_CHARS, `sow2 within cap: ${sow2.length}`)
  assert.equal(overflow, 0, 'no overflow expected')
  assert.ok(!sow1.includes('Second paragraph'), 'sow1 stops at paragraph boundary')
  assert.ok(sow2.startsWith('Second paragraph'), 'sow2 starts with p2')
}

// Case 4: long single paragraph with sentence breaks → splits at '. '
{
  const sentence = 'This is a sentence that is moderately long and has multiple words in it. '
  const text = sentence.repeat(50)   // ~3700 chars
  const { sow1, sow2, overflow } = packSowText(text)
  assert.ok(sow1.length <= SOW_FIELD_MAX_CHARS)
  assert.ok(sow2.length <= SOW_FIELD_MAX_CHARS)
  assert.ok(sow1.endsWith(' '), 'sow1 ends after sentence + space')
}

// Case 5: pathological 3500-char single word → hard-break at cap
{
  const text = 'a'.repeat(3500)
  const { sow1, sow2 } = packSowText(text)
  assert.equal(sow1.length, SOW_FIELD_MAX_CHARS, 'hard-break at cap when no boundary found')
  assert.equal(sow2.length, 3500 - SOW_FIELD_MAX_CHARS)
}

// Case 6: trailing whitespace is trimmed
{
  const text = `Scope content.${'\n'.repeat(10)}`
  const { sow1 } = packSowText(text)
  assert.equal(sow1, 'Scope content.')
}

console.log('✅ packSowText verified')
```

- [ ] **Step 2: Run to confirm it fails**

```bash
pnpm tsx scripts/verify-pack-sow-text.ts
```

Expected: fails with `Cannot find module` or `packSowText is not a function`.

- [ ] **Step 3: Write the implementation**

Create `src/shared/services/zoho-sign/lib/pack-sow-text.ts`:

```ts
import { SOW_FIELD_MAX_CHARS } from '../constants'

const MIN_FILL_RATIO = 0.5

/**
 * Packs SOW plaintext into the sow-1/sow-2 Zoho template fields.
 *
 * Fills sow-1 up to SOW_FIELD_MAX_CHARS, preferring clean boundaries
 * (paragraph → line → sentence → word). Then fills sow-2 from what
 * remains. On the short path (guaranteed by caller), overflow must be 0;
 * if not, that indicates a threshold-routing bug and the caller is
 * responsible for error handling.
 */
export function packSowText(fullText: string): {
  sow1: string
  sow2: string
  overflow: number
} {
  const trimmed = fullText.trim()
  if (trimmed.length === 0) {
    return { sow1: '', sow2: '', overflow: 0 }
  }

  const split1 = findSplit(trimmed, SOW_FIELD_MAX_CHARS)
  const sow1 = trimmed.slice(0, split1).trim()
  const remaining = trimmed.slice(split1).trimStart()

  if (remaining.length === 0) {
    return { sow1, sow2: '', overflow: 0 }
  }

  const split2 = findSplit(remaining, SOW_FIELD_MAX_CHARS)
  const sow2 = remaining.slice(0, split2).trim()
  const overflow = remaining.length - split2

  return { sow1, sow2, overflow }
}

function findSplit(text: string, maxLen: number): number {
  if (text.length <= maxLen) {
    return text.length
  }
  const window = text.slice(0, maxLen)
  for (const sep of ['\n\n', '\n', '. ', ' ']) {
    const idx = window.lastIndexOf(sep)
    if (idx >= maxLen * MIN_FILL_RATIO) {
      return idx + sep.length
    }
  }
  return maxLen
}
```

- [ ] **Step 4: Run verification**

```bash
pnpm tsx scripts/verify-pack-sow-text.ts
```

Expected: `✅ packSowText verified`, exit 0.

- [ ] **Step 5: Typecheck + lint**

```bash
pnpm tsc && pnpm lint
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/shared/services/zoho-sign/lib/pack-sow-text.ts scripts/verify-pack-sow-text.ts
git commit -m "feat(zoho-sign): paragraph-aware SOW text packer

Replaces the blind \`.slice(0, 2000)\` / \`.slice(2000, 6000)\` logic with
boundary-aware packing that prefers paragraph > line > sentence > word
breaks. Respects SOW_FIELD_MAX_CHARS per field and never mid-word-cuts.

Refs #135"
```

### Task 5: `tiptapToPdfmake` content mapper

**Files:**
- Create: `src/shared/services/pdf/tiptap-to-pdfmake.ts`
- Create: `scripts/verify-tiptap-to-pdfmake.ts`

- [ ] **Step 1: Write the verification script FIRST**

Create `scripts/verify-tiptap-to-pdfmake.ts`:

```ts
/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { tiptapToPdfmake } from '@/shared/services/pdf/tiptap-to-pdfmake'

// paragraph
{
  const out = tiptapToPdfmake({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world.' }] }],
  })
  assert.deepEqual(out, [{ text: 'Hello world.', margin: [0, 0, 0, 4] }])
}

// heading (h2)
{
  const out = tiptapToPdfmake({
    type: 'doc',
    content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Site Preparation' }] }],
  })
  assert.deepEqual(out, [{ text: 'Site Preparation', style: 'h2', margin: [0, 8, 0, 4] }])
}

// bulletList with listItem children
{
  const out = tiptapToPdfmake({
    type: 'doc',
    content: [{
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First bullet' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second bullet' }] }] },
      ],
    }],
  })
  assert.equal(out.length, 1)
  assert.ok('ul' in (out[0] as any), 'top-level is ul')
  assert.equal((out[0] as any).ul.length, 2)
}

// orderedList
{
  const out = tiptapToPdfmake({
    type: 'doc',
    content: [{
      type: 'orderedList',
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'One' }] }] },
      ],
    }],
  })
  assert.ok('ol' in (out[0] as any))
}

// text with marks → bold
{
  const out = tiptapToPdfmake({
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Plain ' },
        { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' plain.' },
      ],
    }],
  })
  // paragraph with mixed marks becomes an array of text runs
  const para = out[0] as any
  assert.ok(Array.isArray(para.text), 'mixed marks → text array')
  assert.equal(para.text[1].text, 'bold')
  assert.equal(para.text[1].bold, true)
}

// unknown node type falls through to children
{
  const out = tiptapToPdfmake({
    type: 'doc',
    content: [{
      type: 'customBlock',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'nested' }] }],
    }],
  })
  assert.equal(out.length, 1)
  assert.equal((out[0] as any).text, 'nested')
}

// empty doc
{
  const out = tiptapToPdfmake({ type: 'doc', content: [] })
  assert.deepEqual(out, [])
}

console.log('✅ tiptapToPdfmake verified')
```

- [ ] **Step 2: Run to confirm it fails**

```bash
pnpm tsx scripts/verify-tiptap-to-pdfmake.ts
```

Expected: module not found.

- [ ] **Step 3: Write the implementation**

Create `src/shared/services/pdf/tiptap-to-pdfmake.ts`:

```ts
interface TiptapMark { type: string, attrs?: Record<string, unknown> }

interface TiptapNode {
  type: string
  attrs?: Record<string, unknown>
  text?: string
  marks?: TiptapMark[]
  content?: TiptapNode[]
}

type PdfMakeContent = unknown

/**
 * Convert a Tiptap doc node into a pdfmake content array. Mirrors the
 * structure of `src/shared/lib/tiptap-to-text.ts` but emits structured
 * pdfmake content instead of plaintext.
 */
export function tiptapToPdfmake(doc: TiptapNode): PdfMakeContent[] {
  if (doc.type !== 'doc' || !Array.isArray(doc.content)) {
    return []
  }
  const out: PdfMakeContent[] = []
  for (const child of doc.content) {
    const rendered = renderBlock(child)
    if (rendered !== null) {
      out.push(rendered)
    }
  }
  return out
}

function renderBlock(node: TiptapNode): PdfMakeContent | null {
  switch (node.type) {
    case 'paragraph': {
      const content = renderInline(node.content ?? [])
      return { text: content.length === 1 && isPlainTextRun(content[0]) ? (content[0] as { text: string }).text : content, margin: [0, 0, 0, 4] }
    }
    case 'heading': {
      const level = (node.attrs?.level as number) ?? 2
      const style = `h${Math.min(Math.max(level, 1), 3)}`
      return { text: extractPlaintext(node), style, margin: [0, 8, 0, 4] }
    }
    case 'bulletList': {
      return { ul: (node.content ?? []).map(renderListItem) }
    }
    case 'orderedList': {
      return { ol: (node.content ?? []).map(renderListItem) }
    }
    case 'blockquote': {
      return { text: extractPlaintext(node), style: 'quote', margin: [8, 4, 0, 4] }
    }
    case 'horizontalRule': {
      return { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#cccccc' }], margin: [0, 4, 0, 4] }
    }
    default: {
      if (Array.isArray(node.content)) {
        const children = node.content.map(renderBlock).filter((x): x is PdfMakeContent => x !== null)
        if (children.length === 1) return children[0]
        if (children.length > 1) return { stack: children }
      }
      return null
    }
  }
}

function renderListItem(item: TiptapNode): PdfMakeContent {
  if (!Array.isArray(item.content) || item.content.length === 0) {
    return ''
  }
  const children = item.content.map(renderBlock).filter((x): x is PdfMakeContent => x !== null)
  if (children.length === 0) return ''
  if (children.length === 1) return children[0]
  return { stack: children }
}

interface TextRun { text: string, bold?: boolean, italics?: boolean, decoration?: string }

function renderInline(nodes: TiptapNode[]): TextRun[] {
  const runs: TextRun[] = []
  for (const n of nodes) {
    if (n.type === 'text') {
      const run: TextRun = { text: n.text ?? '' }
      for (const mark of n.marks ?? []) {
        if (mark.type === 'bold') run.bold = true
        if (mark.type === 'italic') run.italics = true
        if (mark.type === 'underline') run.decoration = 'underline'
      }
      runs.push(run)
    }
    else if (Array.isArray(n.content)) {
      runs.push(...renderInline(n.content))
    }
  }
  return runs
}

function isPlainTextRun(run: unknown): run is TextRun {
  if (typeof run !== 'object' || run === null) return false
  const r = run as Record<string, unknown>
  return typeof r.text === 'string' && r.bold === undefined && r.italics === undefined && r.decoration === undefined
}

function extractPlaintext(node: TiptapNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (!Array.isArray(node.content)) return ''
  return node.content.map(extractPlaintext).join('')
}
```

- [ ] **Step 4: Run verification**

```bash
pnpm tsx scripts/verify-tiptap-to-pdfmake.ts
```

Expected: `✅ tiptapToPdfmake verified`, exit 0.

- [ ] **Step 5: Typecheck + lint**

```bash
pnpm tsc && pnpm lint
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/shared/services/pdf/tiptap-to-pdfmake.ts scripts/verify-tiptap-to-pdfmake.ts
git commit -m "feat(pdf): Tiptap JSON to pdfmake content mapper

Parallel to tiptap-to-text.ts but emits structured pdfmake content arrays
for rendering SOW sections in attached contract documents.

Refs #135"
```

### Task 6: `countPdfPages` helper

**Files:**
- Create: `src/shared/services/pdf/count-pdf-pages.ts`
- Create: `scripts/verify-count-pdf-pages.ts`

- [ ] **Step 1: Write implementation**

Create `src/shared/services/pdf/count-pdf-pages.ts`:

```ts
import type { Buffer } from 'node:buffer'
import { PDFDocument } from 'pdf-lib'

/** Counts pages in a PDF buffer without rendering it. */
export async function countPdfPages(buffer: Buffer): Promise<number> {
  const doc = await PDFDocument.load(buffer)
  return doc.getPageCount()
}
```

- [ ] **Step 2: Write verification**

Create `scripts/verify-count-pdf-pages.ts`:

```ts
/* eslint-disable no-console */
import { Buffer } from 'node:buffer'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import { countPdfPages } from '@/shared/services/pdf/count-pdf-pages'

// Build a 3-page PDF via pdf-lib and round-trip through countPdfPages.
const doc = await PDFDocument.create()
for (let i = 0; i < 3; i++) doc.addPage([612, 792])
const bytes = await doc.save()
const buf = Buffer.from(bytes)

const count = await countPdfPages(buf)
assert.equal(count, 3, `expected 3 pages, got ${count}`)

console.log('✅ countPdfPages verified')
```

- [ ] **Step 3: Run verification**

```bash
pnpm tsx scripts/verify-count-pdf-pages.ts
```

Expected: `✅ countPdfPages verified`, exit 0.

- [ ] **Step 4: Typecheck + lint**

```bash
pnpm tsc && pnpm lint
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/pdf/count-pdf-pages.ts scripts/verify-count-pdf-pages.ts
git commit -m "feat(pdf): page counter helper using pdf-lib

Refs #135"
```

### Task 7: `buildSowDocDefinition` pure function

**Files:**
- Create: `src/shared/services/pdf/sow-doc-definition.ts`
- Create: `scripts/verify-sow-doc-definition.ts`

- [ ] **Step 1: Write the verification FIRST**

Create `scripts/verify-sow-doc-definition.ts`:

```ts
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

// First 2 blocks should be the title + subtitle
const content = docDef.content as any[]
assert.equal(content[0].text, 'Scope of Work', 'first block is doc title')
assert.ok(content[1].text?.includes('Test Proposal'), 'subtitle mentions proposal label')
assert.ok(content[1].text?.includes('Test Customer'), 'subtitle mentions customer')

// Each of the 2 SOW items should have a pageBreak:before on item 2, not item 1
const itemTitles = content.filter((c: any) => c.style === 'itemTitle')
assert.equal(itemTitles.length, 2, 'two item titles')
assert.equal(itemTitles[0].pageBreak, undefined, 'first item has no pageBreak')
assert.equal(itemTitles[1].pageBreak, 'before', 'second item has pageBreak:before')
assert.ok(itemTitles[0].text.includes('Sod installation'), 'first title correct')
assert.ok(itemTitles[1].text.includes('Cabinet refinish'), 'second title correct')

// Styles are defined
assert.ok(docDef.styles, 'styles declared')
assert.ok((docDef.styles as any).itemTitle, 'itemTitle style')
assert.ok((docDef.styles as any).h2, 'h2 style')

console.log('✅ buildSowDocDefinition verified')
```

- [ ] **Step 2: Run to confirm it fails**

```bash
pnpm tsx scripts/verify-sow-doc-definition.ts
```

Expected: module not found.

- [ ] **Step 3: Write the implementation**

Create `src/shared/services/pdf/sow-doc-definition.ts`:

```ts
import type { TDocumentDefinitions } from 'pdfmake/interfaces'
import type { ProposalWithCustomer } from '@/shared/dal/server/proposals/api'
import { tiptapToPdfmake } from './tiptap-to-pdfmake'

/**
 * Builds a SOW-focused pdfmake document definition for a proposal.
 * Deliberately excludes branding, customer block, pricing breakdown,
 * agreement notes — all covered on the main contract template pages.
 */
export function buildSowDocDefinition(proposal: ProposalWithCustomer): TDocumentDefinitions {
  const sow = proposal.projectJSON.data.sow ?? []
  const customerName = proposal.customer?.name ?? 'Customer'
  const label = proposal.label ?? 'Proposal'

  const content: TDocumentDefinitions['content'] = [
    { text: 'Scope of Work', style: 'docTitle' },
    { text: `${label} — Prepared for ${customerName}`, style: 'subtitle', margin: [0, 0, 0, 16] },
  ]

  sow.forEach((item, i) => {
    content.push({
      text: `${i + 1}. ${item.title || 'Untitled scope'}`,
      style: 'itemTitle',
      pageBreak: i > 0 ? 'before' : undefined,
    })
    if (item.trade?.label) {
      content.push({ text: item.trade.label, style: 'itemTrade', margin: [0, 0, 0, 4] })
    }
    if (item.scopes?.length) {
      content.push({
        text: item.scopes.map(s => s.label).join(' · '),
        style: 'scopeChips',
        margin: [0, 0, 0, 12],
      })
    }
    const doc = safeParseDoc(item.contentJSON)
    if (doc) {
      content.push(...(tiptapToPdfmake(doc) as unknown as TDocumentDefinitions['content'] extends (infer U)[] ? U[] : never))
    }
  })

  return {
    content,
    defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.3 },
    styles: {
      docTitle: { fontSize: 20, bold: true, margin: [0, 0, 0, 4] },
      subtitle: { fontSize: 10, color: '#666', margin: [0, 0, 0, 16] },
      itemTitle: { fontSize: 14, bold: true, margin: [0, 0, 0, 2] },
      itemTrade: { fontSize: 10, color: '#666', italics: true },
      scopeChips: { fontSize: 9, color: '#444' },
      h1: { fontSize: 14, bold: true },
      h2: { fontSize: 12, bold: true },
      h3: { fontSize: 11, bold: true },
      quote: { italics: true, color: '#555' },
    },
    pageMargins: [56, 56, 56, 56],
  }
}

function safeParseDoc(json: string): Parameters<typeof tiptapToPdfmake>[0] | null {
  try {
    const parsed = JSON.parse(json)
    if (parsed && typeof parsed === 'object' && parsed.type === 'doc') {
      return parsed
    }
    return null
  }
  catch {
    return null
  }
}
```

- [ ] **Step 4: Run verification**

```bash
pnpm tsx scripts/verify-sow-doc-definition.ts
```

Expected: `✅ buildSowDocDefinition verified`, exit 0.

- [ ] **Step 5: Typecheck + lint**

```bash
pnpm tsc && pnpm lint
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/shared/services/pdf/sow-doc-definition.ts scripts/verify-sow-doc-definition.ts
git commit -m "feat(pdf): SOW-focused pdfmake document definition

Pure function: ProposalWithCustomer → pdfmake doc definition. SOW items
render one-per-page with title + trade + scope chips + Tiptap body.
Intentionally omits branding/pricing/customer block (already on template
pages).

Refs #135"
```

---

## Phase 2 — Service layer integration

### Task 8: Flesh out `pdfService.generateSowPdf`

**Files:**
- Modify: `src/shared/services/pdf.service.ts`
- Create: `src/shared/services/pdf/render-pdf.ts`
- Create: `scripts/verify-generate-sow-pdf.ts`

- [ ] **Step 1: Write the pdfmake render helper**

Create `src/shared/services/pdf/render-pdf.ts`:

```ts
import type { Buffer } from 'node:buffer'
import type { TDocumentDefinitions } from 'pdfmake/interfaces'
import PdfPrinter from 'pdfmake'
import { Buffer as BufferImpl } from 'node:buffer'

const printer = new PdfPrinter({
  Roboto: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
})

/** Renders a pdfmake doc definition to a Buffer. */
export function renderPdf(def: TDocumentDefinitions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = printer.createPdfKitDocument(def)
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(BufferImpl.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}
```

**Note on fonts:** pdfmake's server-side usage requires TTF files for custom fonts. We're using PDF standard fonts (Helvetica) to avoid shipping Roboto TTF with the bundle. Visual result: near-identical to Roboto for the SOW reference doc; acceptable per spec §6.3.

- [ ] **Step 2: Update `pdf.service.ts`**

Replace the contents of `src/shared/services/pdf.service.ts`:

```ts
import type { Buffer } from 'node:buffer'
import { getProposal } from '@/shared/dal/server/proposals/api'
import { buildSowDocDefinition } from './pdf/sow-doc-definition'
import { renderPdf } from './pdf/render-pdf'

/** Proposal PDFs, finance forms, printable documents */
function createPDFService() {
  return {
    generateProposalPdf: async (_params: { proposalId: string }): Promise<Buffer> => {
      throw new Error('pdfService.generateProposalPdf not implemented')
    },

    generateFinanceForm: async (_params: { proposalId: string }): Promise<Buffer> => {
      throw new Error('pdfService.generateFinanceForm not implemented')
    },

    /**
     * Generates a SOW-focused PDF for attachment to the Zoho Sign envelope
     * on the long-SOW path. Excludes branding/pricing/customer block (those
     * live on the main contract template pages).
     */
    generateSowPdf: async ({ proposalId }: { proposalId: string }): Promise<Buffer> => {
      const proposal = await getProposal(proposalId)
      if (!proposal) {
        throw new Error(`pdfService.generateSowPdf: proposal ${proposalId} not found`)
      }
      const docDef = buildSowDocDefinition(proposal)
      return renderPdf(docDef)
    },
  }
}

export type PDFService = ReturnType<typeof createPDFService>
export const pdfService = createPDFService()
```

- [ ] **Step 3: Write the verification script**

Create `scripts/verify-generate-sow-pdf.ts`:

```ts
/* eslint-disable no-console */
import { writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { pdfService } from '@/shared/services/pdf.service'
import { countPdfPages } from '@/shared/services/pdf/count-pdf-pages'

const PROPOSAL_ID = 'baaf55ef-31b1-4393-b721-cdba21610021'   // the triggering-incident proposal

const buf = await pdfService.generateSowPdf({ proposalId: PROPOSAL_ID })
const pages = await countPdfPages(buf)

writeFileSync('/tmp/sow-verification.pdf', buf)
console.log(`✅ PDF generated: ${buf.length} bytes, ${pages} pages`)
console.log('   saved to /tmp/sow-verification.pdf for manual visual inspection')

assert.ok(buf.length > 500, 'PDF is not trivially empty')
assert.ok(pages >= 1, 'PDF has at least 1 page')
assert.ok(pages <= 20, 'PDF page count is reasonable (expected <20 for this proposal)')

console.log('✅ generateSowPdf verified')
```

- [ ] **Step 4: Run verification**

```bash
export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2-)"
pnpm tsx scripts/verify-generate-sow-pdf.ts
```

Expected: `✅ generateSowPdf verified`, creates `/tmp/sow-verification.pdf`. **Manually open `/tmp/sow-verification.pdf` once and confirm it looks acceptable** (title, 2 item sections, readable text, no broken rendering). Copy it from WSL to Windows via `cp /tmp/sow-verification.pdf /mnt/c/Users/porat/Downloads/` if helpful.

- [ ] **Step 5: Typecheck + lint**

```bash
pnpm tsc && pnpm lint
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/shared/services/pdf.service.ts src/shared/services/pdf/render-pdf.ts scripts/verify-generate-sow-pdf.ts
git commit -m "feat(pdf): implement pdfService.generateSowPdf

Wires buildSowDocDefinition + pdfmake rendering into the existing
service stub. Generates a SOW-focused reference PDF for long-SOW Zoho
envelopes.

Refs #135"
```

### Task 9: Add `addFilesToRequest` to contractService

**Files:**
- Modify: `src/shared/services/contract.service.ts`

- [ ] **Step 1: Add the method**

In `src/shared/services/contract.service.ts`, inside `createContractService` scope (after `deleteRequest`), add:

```ts
async function addFilesToRequest(requestId: string, files: Array<{ name: string, buffer: Buffer, mime: string }>): Promise<void> {
  const auth = await getAuthHeader()
  const form = new FormData()
  // Zoho requires the `requests` wrapper in the data field; empty inner
  // object means "keep existing request metadata, just add the file".
  // Confirmed via pre-flight Task 0 (see spec §6.5).
  form.append('data', JSON.stringify({ requests: {} }))
  for (const f of files) {
    form.append('file', new Blob([f.buffer], { type: f.mime }), f.name)
  }
  const res = await fetch(`${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}`, {
    method: 'PUT',
    headers: auth,   // no explicit Content-Type; FormData sets multipart boundary
    body: form,
  })
  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Zoho addFilesToRequest failed (${res.status}): ${errorText}`)
  }
}
```

Also add `Buffer` import at the top:

```ts
import type { Buffer } from 'node:buffer'
```

- [ ] **Step 2: Typecheck + lint**

```bash
pnpm tsc && pnpm lint
```

Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/contract.service.ts
git commit -m "feat(zoho-sign): add addFilesToRequest method to contractService

Wraps the Zoho multipart POST for attaching supporting PDFs to a draft
signing envelope. Endpoint path confirmed via pre-flight Task 0.

Refs #135"
```

### Task 10: Branch `buildSigningRequest` between short and long paths

**Files:**
- Modify: `src/shared/services/zoho-sign/lib/build-signing-request.ts`

- [ ] **Step 1: Rewrite the module**

Replace the contents of `src/shared/services/zoho-sign/lib/build-signing-request.ts`:

```ts
import type { ProposalWithCustomer } from '@/shared/dal/server/proposals/api'
import { computeFinalTcp } from '@/shared/entities/proposals/lib/compute-final-tcp'
import { sowToPlaintext } from '@/shared/lib/tiptap-to-text'
import { ZOHO_SIGN_TEMPLATES } from '../constants'
import { isLongSow } from './is-long-sow'
import { packSowText } from './pack-sow-text'

interface BuildOptions {
  /** Explicit path override. Defaults to auto-detection via isLongSow. */
  mode?: 'short' | 'long'
  /** Required when mode === 'long'; used in sow-1 pointer text. */
  sowPages?: number
}

export function buildSigningRequest(proposal: ProposalWithCustomer, options: BuildOptions = {}) {
  const { customer, projectJSON, fundingJSON } = proposal
  const { data: project } = projectJSON
  const { data: funding } = fundingJSON

  if (customer?.customerAge == null) {
    throw new Error('Customer age is required before creating a signing request. CSLB regulations require age-based template selection.')
  }

  const customerName = customer.name ?? ''
  const customerEmail = customer.email ?? ''
  const customerPhone = customer.phone ?? ''
  const customerAddress = customer.address ?? ''
  const customerCity = customer.city ?? ''
  const customerState = customer.state ?? 'CA'
  const customerZip = customer.zip ?? ''

  const isSenior = customer.customerAge >= 65
  const { templateId, actions: actionIds } = isSenior ? ZOHO_SIGN_TEMPLATES.senior : ZOHO_SIGN_TEMPLATES.base

  const sowText = sowToPlaintext(proposal.projectJSON.data.sow ?? [])
  const mode = options.mode ?? (isLongSow(sowText) ? 'long' : 'short')

  let sow1: string
  let sow2: string
  if (mode === 'long') {
    const pages = options.sowPages
    if (pages == null) {
      throw new Error('buildSigningRequest: sowPages required in long mode')
    }
    sow1 = `See attached Scope of Work document (${pages} ${pages === 1 ? 'page' : 'pages'}) — full details of the Proposed Scope of Work.`
    sow2 = ''
  }
  else {
    const packed = packSowText(sowText)
    if (packed.overflow > 0) {
      throw new Error(`buildSigningRequest: unexpected overflow (${packed.overflow} chars) on short path — route to long path`)
    }
    sow1 = packed.sow1
    sow2 = packed.sow2
  }

  const validThroughTimeframe = Number(project.validThroughTimeframe.replace(/\D/g, ''))
  const startDate = new Date()
  const completionDate = new Date()
  const daysToAdd = 3
  startDate.setDate(startDate.getDate() + daysToAdd)
  completionDate.setDate(startDate.getDate() + validThroughTimeframe)

  return {
    templateId,
    mode,
    body: {
      templates: {
        field_data: {
          field_text_data: {
            'ho-name': customerName,
            'ho-email': customerEmail,
            'ho-age': String(customer.customerAge),
            'start-date': startDate.toLocaleDateString(),
            'completion-date': completionDate.toLocaleDateString(),
            'sow-1': sow1,
            'sow-2': sow2,
            'tcp': String(computeFinalTcp(funding)),
            'deposit': String(funding.depositAmount),
            'ho-address': customerAddress,
            'ho-city-state-zip': `${customerCity}, ${customerState} ${customerZip}`,
            'ho-phone': customerPhone,
          },
          field_boolean_data: {},
          field_date_data: {},
        },
        actions: [
          {
            action_id: actionIds.contractor,
            action_type: 'SIGN',
            role: 'Contractor',
            recipient_name: 'Tri Pros Remodeling',
            recipient_email: 'info@triprosremodeling.com',
            verify_recipient: false,
          },
          {
            action_id: actionIds.homeowner,
            action_type: 'SIGN',
            role: 'Homeowner',
            recipient_name: customerName,
            recipient_email: customerEmail,
            verify_recipient: true,
            verification_type: 'EMAIL',
          },
        ],
        notes: '',
      },
    },
  }
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
pnpm tsc && pnpm lint
```

Expected: both pass.

- [ ] **Step 3: Verify both short and long paths via a small inline check**

Create `scripts/verify-build-signing-request.ts`:

```ts
/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { buildSigningRequest } from '@/shared/services/zoho-sign/lib/build-signing-request'

// Short path: tiny SOW content
const shortProposal = {
  customer: {
    customerAge: 40,
    name: 'Test Customer',
    email: 'test@example.com',
    phone: '',
    address: '',
    city: 'LA',
    state: 'CA',
    zip: '90000',
  },
  projectJSON: {
    data: {
      sow: [{
        contentJSON: JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Short scope of work.' }] }],
        }),
        html: '',
        scopes: [],
        title: 'Test',
        trade: { id: 't', label: 'T' },
      }],
      validThroughTimeframe: '60 days',
    },
  },
  fundingJSON: {
    data: { depositAmount: 1000, startingTcp: 5000, incentives: [], cashInDeal: 4000 },
  },
} as unknown as Parameters<typeof buildSigningRequest>[0]

const short = buildSigningRequest(shortProposal)
assert.equal(short.mode, 'short', 'short SOW routes to short path')
assert.ok(short.body.templates.field_data.field_text_data['sow-1'].length > 0, 'sow-1 populated')
assert.equal(short.body.templates.field_data.field_text_data['sow-2'], '', 'sow-2 empty for tiny scope')
console.log('✅ short path')

// Long path: force mode=long, supply sowPages
const longProposal = {
  ...shortProposal,
  projectJSON: {
    data: {
      ...shortProposal.projectJSON.data,
      sow: Array.from({ length: 3 }, () => shortProposal.projectJSON.data.sow[0]),
    },
  },
} as unknown as Parameters<typeof buildSigningRequest>[0]

const long = buildSigningRequest(longProposal, { mode: 'long', sowPages: 3 })
assert.equal(long.mode, 'long')
assert.match(long.body.templates.field_data.field_text_data['sow-1'], /See attached.*3 pages/)
assert.equal(long.body.templates.field_data.field_text_data['sow-2'], '')
console.log('✅ long path')

// Long mode without sowPages throws
assert.throws(
  () => buildSigningRequest(longProposal, { mode: 'long' }),
  /sowPages required/,
  'throws when sowPages missing in long mode',
)
console.log('✅ long mode sowPages guard')

console.log('\n✅ buildSigningRequest branching verified')
```

Run:

```bash
pnpm tsx scripts/verify-build-signing-request.ts
```

Expected: `✅ buildSigningRequest branching verified`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/shared/services/zoho-sign/lib/build-signing-request.ts scripts/verify-build-signing-request.ts
git commit -m "fix(zoho-sign): branch buildSigningRequest on SOW length

Routes proposals with SOW > SOW_INLINE_MAX_CHARS (3,600) through the
long path where sow-1 becomes a pointer to the attached SOW PDF. Short
path uses the new paragraph-aware packSowText instead of blind slicing.

Fixes the silent mid-word truncation bug on every short SOW and
addresses the overflow failure that silently killed proposal
baaf55ef-31b1-4393-b721-cdba21610021.

Refs #135"
```

### Task 11: Branch `createDraft` in contractService between short and long

**Files:**
- Modify: `src/shared/services/contract.service.ts`

- [ ] **Step 1: Refactor `createDraft` + add the long-path branch**

In `src/shared/services/contract.service.ts`, replace the existing `createDraft` function. Full replacement shown below. Keep all other methods (`createFromTemplate`, `jsonRequest`, `deleteRequest`, `addFilesToRequest` from Task 9, the returned API object) intact.

Add imports at the top of the file:

```ts
import { pdfService } from '@/shared/services/pdf.service'
import { countPdfPages } from '@/shared/services/pdf/count-pdf-pages'
```

Replace `createDraft`:

```ts
async function createDraft(proposalId: string, ownerKey: string | null) {
  const proposal = await getProposal(proposalId)
  if (!proposal) {
    throw new Error(`Proposal ${proposalId} not found`)
  }

  // Probe the mode so we know whether to pre-generate the PDF.
  const probe = buildSigningRequest(proposal)

  if (probe.mode === 'short') {
    // Short path: single template call, unchanged contract shape.
    const res = await createFromTemplate(probe.templateId, probe.body, false)
    if (!res.ok) {
      throw new Error(`Zoho Sign create draft failed: ${await res.text()}`)
    }
    const data = await res.json() as ZohoCreateDocResponse
    const requestId = data.requests.request_id
    if (!requestId) {
      throw new Error('Zoho Sign returned no request_id')
    }
    await updateProposal(ownerKey, proposalId, { signingRequestId: requestId })
    return { requestId, status: data.requests.request_status }
  }

  // Long path: generate SOW PDF, create draft with pointer text, attach PDF.
  const pdfBuffer = await pdfService.generateSowPdf({ proposalId })
  const sowPages = await countPdfPages(pdfBuffer)
  const { templateId, body } = buildSigningRequest(proposal, { mode: 'long', sowPages })

  const createRes = await createFromTemplate(templateId, body, false)
  if (!createRes.ok) {
    throw new Error(`Zoho Sign create draft failed: ${await createRes.text()}`)
  }
  const createData = await createRes.json() as ZohoCreateDocResponse
  const requestId = createData.requests.request_id
  if (!requestId) {
    throw new Error('Zoho Sign returned no request_id')
  }

  try {
    await addFilesToRequest(requestId, [{
      name: sanitizeFilename(`scope-of-work-${proposal.label || proposalId}.pdf`),
      buffer: pdfBuffer,
      mime: 'application/pdf',
    }])
  }
  catch (attachErr) {
    // Draft exists but attachment failed — clean up so the next retry doesn't see a half-built envelope.
    await deleteRequest(requestId).catch(() => {})
    throw attachErr
  }

  await updateProposal(ownerKey, proposalId, { signingRequestId: requestId })
  return { requestId, status: createData.requests.request_status }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/ -]/g, '_').slice(0, 200)
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
pnpm tsc && pnpm lint
```

Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/contract.service.ts
git commit -m "fix(zoho-sign): route createDraft short/long paths end-to-end

Short-path flow unchanged in contract shape (single createFromTemplate).
Long-path flow generates SOW PDF, creates template draft with pointer
text, attaches PDF via addFilesToRequest. Cleans up the draft if the
attachment step fails so retries don't inherit a half-built envelope.

Refs #135"
```

---

## Phase 3 — End-to-end verification

### Task 12: Live integration test — short path against Zoho sandbox

**Files:**
- Create: `scripts/verify-short-path.ts`

- [ ] **Step 1: Write the script**

Create `scripts/verify-short-path.ts`:

```ts
/* eslint-disable no-console */
/**
 * End-to-end short-path verification. Picks a real proposal with a short
 * SOW from the DB, creates a draft via contractService, inspects the
 * Zoho draft to confirm sow-1/sow-2 are populated correctly, and cleans up.
 *
 * Requires: DATABASE_URL + ZOHO_SIGN_* env vars.
 */
import assert from 'node:assert/strict'
import { Client } from 'pg'
import { contractService } from '@/shared/services/contract.service'
import { getZohoAccessToken } from '@/shared/services/zoho-sign/lib/get-access-token'
import { ZOHO_SIGN_BASE_URL } from '@/shared/services/zoho-sign/constants'

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  // Find a short-SOW proposal in sent status (any one will do)
  const { rows } = await client.query(`
    SELECT id, "project_JSON" AS project_json FROM proposals
    WHERE "signing_request_id" IS NOT NULL AND status IN ('sent','approved')
    LIMIT 20
  `)
  await client.end()

  let shortProposalId: string | null = null
  for (const r of rows) {
    const sow = r.project_json?.data?.sow ?? []
    const totalLen = JSON.stringify(sow).length
    if (totalLen < 1500) {
      shortProposalId = r.id
      break
    }
  }
  if (!shortProposalId) {
    throw new Error('No suitable short-SOW proposal found in DB — create one manually in staging')
  }
  console.log('Using short-SOW proposal:', shortProposalId)

  // Clear any existing signingRequestId so createSigningRequest takes the fresh path
  const c2 = new Client({ connectionString: process.env.DATABASE_URL })
  await c2.connect()
  await c2.query(`UPDATE proposals SET "signing_request_id" = NULL WHERE id = $1`, [shortProposalId])
  await c2.end()

  // Run createSigningRequest (null ownerKey = super-admin)
  const { requestId } = await contractService.createSigningRequest(shortProposalId, null)
  console.log('draft created:', requestId)

  // Inspect the draft — confirm sow-1/sow-2 were populated
  const token = await getZohoAccessToken()
  const detailsRes = await fetch(`${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  })
  const details = await detailsRes.json() as {
    requests: {
      document_ids: Array<{ document_id: string }>
      actions: Array<{ fields?: Array<{ field_label: string; default_value?: string }> }>
    }
  }
  assert.equal(details.requests.document_ids.length, 1, 'short path: exactly 1 file in envelope')

  // Cleanup
  await contractService.recallSigningRequest(shortProposalId, null).catch(() => {})
  console.log('✅ short path verified + cleaned up')
}
main().catch((err) => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Run**

```bash
export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2-)"
export ZOHO_SIGN_CLIENT_ID="$(grep -E '^ZOHO_SIGN_CLIENT_ID=' .env | cut -d= -f2-)"
export ZOHO_SIGN_CLIENT_SECRET="$(grep -E '^ZOHO_SIGN_CLIENT_SECRET=' .env | cut -d= -f2-)"
export ZOHO_SIGN_REFRESH_TOKEN="$(grep -E '^ZOHO_SIGN_REFRESH_TOKEN=' .env | cut -d= -f2-)"
pnpm tsx scripts/verify-short-path.ts
```

Expected: `✅ short path verified + cleaned up`.

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-short-path.ts
git commit -m "test(zoho-sign): live short-path integration verification

Refs #135"
```

### Task 13: Live integration test — long path against Zoho sandbox

**Files:**
- Create: `scripts/verify-long-path.ts`

- [ ] **Step 1: Write the script**

Create `scripts/verify-long-path.ts`:

```ts
/* eslint-disable no-console */
/**
 * End-to-end long-path verification. Uses proposal baaf55ef (known-long
 * SOW, 6504 chars). Clears its signingRequestId, runs createSigningRequest,
 * verifies the resulting Zoho draft has 2 files (template doc + attached
 * SOW PDF) and that sow-1 contains the pointer string. Cleans up.
 */
import assert from 'node:assert/strict'
import { Client } from 'pg'
import { contractService } from '@/shared/services/contract.service'
import { getZohoAccessToken } from '@/shared/services/zoho-sign/lib/get-access-token'
import { ZOHO_SIGN_BASE_URL } from '@/shared/services/zoho-sign/constants'

const PROPOSAL_ID = 'baaf55ef-31b1-4393-b721-cdba21610021'

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  await client.query(`UPDATE proposals SET "signing_request_id" = NULL WHERE id = $1`, [PROPOSAL_ID])
  await client.end()
  console.log('cleared signingRequestId for test')

  const { requestId } = await contractService.createSigningRequest(PROPOSAL_ID, null)
  console.log('draft created:', requestId)

  const token = await getZohoAccessToken()
  const detailsRes = await fetch(`${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  })
  const details = await detailsRes.json() as {
    requests: {
      document_ids: Array<{ document_id: string; document_name: string }>
    }
  }
  const docs = details.requests.document_ids
  console.log(`envelope has ${docs.length} files:`)
  for (const d of docs) console.log(`  - ${d.document_name}`)

  assert.equal(docs.length, 2, 'long path: envelope has 2 files (template + SOW PDF)')
  assert.ok(
    docs.some(d => /scope-of-work/i.test(d.document_name)),
    'one file is the SOW attachment',
  )

  // Cleanup: delete the test draft. Do NOT resend to the customer from this verification.
  const c2 = new Client({ connectionString: process.env.DATABASE_URL })
  await c2.connect()
  await c2.query(`UPDATE proposals SET "signing_request_id" = NULL WHERE id = $1`, [PROPOSAL_ID])
  await c2.end()
  await fetch(`${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}/delete`, {
    method: 'PUT',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recall_inprogress: true }),
  })

  console.log('✅ long path verified + cleaned up')
}
main().catch((err) => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Run**

```bash
export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2-)"
export ZOHO_SIGN_CLIENT_ID="$(grep -E '^ZOHO_SIGN_CLIENT_ID=' .env | cut -d= -f2-)"
export ZOHO_SIGN_CLIENT_SECRET="$(grep -E '^ZOHO_SIGN_CLIENT_SECRET=' .env | cut -d= -f2-)"
export ZOHO_SIGN_REFRESH_TOKEN="$(grep -E '^ZOHO_SIGN_REFRESH_TOKEN=' .env | cut -d= -f2-)"
pnpm tsx scripts/verify-long-path.ts
```

Expected: `✅ long path verified + cleaned up`. If this fails, **do not merge.**

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-long-path.ts
git commit -m "test(zoho-sign): live long-path integration verification

Refs #135"
```

---

## Phase 4 — PR, merge, rollout

### Task 14: Open the PR and merge

**Files:** None (GitHub operations).

- [ ] **Step 1: Push branch**

```bash
git push -u origin fix/135-zoho-sow-overflow
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "fix(zoho-sign): conditional multi-doc envelope for long SOWs" --body "$(cat <<'EOF'
## Summary

Fixes the silent Zoho Sign draft-creation failure on proposals with SOW plaintext exceeding 4,096 chars (triggering incident: proposal `baaf55ef-31b1-4393-b721-cdba21610021`, returned HTTP 400 9011 "sow-2: too many characters").

- **Short path** (SOW ≤ 3,600 chars): paragraph-aware packer replaces blind slicing. No behavior change for existing successful sends; also fixes mid-word truncation on every short SOW today.
- **Long path** (SOW > 3,600 chars): generates SOW-focused PDF via pdfmake, attaches to the envelope via Zoho's `addFilesToRequest`, sow-1 becomes a pointer string, sow-2 empty. Template unchanged.

## Changes

- New modules under `src/shared/services/zoho-sign/lib/` (`is-long-sow.ts`, `pack-sow-text.ts`) and `src/shared/services/pdf/` (`tiptap-to-pdfmake.ts`, `sow-doc-definition.ts`, `render-pdf.ts`, `count-pdf-pages.ts`)
- `buildSigningRequest` now accepts `{ mode, sowPages }` options and branches accordingly
- `contractService.createDraft` now orchestrates the long path (generate PDF → create draft → attach → save ID) with cleanup on attach failure
- `pdfService.generateSowPdf` stub is fleshed out
- Added `pdfmake`, `pdf-lib`, `@types/pdfmake`

## Test plan

- [ ] `pnpm tsc` passes
- [ ] `pnpm lint` passes
- [ ] All `scripts/verify-*.ts` exit 0 (isLongSow, packSowText, tiptap-to-pdfmake, countPdfPages, sowDocDefinition, generateSowPdf, verify-short-path, verify-long-path)
- [ ] Pre-flight Task 0 completed; spec §6.5 updated with confirmed endpoint
- [ ] Manual inspection: `/tmp/sow-verification.pdf` renders correctly
- [ ] Long-path integration test against proposal `baaf55ef…` succeeds
- [ ] Short-path integration test on a short-SOW proposal succeeds

## Rollout

1. Merge to main.
2. Wait for Vercel deploy to complete.
3. Un-stick `baaf55ef…` via `scripts/unstick-baaf55ef.ts` (Task 15).
4. Resend signing email to the Markowitz customer from the agent UI.
5. Monitor Upstash QStash + Vercel logs for 48 hours.

Closes #135
Refs #134 (observability follow-up)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for CI + human review, then merge**

Manual step — wait for approval.

### Task 15: Un-stick proposal `baaf55ef…` post-deploy

**Files:**
- Create: `scripts/unstick-baaf55ef.ts` (one-off; delete after use)

**DO NOT RUN THIS UNTIL:** PR is merged AND Vercel deploy is confirmed live.

- [ ] **Step 1: Write the script**

Create `scripts/unstick-baaf55ef.ts`:

```ts
/* eslint-disable no-console */
/**
 * One-off: un-sticks proposal baaf55ef-31b1-4393-b721-cdba21610021 which
 * has been stuck at status=sent, signingRequestId=NULL since 2026-04-23
 * 20:06 UTC. Run this ONCE after the #135 fix is deployed to production.
 *
 * This proposal has a 6,504-char SOW that hit the Zoho 4,096 cap. After
 * the fix lands, ensureDraftSynced takes the long path: generates the
 * SOW PDF, creates the template draft, attaches the PDF.
 */
import { contractService } from '@/shared/services/contract.service'

const PROPOSAL_ID = 'baaf55ef-31b1-4393-b721-cdba21610021'

const result = await contractService.ensureDraftSynced(PROPOSAL_ID, null)
console.log('✅ ensureDraftSynced result:', result)
console.log('\nNext: have the agent hit "Resend" in the UI to send the customer their signing email.')
```

- [ ] **Step 2: Run (one-off)**

```bash
export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2-)"
export ZOHO_SIGN_CLIENT_ID="$(grep -E '^ZOHO_SIGN_CLIENT_ID=' .env | cut -d= -f2-)"
export ZOHO_SIGN_CLIENT_SECRET="$(grep -E '^ZOHO_SIGN_CLIENT_SECRET=' .env | cut -d= -f2-)"
export ZOHO_SIGN_REFRESH_TOKEN="$(grep -E '^ZOHO_SIGN_REFRESH_TOKEN=' .env | cut -d= -f2-)"
pnpm tsx scripts/unstick-baaf55ef.ts
```

Expected: `✅ ensureDraftSynced result: { requestId: ..., status: ... }`.

- [ ] **Step 3: Verify in Zoho dashboard**

Open Zoho Sign dashboard, find the new draft request by customer email `mmmarkowitz@gmail.com`, confirm envelope has 2 files (main contract + SOW attachment), and the SOW attachment renders correctly.

- [ ] **Step 4: Agent resends signing email from UI**

Manual. Agent clicks "Resend contract" in the proposal flow UI.

- [ ] **Step 5: Delete the one-off script**

```bash
git rm scripts/unstick-baaf55ef.ts
git commit -m "chore: remove one-off unstick script post-deploy

Refs #135"
git push
```

---

## Post-merge monitoring (Phase 3 §10 of spec)

- [ ] **48-hour monitoring window.** Watch Upstash QStash console for `sync-contract-draft` job failures. Count long-path hits via any log lines emitted (or grep Vercel logs).
- [ ] **If long-path hits are >5% of all sends,** consider calibrating `SOW_FIELD_MAX_CHARS` toward 2040 in a follow-up to keep more proposals on the cheaper short path.
- [ ] **If any new silent failure categories appear,** escalate to #134 (observability) — this fix is deliberately scoped to the truncation bug, not the broader observability gap.

## Reference

- Spec: [`docs/superpowers/specs/2026-04-23-zoho-sow-multi-doc-design.md`](../specs/2026-04-23-zoho-sow-multi-doc-design.md)
- Issue: [#135](https://github.com/OlisDevSpot/tri-pros-website/issues/135)
- Observability follow-up: [#134](https://github.com/OlisDevSpot/tri-pros-website/issues/134)
- Triggering incident evidence preserved in `scripts/{replay-zoho-draft,dump-failed-sow,inspect-failed-proposal,zoho-template-fields}.ts` (committed 2026-04-23, commit `b549cac`).
