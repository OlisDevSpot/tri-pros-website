/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { countPdfPages } from '@/shared/services/pdf/count-pdf-pages'
import { pdfService } from '@/shared/services/pdf.service'

const PROPOSAL_ID = 'baaf55ef-31b1-4393-b721-cdba21610021'

async function main() {
  const buf = await pdfService.generateSowPdf({ proposalId: PROPOSAL_ID })
  const pages = await countPdfPages(buf)

  writeFileSync('/tmp/sow-verification.pdf', buf)
  console.log(`✅ PDF generated: ${buf.length} bytes, ${pages} pages`)
  console.log('   saved to /tmp/sow-verification.pdf for manual visual inspection')

  assert.ok(buf.length > 500, 'PDF is not trivially empty')
  assert.ok(pages >= 1, 'PDF has at least 1 page')
  assert.ok(pages <= 20, 'PDF page count is reasonable (expected <20 for this proposal)')

  console.log('✅ generateSowPdf verified')
}

main().catch((err) => { console.error(err); process.exit(1) })
